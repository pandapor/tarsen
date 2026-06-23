// Terminal rendering for the human-readable report.
//
// Color is applied ONLY when stdout is a TTY. JSON mode never calls into here;
// it writes a single JSON object with no colors and no extra logs.

import type { RiskReport } from "@tarsen/core";

const isTty = process.stdout.isTTY === true;

/** Wrap text in an ANSI color code, but only on an interactive terminal. */
function color(code: number, text: string): string {
  return isTty ? `\u001b[${code}m${text}\u001b[0m` : text;
}

function severityMarker(severity: "low" | "medium" | "high"): string {
  if (severity === "high") return color(31, "[!]");
  if (severity === "medium") return color(33, "[·]");
  return color(36, "[i]");
}

function riskColor(risk: RiskReport["risk"]): number {
  if (risk === "high") return 31;
  if (risk === "medium") return 33;
  return 32;
}

/** Print the human-readable risk report to stdout. */
export function printReport(report: RiskReport): void {
  const rc = riskColor(report.risk);
  console.log(`\n${color(1, "Tarsen Risk Report")}\n`);
  console.log(`Package:       ${report.package}`);
  console.log(`Version:       ${report.version}`);
  console.log(`Published:     ${report.metadata.publishedAt ?? "unknown"}`);
  console.log(`Maintainers:   ${report.metadata.maintainers.join(", ") || "unknown"}`);
  console.log(`Repository:    ${report.metadata.repository ?? "missing"}`);
  console.log(`Dependencies:  ${report.metadata.dependencies}`);
  console.log(`Files scanned: ${report.stats.filesScanned}${report.stats.truncated ? " (limit reached)" : ""}`);
  console.log(`\n${color(1, "Signals:")}`);
  if (!report.signals.length) {
    console.log(color(32, "[✓] no risky static patterns detected"));
  }
  for (const signal of report.signals) {
    const where = signal.file ? ` in ${signal.file}` : "";
    const evidence = signal.evidence ? ` (${signal.evidence})` : "";
    console.log(`${severityMarker(signal.severity)} ${signal.message}${where}${evidence}`);
  }
  console.log(
    `\nRisk:           ${color(rc, report.risk.toUpperCase())} (${report.score}/100)`,
  );
  console.log(`Recommendation: ${report.recommendation}\n`);
}
