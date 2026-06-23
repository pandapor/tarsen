# Cloud / team roadmap

Tarsen is **local-first**. The public, open-source project is a CLI that checks
npm packages on your machine — no account, no server, no telemetry. That is not
going to change for the core tool.

This page exists only to record that **optional** cloud and team features are
*possible future work*, not part of the current MVP, and not required for
Tarsen to be useful.

## Current state (MVP)

- `tarsen check <package>` and `tarsen check <package> --json`
- `tarsen run <package> [args...]` with an interactive confirmation gate
- Fully local analysis; no network except the public npm registry
- No login, no organization, no policy server, no dashboard

## Possible later (not promised)

If cloud/team features are ever added, they would be **strictly optional**
add-ons layered on top of the local CLI. Ideas under consideration:

- A shared **policy** format teams can version-control and apply locally, e.g.
  `tarsen policy test <pkg> --file team-policy.json`, turning Tarsen's local
  recommendation into an allow/warn/block decision per team rules.
- An opt-in **report sync** for organizations that want a central audit trail —
  sending only summarized *signals*, never package source code, and only when
  explicitly configured via environment variables.
- Commands that might eventually appear: `tarsen login`, `tarsen org`,
  `tarsen policy pull`. **None of these exist today** and none would be required
  to use Tarsen.

Any such feature would preserve the local-first contract:

- The CLI keeps working fully offline with no account.
- No source code is ever uploaded.
- Cloud features are opt-in and never weaken the confirmation gate.

## How to think about this repo

Today this repository is, and should remain, a small trustworthy CLI. Do not
add hosted backend code, dashboard code, or cloud commands here as if they were
core. If team/cloud features land, they will be clearly optional and documented
as such.
