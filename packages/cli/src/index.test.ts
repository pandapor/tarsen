// CLI unit tests. These exercise the pure pieces (JSON output shape, report
// rendering, non-interactive refusal) without hitting the network or spawning
// npx. The end-to-end registry path is covered by scripts/smoke-test.ts.

import { describe, expect, it } from "vitest";
import { analyzePackage, unknownReport, type RiskReport } from "@tarsen/core";
import { parseMetadata } from "@tarsen/core";
import { canConfirmInteractive } from "./confirm.js";

const meta = parseMetadata({
  name: "demo",
  version: "1.2.3",
  maintainers: [{ name: "alice" }],
  repository: { url: "https://github.com/demo/demo" },
  description: "demo package",
  dependencies: { react: "*" },
  scripts: { postinstall: "node setup.js" },
  dist: { tarball: "https://registry.npmjs.org/demo/-/demo-1.2.3.tgz" },
});

const report: RiskReport = analyzePackage(meta, [
  { path: "index.js", content: "require('child_process').exec('whoami')" },
  { path: "net.js", content: "fetch('https://example.com')" },
]);

describe("JSON output shape", () => {
  it("serializes a report as a single valid JSON object", () => {
    const json = JSON.stringify(report);
    const parsed = JSON.parse(json) as RiskReport;
    expect(parsed.schemaVersion).toBe("1.0");
    expect(parsed.package).toBe("demo");
    expect(parsed.version).toBe("1.2.3");
    expect(parsed.risk).toBe("high");
    expect(parsed.recommendation).toBe("do_not_run_without_user_confirmation");
  });

  it("emits an unknown report with the required shape on failure", () => {
    const u = unknownReport("does-not-exist-xyz", new Error("boom"));
    expect(u.schemaVersion).toBe("1.0");
    expect(u.risk).toBe("unknown");
    expect(u.recommendation).toBe("unknown_ask_user");
    expect(u.signals[0]?.type).toBe("analysis_error");
    expect(JSON.parse(JSON.stringify(u)).signals).toHaveLength(1);
  });
});

describe("non-interactive run refusal", () => {
  it("canConfirmInteractive reflects whether stdin is a TTY", () => {
    // Under vitest stdin is not a TTY, so confirmation must be refused here.
    expect(typeof canConfirmInteractive()).toBe("boolean");
    expect(canConfirmInteractive()).toBe(false);
  });
});

describe("report rendering contract", () => {
  // We assert on the structure the renderer depends on, not ANSI bytes, so the
  // test stays stable across TTY/non-TTY environments.
  it("exposes every field the renderer prints", () => {
    const required = [
      "package",
      "version",
      "risk",
      "score",
      "recommendation",
      "signals",
      "metadata",
      "stats",
    ] as const;
    for (const key of required) expect(report).toHaveProperty(key);
    expect(report.metadata.maintainers).toEqual(["alice"]);
    expect(report.metadata.repository).toBe("https://github.com/demo/demo");
    expect(report.metadata.dependencies).toBe(1);
  });
});
