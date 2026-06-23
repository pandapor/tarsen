# Tarsen security model

Tarsen is a **local-first** CLI safety layer for NPX and package command
execution. Its job is to check an executable npm package *before* it runs, so a
developer or AI agent can make an informed decision instead of blindly executing
`npx some-package`.

This document states the hard rules the implementation is built around.

## What Tarsen guarantees during analysis

- **Never executes package code.** Scanning reads files as plain strings and
  matches patterns. Tarsen never `import`s, `require`s, or evaluates the code
  it inspects.
- **Never runs install scripts.** `preinstall`, `install`, `postinstall`, and
  `prepare` are reported as high-risk *signals*, never invoked.
- **Extracts only into a temporary directory** that Tarsen owns and removes
  in a `finally` block.
- **Protects against path traversal.** Every tarball entry is passed through a
  filter that rejects absolute paths, leading `../` segments, and any entry
  whose resolved path escapes the destination. See
  [`tarsen-core`'s `isTraversalAttempt`](../packages/core/src/tar.ts).
- **Drops symlinks and hardlinks** during extraction and while walking.
- **Cleans up temporary files** after every run, including on failure.
- **Does not upload source code anywhere.** No part of the package leaves the
  machine. There is no cloud endpoint to send to.
- **No cloud connection in the MVP.** No telemetry, no analytics, no auth, no
  account. The only network call is to the public npm registry to fetch
  metadata and the tarball.
- **Runs npx only after explicit confirmation.** `tarsen run` prints a report,
  then requires a human to type `run` before handing off to `npx`.
- **Refuses risky non-interactive execution by default.** If stdin is not a TTY
  (CI, scripts, piped input), `tarsen run` refuses and exits `3`. There is no
  `--yes` escape hatch in the MVP.
- **JSON mode outputs valid JSON only.** `tarsen check <pkg> --json` writes a
  single JSON object to stdout with no colors, no banners, and no extra logs.

## Resource limits

To bound analysis time and memory against a hostile package, Tarsen caps:

| Limit | Value |
| --- | --- |
| Packument (registry metadata) | 20 MB |
| Tarball download | 50 MB |
| Extracted entries | 10 000 |
| Single scanned source file | 2 MB |
| Total scanned source bytes | 30 MB |
| HTTP request timeout | 20 s |

When a limit is hit the report is still produced, with `stats.truncated: true`.

## Risk levels and recommendations

```
risk:            low      -> safe_to_run
                 medium   -> ask_user
                 high     -> do_not_run_without_user_confirmation
                 unknown  -> unknown_ask_user   (analysis failed)
```

`low` is not a promise of safety — it means *no risky static patterns were
detected*. A package can still do harm at runtime; the recommendation tells the
operator how cautious to be.

## What Tarsen is not

- Not a package manager replacement. It does not install dependencies, resolve
  trees, or cache modules.
- Not a sandbox. It does not confine what `npx` does after you confirm.
- Not a complete static-analysis engine. It looks for a focused set of
  suspicious signals, not proof of malice.
- Not a SaaS. There is no server, no dashboard, no team management in the MVP.

## Reporting vulnerabilities

Tarsen itself only fetches from the npm registry and writes to a temp dir it
controls. If you find a way it could execute code, leak data, or write outside
its temp dir, please open a private issue describing the impact.
