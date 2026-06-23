// Static file scanning: pure functions that turn file contents into RiskSignals.
//
// Safety note: these functions only ever inspect strings. They never execute,
// import, or evaluate package code, so scanning untrusted tarballs is safe.

import type { RiskSignal, SignalSeverity } from "./report.js";

interface ScanRule {
  type: string;
  severity: SignalSeverity;
  message: string;
  pattern: RegExp;
}

// Lifecycle + install-script hooks are handled in metadata.ts (from package.json).
// The rules here scan source files for the categories in the detection scope.
const SCAN_RULES: ScanRule[] = [
  {
    type: "dangerous_execution",
    severity: "high",
    message: "child process execution detected",
    pattern: /(?:node:)?child_process|\b(?:execSync|spawnSync|execFileSync|execFile|fork)\s*\(|\b(?:exec|spawn)\s*\(/,
  },
  {
    type: "dynamic_execution",
    severity: "high",
    message: "dynamic code execution detected",
    pattern: /\beval\s*\(|new\s+Function\s*\(|\bFunction\s*\(/,
  },
  {
    type: "filesystem_write",
    severity: "medium",
    message: "filesystem write or deletion detected",
    pattern: /(?:\bfs\.|node:fs)[\s\S]{0,60}\b(?:writeFile|writeFileSync|appendFile|rm|rmSync|unlink|unlinkSync|rmdir|chmod|chown|rename|mkdir|copyFile)\b/,
  },
  {
    type: "filesystem_read",
    severity: "low",
    message: "filesystem read or homedir access detected",
    pattern: /(?:\bfs\.|node:fs)[\s\S]{0,60}\b(?:readFile|readFileSync|readdir|readdirSync|createReadStream|createWriteStream)\b|\bos\.homedir\s*\(/,
  },
  {
    type: "network_access",
    severity: "medium",
    message: "network access detected",
    pattern: /\bfetch\s*\(|\bhttps?\.(?:request|get)\s*\(|\baxios\b|XMLHttpRequest|new\s+WebSocket/,
  },
  {
    type: "shell_command",
    severity: "high",
    message: "shell command construction detected",
    pattern: /\bshell\s*:\s*true|\/bin\/(?:ba|z)?sh|cmd\.exe|powershell(?:\.exe)?/i,
  },
];

/** Return the 1-based line number of the first match for a global regex, else undefined. */
function lineOf(content: string, pattern: RegExp): string | undefined {
  const match = content.match(pattern);
  if (!match || match.index === undefined) return undefined;
  return `line ${content.slice(0, match.index).split("\n").length}`;
}

/** Sensitive env access: NODE_ENV/DEBUG/CI are common and low risk; anything else is high. */
function environmentSignals(content: string, file: string): RiskSignal[] {
  const out: RiskSignal[] = [];
  if (/process\.env(?:\[[^\]]+\]|\.(?!NODE_ENV\b|DEBUG\b|CI\b)[A-Za-z_$][\w$]*)/.test(content)) {
    out.push({
      type: "environment_access",
      severity: "high",
      message: "potentially sensitive environment access detected",
      file,
      evidence: lineOf(content, /process\.env/),
    });
  } else if (/process\.env\.(?:NODE_ENV|DEBUG|CI)\b/.test(content)) {
    out.push({
      type: "environment_access",
      severity: "low",
      message: "runtime environment mode access detected",
      file,
      evidence: lineOf(content, /process\.env/),
    });
  }
  return out;
}

/** Obfuscation heuristics: very long lines and base64-like blobs. */
function obfuscationSignals(content: string, file: string): RiskSignal[] {
  const lines = content.split("\n");
  if (lines.some((line) => line.length > 2000) || /[A-Za-z0-9+/]{1000,}={0,2}/.test(content)) {
    return [
      {
        type: "obfuscation",
        severity: "medium",
        message: "minified, very long, or encoded content detected",
        file,
      },
    ];
  }
  return [];
}

/**
 * Scan a single file's content. Pure & deterministic given the same input.
 * Returns at most one signal per rule per file (deduplicated by type).
 */
export function scanContent(content: string, file: string): RiskSignal[] {
  const signals: RiskSignal[] = [];
  const seen = new Set<string>();

  const push = (signal: RiskSignal) => {
    const key = `${signal.type}:${signal.file ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push(signal);
  };

  for (const rule of SCAN_RULES) {
    if (rule.pattern.test(content)) {
      push({
        type: rule.type,
        severity: rule.severity,
        message: rule.message,
        file,
        evidence: lineOf(content, rule.pattern),
      });
    }
  }

  for (const signal of environmentSignals(content, file)) push(signal);
  for (const signal of obfuscationSignals(content, file)) push(signal);

  return signals;
}

/** Scan every provided file (already read off disk) and flatten the signals. */
export function scanFiles(files: Array<{ path: string; content: string }>): RiskSignal[] {
  const out: RiskSignal[] = [];
  for (const { path, content } of files) out.push(...scanContent(content, path));
  return out;
}
