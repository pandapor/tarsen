# tarsen-core

Static npm package analysis for [Tarsen](../../README.md). Tarsen checks
executable npm packages **before** developers or AI agents run them.

`tarsen-core` is a pure local analyzer. It **never executes package code**,
**never runs install scripts**, and **has no cloud connection or telemetry**.
It turns registry metadata and extracted source files into a stable JSON risk
report that the CLI (or any other tool) can render.

## What it provides

- **Registry metadata parsing** (`parseMetadata`) — normalize a version manifest
  and packument into a typed `PackageMetadata`.
- **Static file scanning** (`scanContent`, `scanFiles`) — pure string pattern
  detection for child processes, dynamic execution, env/filesystem/network
  access, and obfuscation. Never imports or evaluates the code it scans.
- **Safe tarball helpers** (`isTraversalAttempt`, `makeSafeFilter`) — reject path
  traversal, drop symlinks/hardlinks, and enforce entry caps during extraction.
- **Risk scoring** (`scoreSignals`, `riskLevel`, `recommend`) — deterministic
  mapping from signals to a `low | medium | high | unknown` band and a
  recommendation.
- **Report contract** (`RiskReport`, `analyzePackage`, `unknownReport`) — the
  schema emitted by `tarsen check --json`.

## Detection scope

Lifecycle scripts (`preinstall`, `install`, `postinstall`, `prepare`),
`child_process` / `exec(` / `spawn(` / `execSync(` / `spawnSync(`, `eval(` /
`Function(`, sensitive `process.env`, `fs.readFile` / `fs.writeFile` / `fs.rm` /
`fs.unlink`, `os.homedir(`, `fetch(` / `http.request` / `https.request` /
`axios` / `XMLHttpRequest` / `WebSocket`, large minified files, very long
lines, base64-like blobs, missing repository/maintainers/description, very new
packages, and one-edit typosquatting against common package names.

## Usage

```ts
import { analyzePackage, parseMetadata } from "tarsen-core";

const metadata = parseMetadata(manifest, packument);
const report = analyzePackage(metadata, [
  { path: "index.js", content: "require('child_process').exec('whoami')" },
]);
// report.risk === "high"
```

## Safety guarantees

This package only ever reads strings. It does not fetch from the network,
execute code, or write anywhere — those concerns live in `tarsen`. The tar
helpers are pure predicates and filter factories; the actual extraction is
driven by the CLI into a temporary directory that it owns and cleans up.

## License

Apache-2.0. See [LICENSE](../../LICENSE).
