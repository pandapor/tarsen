import { describe, expect, it } from "vitest";
import { isAbsolute, normalize, sep } from "node:path";
import { isTraversalAttempt, makeSafeFilter, DEFAULT_EXTRACTION_LIMITS } from "./tar.js";

describe("path traversal protection", () => {
  const dest = normalize("/tmp/tarsen-dest");
  it("rejects absolute paths", () => {
    expect(isTraversalAttempt("/etc/passwd", dest)).toBe(true);
    expect(isTraversalAttempt(normalize("/usr/local/bin/x"), dest)).toBe(true);
  });

  it("rejects leading ../ sequences", () => {
    expect(isTraversalAttempt("../../etc/passwd", dest)).toBe(true);
    expect(isTraversalAttempt(`..${sep}secret`, dest)).toBe(true);
    expect(isTraversalAttempt("foo/../../bar", dest)).toBe(true);
  });

  it("rejects paths that normalize out of dest", () => {
    expect(isTraversalAttempt("package/../../../escape", dest)).toBe(true);
  });

  it("accepts normal in-bounds paths", () => {
    expect(isTraversalAttempt("package/index.js", dest)).toBe(false);
    expect(isTraversalAttempt("package/a/b/c.js", dest)).toBe(false);
  });

  it("accepts paths with internal dot segments that stay in bounds", () => {
    expect(isTraversalAttempt("package/a/../b.js", dest)).toBe(false);
  });
});

describe("safe tar filter", () => {
  const dest = isAbsolute("/tmp/x") ? normalize("/tmp/x") : normalize(`.${sep}tmp`);

  it("drops symlink and hardlink entries", () => {
    const filter = makeSafeFilter(dest, DEFAULT_EXTRACTION_LIMITS);
    expect(filter("package/a", { type: "SymbolicLink" })).toBe(false);
    expect(filter("package/b", { type: "Link" })).toBe(false);
    expect(filter("package/c", { type: "2" })).toBe(false);
    expect(filter("package/d", { type: "1" })).toBe(false);
  });

  it("rejects traversal entries", () => {
    const filter = makeSafeFilter(dest, DEFAULT_EXTRACTION_LIMITS);
    expect(filter("../../escape", { type: "0" })).toBe(false);
    expect(filter(normalize("/etc/passwd"), { type: "0" })).toBe(false);
  });

  it("keeps ordinary file entries", () => {
    const filter = makeSafeFilter(dest, DEFAULT_EXTRACTION_LIMITS);
    expect(filter("package/index.js", { type: "0" })).toBe(true);
  });

  it("enforces the entry cap", () => {
    const filter = makeSafeFilter(dest, { maxEntries: 3 });
    expect(filter("package/a.js", { type: "0" })).toBe(true);
    expect(filter("package/b.js", { type: "0" })).toBe(true);
    expect(filter("package/c.js", { type: "0" })).toBe(true);
    expect(filter("package/d.js", { type: "0" })).toBe(false);
  });
});
