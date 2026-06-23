// Normalize raw npm registry document into PackageMetadata and detect
// metadata-level risk signals (missing fields, very new package, typosquatting).
//
// This module deliberately touches only the registry JSON, never the tarball,
// so it is safe to run against untrusted manifests.

import type { PackageMetadata, RiskSignal } from "./report.js";

const LIFECYCLE_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"] as const;

/** A reasonable allowlist of well-known package names for typosquat checks. */
export const COMMON_PACKAGE_NAMES = [
  "typescript",
  "react",
  "react-dom",
  "next",
  "vite",
  "webpack",
  "rollup",
  "esbuild",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "express",
  "commander",
  "lodash",
  "axios",
  "chalk",
  "npm",
  "pnpm",
  "yarn",
  "create-next-app",
  "create-vite",
  "create-react-app",
];

/** Pull a `name` out of either `{name:"x"}` or `{name:"x",email:"y"}` maintainer shapes. */
function maintainerName(entry: unknown): string | undefined {
  if (typeof entry === "string") return entry;
  if (entry && typeof entry === "object") {
    const { name, email } = entry as Record<string, unknown>;
    if (typeof name === "string" && name) return name;
    if (typeof email === "string" && email) return email;
  }
  return undefined;
}

/** Build normalized metadata from a single version manifest + the packument. */
export function parseMetadata(
  manifest: Record<string, unknown>,
  packument: Record<string, unknown> = {},
): PackageMetadata {
  const version = String(manifest.version ?? "unknown");
  const repositoryField = manifest.repository;
  const repository =
    typeof repositoryField === "string"
      ? repositoryField
      : repositoryField && typeof repositoryField === "object"
        ? String((repositoryField as Record<string, unknown>).url ?? "")
        : null;
  const maintainers = (manifest.maintainers ?? packument.maintainers ?? []) as unknown[];
  const time = packument.time as Record<string, unknown> | undefined;
  const dist = (manifest.dist ?? {}) as Record<string, unknown>;
  return {
    name: String(manifest.name ?? "unknown"),
    version,
    description: typeof manifest.description === "string" ? manifest.description : undefined,
    repository: repository || null,
    maintainers: maintainers.map(maintainerName).filter((m): m is string => Boolean(m)),
    publishedAt: time && time[version] ? String(time[version]) : undefined,
    dependencies: Object.keys((manifest.dependencies as Record<string, unknown>) ?? {}).length,
    scripts: (manifest.scripts as Record<string, string>) ?? {},
    tarball: typeof dist.tarball === "string" ? dist.tarball : undefined,
    unpackedSize: typeof dist.unpackedSize === "number" ? dist.unpackedSize : undefined,
    fileCount: typeof dist.fileCount === "number" ? dist.fileCount : undefined,
    bin: manifest.bin as string | Record<string, string> | undefined,
  };
}

/** Levenshtein edit distance, used for one-edit typosquat detection. */
function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1,
        d[i]![j - 1]! + 1,
        d[i - 1]![j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return d[a.length]![b.length]!;
}

/** Return a typosquat signal if the scoped/unscoped name is one edit from a common package. */
export function typosquatSignal(name: string): RiskSignal | undefined {
  const plain = name.replace(/^@[^/]+\//, "");
  if (plain.length < 4) return undefined;
  // A well-known package name is never itself a typosquat, even if it happens
  // to be one edit from another common package (e.g. `pnpm` vs `npm`).
  if (COMMON_PACKAGE_NAMES.includes(plain)) return undefined;
  const target = COMMON_PACKAGE_NAMES.find((item) => editDistance(plain, item) === 1);
  return target
    ? {
        type: "typosquatting",
        severity: "high",
        message: `package name is one edit away from "${target}"`,
      }
    : undefined;
}

/** True if the package was published within the freshness threshold (default 14 days). */
export function isVeryNew(publishedAt: string | undefined, days = 14): boolean {
  if (!publishedAt) return false;
  const then = Date.parse(publishedAt);
  return Number.isFinite(then) && Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

/**
 * Metadata + lifecycle signals. Pure function of the manifest; never touches files.
 * These run even when no source can be extracted, so a publish-only package still
 * gets a meaningful report.
 */
export function metadataSignals(metadata: PackageMetadata): RiskSignal[] {
  const signals: RiskSignal[] = [];

  for (const script of LIFECYCLE_SCRIPTS) {
    const value = metadata.scripts[script];
    if (value) {
      signals.push({
        type: "lifecycle_script",
        severity: "high",
        message: `${script} script detected`,
        file: "package.json",
        evidence: value,
      });
    }
  }

  if (!metadata.repository) {
    signals.push({ type: "metadata_risk", severity: "medium", message: "repository is missing" });
  }
  if (!metadata.maintainers.length) {
    signals.push({ type: "metadata_risk", severity: "medium", message: "maintainers are missing" });
  }
  if (!metadata.description) {
    signals.push({ type: "metadata_risk", severity: "low", message: "description is missing" });
  }
  if (isVeryNew(metadata.publishedAt)) {
    signals.push({
      type: "metadata_risk",
      severity: "medium",
      message: "package was published very recently",
    });
  }

  const typo = typosquatSignal(metadata.name);
  if (typo) signals.push(typo);

  return signals;
}
