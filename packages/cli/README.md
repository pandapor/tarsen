# tarsen-cli

The `tarsen` command — checks executable npm packages **before** they run. Part
of [Tarsen](../../README.md), a local-first CLI safety layer for NPX.

```bash
npm install --global tarsen-cli
tarsen check react
tarsen check react --json
tarsen run create-next-app my-app
```

## Commands

| Command | Description |
| --- | --- |
| `tarsen check <package>` | Analyze a package and print a risk report. |
| `tarsen check <package> --json` | Output **only** a valid JSON object. |
| `tarsen run <package> [args...]` | Check, then run via `npx` after interactive confirmation. |

`<package>` is an npm registry spec, e.g. `react`, `react@18`, or
`create-next-app@16.2.9`.

## How `check` works

1. Fetches the package's metadata and tarball **from the public npm registry**.
2. Extracts the tarball into a **temporary directory** Tarsen owns, rejecting
   path traversal and dropping symlinks/hardlinks.
3. Scans the extracted source as **strings** (never executes it, never runs
   install scripts).
4. Scores the signals and prints a report.
5. Removes the temporary directory.

## How `run` works

`run` does everything `check` does, then:

- Prints the report.
- **Refuses** if stdin is not a TTY (exit code `3`) — there is no `--yes`.
- Otherwise asks you to type `run`.
- Only then spawns `npx --yes <package> [args]` with `shell: false`.

## Safety properties

- Never executes package code or install scripts during analysis.
- Extracts only into a temp dir it cleans up.
- Protects against path traversal; drops links.
- No cloud connection, no telemetry, no account.
- `npx` runs only after explicit confirmation.
- `--json` emits a single valid JSON object with no colors or extra logs.

See [`docs/security-model.md`](../../docs/security-model.md) for the full model.

## Development

```bash
npm install            # from repo root
npm run build --workspace tarsen-cli
npm test --workspace tarsen-cli
```

The pipeline (`src/pipeline.ts`), renderer (`src/render.ts`), confirmation gate
(`src/confirm.ts`), and Commander wiring (`src/index.ts`) are intentionally
small and separately testable.

## License

Apache-2.0. See [LICENSE](../../LICENSE).
