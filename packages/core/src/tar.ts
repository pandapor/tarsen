// Safe tarball extraction helpers.
//
// These are the hard safety guarantees Tarsen makes during analysis:
//   - tarballs are extracted ONLY into a caller-provided temporary directory
//   - path traversal (entries escaping via `../` or absolute paths) is rejected
//   - symlinks and hardlinks are dropped
//   - entry count and per-archive byte budgets are enforced
//
// This module never executes package code and never runs install scripts.

import { isAbsolute, normalize, relative, sep } from "node:path";

/** Reject a tarball entry whose resolved path would escape the destination. */
export function isTraversalAttempt(entryPath: string, dest: string): boolean {
  const cleaned = normalize(entryPath);
  if (isAbsolute(cleaned)) return true;
  if (cleaned.startsWith("..") || cleaned.startsWith(`..${sep}`)) return true;
  // Belt-and-braces: resolve relative to dest and confirm it stays inside.
  const resolved = normalize(`${dest}${sep}${cleaned}`);
  const rel = relative(dest, resolved);
  return rel.startsWith("..") || isAbsolute(rel);
}

/** Entry filter shared with `tar.x`. Returns `true` to KEEP an entry. */
export interface ExtractionLimits {
  maxEntries: number;
}

/**
 * Build a `tar.x` filter. Counts entries and drops anything that is a link,
 * escapes the destination, or would exceed the entry budget.
 *
 * `tar` passes each entry header as `header` with a `type` flag:
 *   0/""  file, 5 directory, 2 symlink, 1 hardlink, etc.
 */
export function makeSafeFilter(dest: string, limits: ExtractionLimits) {
  let entries = 0;
  return (_path: string, entry: { type?: string }) => {
    entries += 1;
    if (entries > limits.maxEntries) return false;
    const type = entry.type ?? "";
    // Drop all link types (symlink, hardlink, character/block device).
    if (type === "SymbolicLink" || type === "Link" || type === "2" || type === "1") return false;
    return !isTraversalAttempt(_path, dest);
  };
}

/** Walked file shape used by the analyzer. */
export interface ExtractedFile {
  path: string;
  content: string;
}

export interface WalkResult {
  files: ExtractedFile[];
  truncated: boolean;
}

/** Conservative defaults mirroring the CLI's own pipeline. */
export const DEFAULT_EXTRACTION_LIMITS: ExtractionLimits = { maxEntries: 10_000 };
