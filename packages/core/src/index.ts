// tarsen-core — static npm package analyzer.
//
// Tarsen never executes package code during analysis and never runs install
// scripts. This package only fetches metadata, scans extracted source files as
// strings, scores the results, and emits a stable JSON report. There is no
// cloud connection and no telemetry in this package.

import type { PackageMetadata, RiskReport, RiskSignal } from "./report.js";
import { metadataSignals } from "./metadata.js";
import { scanFiles } from "./scan.js";
import { capSignals, recommend, riskLevel, scoreSignals } from "./score.js";

export { SCHEMA_VERSION } from "./report.js";
export type {
  PackageMetadata,
  Recommendation,
  RiskLevel,
  RiskReport,
  RiskSignal,
  ScanStats,
  SignalSeverity,
} from "./report.js";
export { parseMetadata, typosquatSignal, isVeryNew, COMMON_PACKAGE_NAMES } from "./metadata.js";
export { scanContent, scanFiles } from "./scan.js";
export { capSignals, scoreSignals, riskLevel, recommend, SEVERITY_WEIGHTS } from "./score.js";
export {
  isTraversalAttempt,
  makeSafeFilter,
  DEFAULT_EXTRACTION_LIMITS,
} from "./tar.js";
export type { ExtractionLimits, ExtractedFile, WalkResult } from "./tar.js";

export interface AnalyzeOptions {
  truncated?: boolean;
}

/**
 * Combine metadata + scanned-file signals into a finalized report.
 *
 * This is the single entry point the CLI uses after extracting a tarball.
 * It is a pure function of its inputs and safe to call against untrusted data.
 */
export function analyzePackage(
  metadata: PackageMetadata,
  files: Array<{ path: string; content: string }>,
  options: AnalyzeOptions = {},
): RiskReport {
  const raw: RiskSignal[] = [...metadataSignals(metadata), ...scanFiles(files)];
  const signals = capSignals(raw);
  const score = scoreSignals(signals);
  const risk = riskLevel(signals, score);
  return {
    schemaVersion: "1.0",
    package: metadata.name,
    version: metadata.version,
    risk,
    score,
    recommendation: recommend(risk),
    signals,
    metadata,
    analyzedAt: new Date().toISOString(),
    stats: {
      filesScanned: files.length,
      bytesScanned: files.reduce((n, f) => n + Buffer.byteLength(f.content), 0),
      truncated: options.truncated ?? false,
    },
  };
}

/**
 * Produce an `unknown` report when metadata fetch or extraction fails. The CLI
 * uses this so `--json` always emits a valid object and a non-zero exit code,
 * rather than crashing or printing a stack trace.
 */
export function unknownReport(packageSpec: string, error: unknown): RiskReport {
  return {
    schemaVersion: "1.0",
    package: packageSpec,
    version: "unknown",
    risk: "unknown",
    score: 0,
    recommendation: "unknown_ask_user",
    signals: [
      {
        type: "analysis_error",
        severity: "high",
        message: error instanceof Error ? error.message : String(error),
      },
    ],
    metadata: {
      name: packageSpec,
      version: "unknown",
      maintainers: [],
      dependencies: 0,
      scripts: {},
    },
    analyzedAt: new Date().toISOString(),
    stats: { filesScanned: 0, bytesScanned: 0, truncated: false },
  };
}
