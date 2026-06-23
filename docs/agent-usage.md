# Using Tarsen with AI agents

AI agents frequently run `npx` to scaffold projects, run one-off tools, or
execute generators. That is exactly the situation Tarsen exists for: an
untrusted or unfamiliar package is about to run with the agent's privileges.

Tarsen gives an agent a **machine-readable** view of the risk *before* anything
executes.

## The safe pattern

Instead of:

```
npx some-package --flag
```

an agent should:

```bash
# 1. Check first, as JSON, and read the recommendation.
tarsen check some-package --json

# 2. Only if the recommendation is acceptable, run it.
tarsen run some-package --flag
```

## Reading the JSON report

```jsonc
{
  "schemaVersion": "1.0",
  "package": "some-package",
  "version": "1.4.2",
  "risk": "medium",                       // low | medium | high | unknown
  "score": 14,                            // 0-100
  "recommendation": "ask_user",           // safe_to_run | ask_user | do_not_run_without_user_confirmation | unknown_ask_user
  "signals": [ /* per-file risk signals */ ],
  "metadata": { /* name, version, maintainers, repository, scripts, ... */ },
  "stats": { "filesScanned": 42, "bytesScanned": 12345, "truncated": false }
}
```

The field an agent should gate on is `recommendation`:

| `recommendation` | Agent behavior |
| --- | --- |
| `safe_to_run` | Low static risk; proceeding is reasonable. |
| `ask_user` | Some risk detected; surface the report and ask the human. |
| `do_not_run_without_user_confirmation` | High-risk signals (lifecycle scripts, code execution, etc.). Do not auto-run. |
| `unknown_ask_user` | Analysis failed; treat as untrusted and ask. |

## Important: `tarsen run` is interactive

`tarsen run` requires a human to type `run` on a TTY. An agent running in a
non-interactive context (CI, sandbox, piped stdin) will get exit code `3` and
the run will be refused. This is deliberate: **Tarsen never auto-executes a
package it just flagged.**

For autonomous agents, the intended flow is:

1. `tarsen check <pkg> --json` and read `recommendation`.
2. If acceptable, the agent may call `npx` directly — but it should treat a
   `high`/`unknown` recommendation as a hard stop and ask the operator.
3. Reserve `tarsen run` for interactive terminals where a human confirms.

## Detection scope

`check` looks for lifecycle scripts, `child_process`/`exec`/`spawn` family
calls, `eval`/`Function`, sensitive `process.env`, filesystem reads/writes/
deletes, `os.homedir`, network access (`fetch`, `http.request`, `axios`, XHR,
WebSocket), minified/very-long/base64-like content, missing repository or
maintainers, very new packages, and one-edit typosquatting. See
[`docs/security-model.md`](./security-model.md) for the full guarantees.

## What Tarsen will not do for an agent

- It will not auto-install or auto-run a flagged package.
- It will not upload the package or the report anywhere.
- It will not bypass its own confirmation gate programmatically.
