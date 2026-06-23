# Tarsen

Tarsen checks executable npm packages before developers or AI agents run them.

Instead of blindly running `npx some-package`, run `tarsen run some-package`.
Tarsen fetches the package, extracts it **safely** into a temporary directory,
scans it **without executing any of its code**, prints a risk report, and only
hands off to `npx` after you explicitly confirm.

```bash
tarsen check react
tarsen check react --json
tarsen run create-next-app my-app
```

Tarsen is **local-first**: no cloud, no telemetry, no account, no dashboard.
The only network call is to the public npm registry.

---

## What Tarsen does

- Checks an npm package **before** it runs.
- Downloads the tarball and extracts it into a **temporary** directory that
  Tarsen owns and cleans up.
- Performs **static** analysis — it reads files as text and matches patterns.
  It never imports, evaluates, or runs the code, and it never runs install
  scripts.
- Detects lifecycle scripts, code execution, sensitive environment access,
  filesystem and network use, obfuscation, missing metadata, very new
  packages, and typosquatting.
- Prints a human report **or** a single valid JSON object.
- For `run`, asks you to type `run` before invoking `npx`, and refuses to
  execute in non-interactive contexts (CI, scripts, piped stdin).

## Why NPX needs a safety layer

`npx some-package` downloads and **executes** a package, often including its
`install`/`postinstall` scripts, with your privileges — before you have any
chance to look at it. That is convenient, but it is also the easiest
supply-chain attack surface in a typical workflow: a typo'd name, a
look-alike package, or a compromised maintainer can run arbitrary code the
moment you press enter.

Tarsen inserts a **check step** in between. You see what the package contains
and what it is rated *before* anything executes.

## Installation

From source (monorepo):

```bash
git clone <this repo> tarsen
cd tarsen
npm install
npm run build
# use it directly:
node packages/cli/dist/index.js check react
# or link the `tarsen` command:
npm link --workspace @tarsen/cli
```

Once published to npm:

```bash
npm install -g @tarsen/cli
```

Requires Node.js >= 20.

## Usage

```bash
# Check a package and print a human-readable report.
tarsen check react
tarsen check create-next-app@16

# Check and emit a single valid JSON object (no colors, no extra logs).
tarsen check react --json

# Check, confirm interactively, then run through npx.
tarsen run create-next-app my-app
```

## CLI commands

| Command | Description |
| --- | --- |
| `tarsen check <package>` | Analyze a package and print a risk report. |
| `tarsen check <package> --json` | Same, but output **only** a valid JSON object. |
| `tarsen run <package> [args...]` | Check, then (after interactive confirmation) run via `npx`. |

`run` requires an interactive terminal and refuses non-interactive execution
(exit code `3`). There is intentionally no `--yes` flag in the MVP.

Cloud/team commands (`login`, `org`, `policy`) are **not** part of the MVP. See
[Roadmap](#roadmap) and [`docs/cloud-roadmap.md`](docs/cloud-roadmap.md).

## Example terminal report

```
Tarsen Risk Report

Package:       react
Version:       19.2.7
Published:     2026-06-01T18:00:48.323Z
Maintainers:   fb, react-bot
Repository:    git+https://github.com/facebook/react.git
Dependencies:  0
Files scanned: 25

Signals:
[i] runtime environment mode access detected in cjs/react-jsx-dev-runtime.development.js (line 12)
[i] runtime environment mode access detected in cjs/react-jsx-runtime.development.js (line 12)

Risk:           LOW (2/100)
Recommendation: safe_to_run
```

Risk bands: `low` → `safe_to_run`, `medium` → `ask_user`,
`high` → `do_not_run_without_user_confirmation`, `unknown` →
`unknown_ask_user` (analysis failed).

## JSON output example

```json
{
  "schemaVersion": "1.0",
  "package": "react",
  "version": "19.2.7",
  "risk": "low",
  "score": 2,
  "recommendation": "safe_to_run",
  "signals": [
    {
      "type": "environment_access",
      "severity": "low",
      "message": "runtime environment mode access detected",
      "file": "cjs/react-jsx-dev-runtime.development.js",
      "evidence": "line 12"
    }
  ],
  "metadata": {
    "name": "react",
    "version": "19.2.7",
    "repository": "git+https://github.com/facebook/react.git",
    "maintainers": ["fb", "react-bot"],
    "dependencies": 0,
    "scripts": {}
  },
  "analyzedAt": "2026-06-23T16:37:26.090Z",
  "stats": { "filesScanned": 25, "bytesScanned": 169358, "truncated": false }
}
```

The JSON Schema is documented in [`docs/report.schema.json`](docs/report.schema.json).
A full example lives in [`examples/sample-risk-report.json`](examples/sample-risk-report.json),
and a suspicious-package walkthrough in
[`examples/suspicious-package-example.md`](examples/suspicious-package-example.md).

## Security model

The rules Tarsen is built around (see [`docs/security-model.md`](docs/security-model.md)):

- **Never executes package code** during analysis.
- **Never runs install scripts** (`preinstall`, `install`, `postinstall`, `prepare`).
- **Extracts tarballs only into temporary directories** it owns.
- **Protects against path traversal** during extraction.
- **Drops symlinks and hardlinks.**
- **Cleans up temporary files** after every run.
- **Does not upload source code anywhere** — no cloud endpoint exists.
- **No cloud connection and no telemetry** in the MVP.
- **Runs `npx` only after explicit user confirmation.**
- **Refuses risky non-interactive execution by default.**
- **JSON mode outputs valid JSON only**, with no extra logs or colors.

Resource limits (tarball size, entry count, scanned bytes, request timeout) cap
analysis against hostile packages; a hit sets `stats.truncated: true` rather
than failing.

## What Tarsen does not do

- It is **not a package manager replacement** — it does not install dependencies,
  resolve trees, or cache modules.
- It is **not a sandbox** — it does not confine what `npx` does *after* you
  confirm.
- It is **not complete static analysis** — it looks for a focused set of
  suspicious signals, not proof of malice. `low` means *no risky static patterns
  were detected*, not *guaranteed safe*.
- It is **not a SaaS or dashboard** — there is no server, no account, no team
  management in the MVP.

## Packages

This repo is a small npm workspace:

- [`@tarsen/core`](packages/core) — static analyzer, risk scoring, report types,
  and safe tarball helpers. Pure local library; no network.
- [`@tarsen/cli`](packages/cli) — the `tarsen` executable: registry fetch, safe
  extraction, terminal/JSON rendering, confirmation gate, and `npx` hand-off.

## Roadmap

The MVP is deliberately small and local-first. Possible **optional, future**
cloud/team features (shared local policy files, opt-in report sync for audit)
are described in [`docs/cloud-roadmap.md`](docs/cloud-roadmap.md). None of them
are required to use Tarsen, and any future cloud feature would stay strictly
opt-in and preserve the local-first contract.

## Contributing

Contributions that keep Tarsen small, local-first, and trustworthy are welcome.

```bash
npm install
npm run build     # builds @tarsen/core and @tarsen/cli
npm test          # runs core + cli unit tests
npm run smoke     # end-to-end check against the real registry (needs network)
```

When adding detection, add a unit test in the relevant
`packages/*/src/*.test.ts`. Keep the JSON report schema stable; if it must
change, bump `schemaVersion`. Do not add cloud, telemetry, or dashboard code to
the core tool.

## License

Apache-2.0. See [LICENSE](LICENSE).
