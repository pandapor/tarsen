// Interactive confirmation gate for `tarsen run`.
//
// Tarsen runs npx ONLY after an explicit human confirmation. To make that
// meaningful it refuses to proceed in any non-interactive context (piped stdin,
// CI, scripts) — there is no `--yes` escape hatch in the MVP.

import { createInterface } from "node:readline/promises";

export interface ConfirmResult {
  confirmed: boolean;
  reason?: string;
}

/**
 * Decide whether we may even ask. A non-interactive stdin means there is no
 * human to confirm, so we refuse to execute.
 */
export function canConfirmInteractive(): boolean {
  return process.stdin.isTTY === true;
}

/**
 * Ask the user to type `run` to proceed. Returns whether they confirmed.
 * Callers should only invoke this when `canConfirmInteractive()` is true.
 */
export async function askToRun(packageSpec: string, args: string[]): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const cmd = `npx ${[packageSpec, ...args].join(" ").trim()}`;
    const answer = await rl.question(`Proceed with ${cmd}? Type "run" to continue: `);
    return answer.trim() === "run";
  } finally {
    rl.close();
  }
}
