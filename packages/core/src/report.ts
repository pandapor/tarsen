// Risk report types and JSON schema contract.
//
// These types are the machine-readable contract emitted by `tarsen check --json`
// and consumed by `tarsen run` and any downstream tooling. They are stable and
// versioned via `schemaVersion`. See docs/report.schema.json for the JSON Schema.

export const SCHEMA_VERSION = "1.0" as const;

/** Overall risk band assigned to a package. */
export type RiskLevel = "low" | "medium" | "high" | "unknown";

/** What Tarsen advises the operator to do with the package. */
export type Recommendation =
  | "safe_to_run"
  | "ask_user"
  | "do_not_run_without_user_confirmation"
  | "unknown_ask_user";

/** Per-signal severity. `unknown` reports (analysis errors) still use `high`. */
export type SignalSeverity = "low" | "medium" | "high";

/** A single risky static pattern detected in the package. */
export interface RiskSignal {
  type: string;
  severity: SignalSeverity;
  message: string;
  /** Relative path within the extracted tarball (e.g. `index.js`). */
  file?: string;
  /** Human-readable location evidence, e.g. `line 42`. */
  evidence?: string;
}

/** Normalized registry metadata used both for scanning and reporting. */
export interface PackageMetadata {
  name: string;
  version: string;
  description?: string;
  repository?: string | null;
  maintainers: string[];
  publishedAt?: string;
  dependencies: number;
  scripts: Record<string, string>;
  tarball?: string;
  unpackedSize?: number;
  fileCount?: number;
  bin?: string | Record<string, string>;
}

/** Stats about the scan itself, useful for interpreting truncation. */
export interface ScanStats {
  filesScanned: number;
  bytesScanned: number;
  truncated: boolean;
}

/** The full report emitted by Tarsen. Serialized verbatim in `--json` mode. */
export interface RiskReport {
  schemaVersion: typeof SCHEMA_VERSION;
  package: string;
  version: string;
  risk: RiskLevel;
  score: number;
  recommendation: Recommendation;
  signals: RiskSignal[];
  metadata: PackageMetadata;
  analyzedAt: string;
  stats: ScanStats;
}
