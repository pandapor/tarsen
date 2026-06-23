import { describe, expect, it } from "vitest";
import {
  COMMON_PACKAGE_NAMES,
  isVeryNew,
  metadataSignals,
  parseMetadata,
  typosquatSignal,
} from "./metadata.js";

const meta = (extra: Partial<Parameters<typeof parseMetadata>[0]> = {}) =>
  parseMetadata({
    name: "clean",
    version: "1.0.0",
    maintainers: [{ name: "a" }],
    repository: { url: "https://github.com/x/clean" },
    description: "a clean package",
    dependencies: {},
    scripts: {},
    dist: {},
    ...extra,
  });

describe("metadata parsing", () => {
  it("normalizes maintainer objects and strings", () => {
    const m = parseMetadata({
      name: "x",
      version: "1.0.0",
      maintainers: [{ name: "alice" }, { email: "bob@example.com" }, "carol"],
    });
    expect(m.maintainers).toEqual(["alice", "bob@example.com", "carol"]);
  });

  it("keeps string and object repository shapes", () => {
    expect(parseMetadata({ name: "x", version: "1", repository: "git://x" }).repository).toBe(
      "git://x",
    );
    expect(
      parseMetadata({ name: "x", version: "1", repository: { url: "https://r" } }).repository,
    ).toBe("https://r");
    expect(parseMetadata({ name: "x", version: "1" }).repository).toBeNull();
  });

  it("counts dependencies and reads dist metadata", () => {
    const m = parseMetadata({
      name: "x",
      version: "1",
      dependencies: { a: "1", b: "2" },
      dist: { tarball: "https://t", unpackedSize: 10, fileCount: 2 },
    });
    expect(m.dependencies).toBe(2);
    expect(m.tarball).toBe("https://t");
    expect(m.unpackedSize).toBe(10);
    expect(m.fileCount).toBe(2);
  });

  it("resolves publishedAt from packument.time keyed by version", () => {
    const m = parseMetadata(
      { name: "x", version: "1.2.3" },
      { time: { "1.2.3": "2024-01-01T00:00:00.000Z" } },
    );
    expect(m.publishedAt).toBe("2024-01-01T00:00:00.000Z");
  });
});

describe("metadata risk signals", () => {
  it("flags missing repository and maintainers", () => {
    const signals = metadataSignals(
      parseMetadata({ name: "x", version: "1", maintainers: [] }),
    );
    expect(signals.some((s) => s.message.includes("repository"))).toBe(true);
    expect(signals.some((s) => s.message.includes("maintainers"))).toBe(true);
  });

  it("flags a missing description at low severity", () => {
    const signals = metadataSignals(parseMetadata({ name: "x", version: "1", description: "" }));
    expect(signals.some((s) => s.type === "metadata_risk" && s.severity === "low")).toBe(true);
  });
});

describe("very-new detection", () => {
  it("treats a timestamp from today as very new", () => {
    expect(isVeryNew(new Date().toISOString())).toBe(true);
  });
  it("treats an old timestamp as not new", () => {
    expect(isVeryNew("2000-01-01T00:00:00.000Z")).toBe(false);
  });
  it("ignores undefined publishedAt", () => {
    expect(isVeryNew(undefined)).toBe(false);
  });
  it("emits a very-new signal via metadataSignals", () => {
    const m = parseMetadata({ name: "x", version: "1" });
    m.publishedAt = new Date().toISOString();
    expect(metadataSignals(m).some((s) => s.message.includes("recently"))).toBe(true);
  });
});

describe("typosquatting", () => {
  it("detects a one-edit name near a common package", () => {
    expect(typosquatSignal("expres")?.type).toBe("typosquatting"); // express - 1 char
    expect(typosquatSignal("reacct")?.type).toBe("typosquatting"); // react + 1 char
  });
  it("does not flag the exact common package", () => {
    for (const name of COMMON_PACKAGE_NAMES) {
      expect(typosquatSignal(name)).toBeUndefined();
    }
  });
  it("ignores very short names", () => {
    expect(typosquatSignal("re")).toBeUndefined();
  });
});
