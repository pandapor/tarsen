# Tarsen

Tarsen checks npm packages before they run. The CLI downloads the selected package tarball, extracts it into a temporary directory without executing lifecycle scripts, performs static analysis, deletes the temporary files, and only invokes `npx` after an interactive user types `run`.

## Install from the generated packages

```bash
npm install
npm run package
npm install -g ./outputs/tarsen-core-0.1.0.tgz ./outputs/tarsen-cli-0.1.0.tgz
```

After the packages are published, installation becomes:

```bash
npm install -g @tarsen/cli
```

## Use

```bash
tarsen check react
tarsen check react --json
tarsen check create-next-app@16.2.9
tarsen run create-next-app my-app --typescript
tarsen policy test create-next-app --file ./examples/team-policy.json
tarsen ci react create-next-app --policy ./examples/team-policy.json
```

`--json` writes one valid JSON object and no colors or human logs. Registry or analysis failures return an `unknown` report and exit code 2. `run` refuses non-interactive execution and never uses a shell.

## What it detects

- `preinstall`, `install`, `postinstall`, and `prepare` lifecycle scripts;
- child processes, shell execution, `eval`, and dynamic `Function` construction;
- sensitive environment-variable access;
- filesystem reads, writes, and deletion;
- HTTP, fetch, Axios, XHR, and WebSocket access;
- unusually long/minified lines and encoded payloads;
- basic one-edit typosquatting against common package names;
- missing repositories and maintainers.

Safety limits cap registry responses, tarballs, extracted entries, individual source files, total scanned bytes, and network time. Symlinks and hardlinks are ignored during extraction.

## Packages

- `@tarsen/core`: static analyzer, risk scoring, report types, and team policy engine.
- `@tarsen/cli`: `tarsen` executable and npm registry/tarball pipeline.
- `@tarsen/web`: supporting Next.js product site; it is not required by the CLI.

The machine-readable contract is documented in [`docs/report.schema.json`](docs/report.schema.json).
