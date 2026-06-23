import { describe, expect, it } from "vitest";
import { analyzePackage } from "./index.js";
import { parseMetadata } from "./metadata.js";

const meta = (extra: Parameters<typeof parseMetadata>[0] = {}) =>
  parseMetadata({
    name: "clean",
    version: "1.0.0",
    maintainers: [{ name: "a" }],
    repository: { url: "https://github.com/x/clean" },
    description: "clean",
    dependencies: {},
    scripts: {},
    ...extra,
  });

describe("risk scoring", () => {
  it("scores a clean package as low / safe_to_run", () => {
    const r = analyzePackage(meta(), [{ path: "index.js", content: "export const a = 1" }]);
    expect(r.risk).toBe("low");
    expect(r.score).toBe(0);
    expect(r.recommendation).toBe("safe_to_run");
  });

  it("escalates to high on lifecycle scripts", () => {
    const r = analyzePackage(meta({ scripts: { postinstall: "node setup.js" } }), []);
    expect(r.risk).toBe("high");
    expect(r.recommendation).toBe("do_not_run_without_user_confirmation");
  });

  it("escalates to high on dangerous execution", () => {
    const r = analyzePackage(meta(), [
      { path: "i.js", content: "require('child_process').exec('x')" },
    ]);
    expect(r.risk).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(35);
  });

  it("escalates to medium on network access alone", () => {
    const r = analyzePackage(meta(), [{ path: "i.js", content: "fetch('https://x')" }]);
    expect(r.risk).toBe("medium");
    expect(r.recommendation).toBe("ask_user");
  });

  it("caps the score at 100", () => {
    const r = analyzePackage(meta({ scripts: { postinstall: "x", preinstall: "y" } }), [
      { path: "a.js", content: "eval('1')" },
      { path: "b.js", content: "fetch('x')" },
      { path: "c.js", content: "fs.writeFile('a')" },
      { path: "d.js", content: "process.env.TOKEN" },
    ]);
    expect(r.score).toBeLessThanOrEqual(100);
  });
});

describe("signal capping", () => {
  it("never returns more than 100 signals", () => {
    const files = Array.from({ length: 500 }, (_, i) => ({
      path: `f${i}.js`,
      content: "fetch('x')",
    }));
    expect(analyzePackage(meta(), files).signals.length).toBeLessThanOrEqual(100);
  });
});

describe("report shape", () => {
  it("emits a stable schemaVersion and required top-level fields", () => {
    const r = analyzePackage(meta(), []);
    expect(r.schemaVersion).toBe("1.0");
    for (const key of [
      "package",
      "version",
      "risk",
      "score",
      "recommendation",
      "signals",
      "metadata",
      "analyzedAt",
      "stats",
    ]) {
      expect(r).toHaveProperty(key);
    }
    expect(r.stats).toEqual({ filesScanned: 0, bytesScanned: 0, truncated: false });
  });

  it("propagates the truncated flag", () => {
    const r = analyzePackage(meta(), [], { truncated: true });
    expect(r.stats.truncated).toBe(true);
  });

  it("produces JSON-serializable output", () => {
    const r = analyzePackage(meta(), [{ path: "i.js", content: "fetch('x')" }]);
    const json = JSON.stringify(r);
    const parsed = JSON.parse(json);
    expect(parsed.signals.length).toBe(r.signals.length);
  });
});
