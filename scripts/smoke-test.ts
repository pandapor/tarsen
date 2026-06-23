#!/usr/bin/env tsx
// Smoke test: exercise the built CLI the way a user would.
//
// Run with: npm run smoke
//
// This is deliberately an integration check, not a unit test. It:
//   - runs `tarsen check react` and confirms a human report prints
//   - runs `tarsen check react --json` and confirms the output is valid JSON
//     with the required shape and no trailing junk
//   - runs `tarsen run` with non-interactive stdin and confirms it REFUSES
//     (exit code 3) rather than executing npx
//
// It requires network access to the public npm registry. It never runs npx.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bin = join(__dirname, "..", "packages", "cli", "dist", "index.js");

let failures = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Run the CLI capturing stdout/stderr. Returns { code, stdout, stderr }. */
function runBin(args: string[], stdin = ""): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [bin, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", resolve);
    child.on("exit", (code) => resolve({ code, stdout, stderr }));
    if (stdin) child.stdin.end(stdin);
    else child.stdin.end();
  });
}

async function main(): Promise<void> {
  console.log("tarsen smoke test\n");

  // 1. Human report prints.
  const human = await runBin(["check", "react"]);
  check("check react exits 0", human.code === 0, `code=${human.code}`);
  check("check react prints report header", human.stdout.includes("Tarsen Risk Report"));
  check("check react shows a risk band", /Risk:\s+(LOW|MEDIUM|HIGH|UNKNOWN)/.test(human.stdout));

  // 2. JSON mode is valid, single-object JSON with the right shape.
  const jsonRun = await runBin(["check", "react", "--json"]);
  check("check react --json exits 0", jsonRun.code === 0, `code=${jsonRun.code}`);
  let parsed: Record<string, unknown> | undefined;
  try {
    parsed = JSON.parse(jsonRun.stdout);
  } catch (error) {
    check("check react --json is valid JSON", false, String(error));
  }
  if (parsed) {
    check("check react --json has schemaVersion", parsed.schemaVersion === "1.0");
    check("check react --json has package", typeof parsed.package === "string");
    check("check react --json has risk", ["low", "medium", "high", "unknown"].includes(String(parsed.risk)));
    check("check react --json has recommendation", typeof parsed.recommendation === "string");
    check("check react --json has signals array", Array.isArray(parsed.signals));
    check("check react --json has stats", typeof parsed.stats === "object" && parsed.stats !== null);
    // No extra log lines leaked into stdout in JSON mode.
    const lines = jsonRun.stdout.trim().split("\n");
    check("check react --json is a single line", lines.length === 1, `lines=${lines.length}`);
  }

  // 3. Non-interactive run is refused (no npx spawned).
  const refused = await runBin(["run", "create-next-app", "smoke-app"], "");
  check("run refuses non-interactive stdin", refused.code === 3, `code=${refused.code}`);
  check("run prints refusal message", /Refusing to execute/.test(refused.stderr));

  console.log(`\n${failures === 0 ? "ALL PASSED" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
