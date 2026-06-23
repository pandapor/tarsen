#!/usr/bin/env node
// tarsen — check executable npm packages before they run.
//
// Instead of `npx some-package`, run `tarsen run some-package`. Tarsen checks
// the package first, prints a risk report, and only invokes npx after an
// explicit interactive confirmation.
//
// MVP scope: `check` and `run` only. There is no cloud connection, no telemetry,
// no login, and no team policy commands in this build.

import { Command } from "commander";
import { spawn } from "node:child_process";
import { unknownReport, type RiskReport } from "@tarsen/core";
import { askToRun, canConfirmInteractive } from "./confirm.js";
import { printReport } from "./render.js";
import { checkPackage } from "./pipeline.js";

const program = new Command()
  .name("tarsen")
  .description("Check executable npm packages before they run.")
  .version("0.1.0");

// `tarsen check <package>` — analyze and print a report. `--json` emits a
// single valid JSON object to stdout with no colors and no extra logs.
program
  .command("check")
  .argument("<package>", "npm package spec, e.g. react or create-next-app@16")
  .option("--json", "output a single valid JSON object, no colors or logs")
  .description("Check a package and print a risk report")
  .action(async (packageSpec: string, options: { json?: boolean }) => {
    let report: RiskReport;
    try {
      report = await checkPackage(packageSpec);
    } catch (error) {
      report = unknownReport(packageSpec, error);
      if (options.json) {
        process.stdout.write(`${JSON.stringify(report)}\n`);
      } else {
        printReport(report);
      }
      process.exitCode = 2;
      return;
    }
    if (options.json) {
      process.stdout.write(`${JSON.stringify(report)}\n`);
    } else {
      printReport(report);
    }
  });

// `tarsen run <package> [args...]` — check, print the report, then (only after
// an interactive confirmation) hand off to npx. Refuses non-interactive runs.
program
  .command("run")
  .argument("<package>", "npm package spec to execute via npx")
  .argument("[args...]", "extra arguments forwarded to npx")
  .description("Check a package, confirm, then execute it through npx")
  .action(async (packageSpec: string, args: string[]) => {
    let report: RiskReport;
    try {
      report = await checkPackage(packageSpec);
    } catch (error) {
      report = unknownReport(packageSpec, error);
    }
    printReport(report);

    if (!canConfirmInteractive()) {
      console.error(
        'Refusing to execute without an interactive confirmation. Run "tarsen check" instead, or run "tarsen run" from an interactive terminal.',
      );
      process.exitCode = 3;
      return;
    }

    const confirmed = await askToRun(packageSpec, args);
    if (!confirmed) {
      console.log("Cancelled.");
      return;
    }

    const cmd = process.platform === "win32" ? "npx.cmd" : "npx";
    const child = spawn(cmd, ["--yes", packageSpec, ...args], {
      stdio: "inherit",
      shell: false,
    });
    child.on("exit", (code) => {
      process.exitCode = code ?? 1;
    });
  });

program.parseAsync().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
