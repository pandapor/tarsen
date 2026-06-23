// Risk scoring and recommendation logic.
//
// Pure function of the signal list. Kept separate so it can be unit tested
// without touching the network or filesystem.

import type { Recommendation, RiskLevel, RiskSignal, SignalSeverity } from "./report.js";

/** Per-severity weight when summing the strongest signal of each type. */
export const SEVERITY_WEIGHTS: Record<SignalSeverity, number> = {
  high: 35,
  medium: 12,
  low: 2,
};

const SEVERITY_RANK: Record<SignalSeverity, number> = { low: 1, medium: 2, high: 3 };

/** Cap duplicate signal types so a chatty detector cannot dominate the report. */
export function capSignals(signals: RiskSignal[], limit = 100): RiskSignal[] {
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  const out: RiskSignal[] = [];
  for (const signal of signals) {
    const key = `${signal.type}:${signal.file ?? ""}`;
    if (seen.has(key) || (counts.get(signal.type) ?? 0) >= 5) continue;
    seen.add(key);
    counts.set(signal.type, (counts.get(signal.type) ?? 0) + 1);
    out.push(signal);
    if (out.length >= limit) break;
  }
  return out;
}

/** 0-100 score: sum the strongest severity per signal type, capped at 100. */
export function scoreSignals(signals: RiskSignal[]): number {
  const strongestByType = new Map<string, SignalSeverity>();
  for (const signal of signals) {
    const current = strongestByType.get(signal.type);
    if (!current || SEVERITY_RANK[signal.severity] > SEVERITY_RANK[current]) {
      strongestByType.set(signal.type, signal.severity);
    }
  }
  return Math.min(
    100,
    [...strongestByType.values()].reduce((sum, severity) => sum + SEVERITY_WEIGHTS[severity], 0),
  );
}

/** Map a score + signal distribution to a risk band. */
export function riskLevel(signals: RiskSignal[], score: number): RiskLevel {
  const hasHigh = signals.some((signal) => signal.severity === "high");
  const mediumCount = signals.filter((signal) => signal.severity === "medium").length;
  if (hasHigh) return "high";
  if (mediumCount > 0 || score >= 10) return "medium";
  return "low";
}

/** Map a risk band to a recommendation. `unknown` is handled by the caller. */
export function recommend(risk: RiskLevel): Recommendation {
  switch (risk) {
    case "high":
      return "do_not_run_without_user_confirmation";
    case "medium":
      return "ask_user";
    case "low":
      return "safe_to_run";
    default:
      return "unknown_ask_user";
  }
}
