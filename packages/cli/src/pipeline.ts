// Registry fetch + safe extraction pipeline for the Tarsen CLI.
//
// Hard safety rules enforced here (see docs/security-model.md):
//   - package code is NEVER executed and install scripts are NEVER run
//   - tarballs are extracted ONLY into a temporary directory owned by Tarsen
//   - path traversal and symlink/hardlink entries are rejected via @tarsen/core
//   - the temporary directory is always removed (finally block)
//   - the only network call is to the public npm registry; there is no cloud

import { lstat, mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import npa from "npm-package-arg";
import { maxSatisfying, valid } from "semver";
import * as tar from "tar";
import {
  analyzePackage,
  makeSafeFilter,
  parseMetadata,
  type RiskReport,
} from "@tarsen/core";

// Conservative limits to bound analysis time and memory on hostile packages.
const MAX_TARBALL_BYTES = 50 * 1024 * 1024; // 50 MB cap on a single tarball
const MAX_METADATA_BYTES = 20 * 1024 * 1024; // 20 MB cap on a packument
const MAX_FILES = 10_000; // extracted entry cap
const MAX_SCAN_BYTES = 30 * 1024 * 1024; // 30 MB cap on total scanned source
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB cap per scanned source file
const REQUEST_TIMEOUT_MS = 20_000;

// Only scan source-like files; skip binaries, assets, and lockfiles.
const CODE_EXTENSIONS = /\.(?:[cm]?[jt]sx?|json)$/i;

/** Fetch a URL with a timeout and a hard byte ceiling on the response body. */
export async function fetchWithLimits(url: string, maxBytes: number): Promise<Buffer> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "tarsen/0.1.0" },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from npm registry`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) {
      throw new Error(`download exceeds ${Math.round(maxBytes / 1024 / 1024)} MB safety limit`);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new Error("registry returned no response body");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error(`download exceeds ${Math.round(maxBytes / 1024 / 1024)} MB safety limit`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timer);
  }
}

/** GET and parse JSON from the registry, bounded by MAX_METADATA_BYTES. */
export async function readJson(url: string): Promise<unknown> {
  return JSON.parse((await fetchWithLimits(url, MAX_METADATA_BYTES)).toString("utf8"));
}

/** Resolve a version spec against a packument's dist-tags and versions. */
export function resolveVersion(
  data: { "dist-tags"?: Record<string, string>; versions?: Record<string, unknown> },
  spec: string,
): string | null {
  if (!spec || spec === "*" || spec === "latest") return data["dist-tags"]?.latest ?? null;
  if (data["dist-tags"]?.[spec]) return data["dist-tags"][spec] ?? null;
  if (valid(spec) && data.versions?.[spec]) return spec;
  return maxSatisfying(Object.keys(data.versions ?? {}), spec) ?? null;
}

interface WalkResult {
  files: Array<{ path: string; content: string }>;
  truncated: boolean;
}

/** Walk an extracted directory, reading only source files within size budgets. */
async function walk(dir: string): Promise<WalkResult> {
  const files: Array<{ path: string; content: string }> = [];
  let bytes = 0;
  let truncated = false;

  async function visit(current: string): Promise<void> {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (files.length >= MAX_FILES || bytes >= MAX_SCAN_BYTES) {
        truncated = true;
        return;
      }
      const full = join(current, entry.name);
      const stat = await lstat(full);
      if (stat.isSymbolicLink()) continue; // never follow links during analysis
      if (stat.isDirectory()) {
        await visit(full);
        continue;
      }
      if (!stat.isFile() || !CODE_EXTENSIONS.test(entry.name) || stat.size > MAX_FILE_BYTES) {
        continue;
      }
      const content = await readFile(full, "utf8").catch(() => "");
      bytes += Buffer.byteLength(content);
      files.push({ path: full.slice(dir.length + 1), content });
    }
  }

  await visit(dir);
  return { files, truncated };
}

/**
 * Fetch registry metadata + tarball for a package spec, extract it safely into
 * a temporary directory, scan it, clean up, and return a risk report.
 *
 * This is the only function in the CLI that touches the network or disk write.
 */
export async function checkPackage(packageSpec: string): Promise<RiskReport> {
  const parsed = npa(packageSpec);
  if (!parsed.registry || !parsed.name) {
    throw new Error("only npm registry package specs are supported");
  }
  const registryName = parsed.name.replace("/", "%2f");
  const data = (await readJson(`https://registry.npmjs.org/${registryName}`)) as {
    "dist-tags"?: Record<string, string>;
    versions?: Record<string, unknown>;
    time?: Record<string, unknown>;
    maintainers?: unknown[];
  };
  const version = resolveVersion(
    { "dist-tags": data["dist-tags"], versions: data.versions },
    parsed.rawSpec,
  );
  if (!version) throw new Error(`no matching version found for ${packageSpec}`);
  const manifest = data.versions?.[version] as Record<string, unknown>;
  if (!manifest?.dist || !(manifest.dist as Record<string, unknown>).tarball) {
    throw new Error("package tarball is unavailable");
  }
  const tarball = String((manifest.dist as Record<string, unknown>).tarball);
  const metadata = parseMetadata(manifest, data);

  // Extract into a temp dir we own and always clean up.
  const dir = await mkdtemp(join(tmpdir(), "tarsen-"));
  try {
    const tgz = join(dir, "package.tgz");
    const extractDir = join(dir, "extract");
    await writeFile(tgz, await fetchWithLimits(tarball, MAX_TARBALL_BYTES));
    await mkdir(extractDir);
    const filter = makeSafeFilter(extractDir, { maxEntries: MAX_FILES });
    let entryCount = 0;
    // `tar`'s filter is consulted per entry; count via the same closure to
    // detect an over-budget archive even when entries are otherwise valid.
    // `tar` passes a Stats | ReadEntry; we adapt it to core's { type? } shape.
    const countingFilter = (path: string, entry: unknown) => {
      const type =
        entry && typeof entry === "object" && "type" in entry
          ? String((entry as Record<string, unknown>).type ?? "")
          : "";
      const keep = filter(path, { type });
      if (keep) entryCount += 1;
      return keep;
    };
    await tar.x({
      file: tgz,
      cwd: extractDir,
      strict: true,
      preservePaths: false,
      strip: 1,
      // tar's filter overload is (path, entry: Stats | ReadEntry) => boolean.
      filter: countingFilter as Parameters<typeof tar.x>[0]["filter"],
    });
    const scanned = await walk(extractDir);
    return analyzePackage(metadata, scanned.files, {
      truncated: scanned.truncated || entryCount >= MAX_FILES,
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Re-exported so tests can read a local file as a stand-in policy/example. */
export { readFile };
