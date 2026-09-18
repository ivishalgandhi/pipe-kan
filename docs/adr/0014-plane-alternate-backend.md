# Plane is an alternate backend

`--plane` selects Plane as source of truth. The Board, Refresh, and Move stay the existing `Cli` / `createApp` path. Plane implements that interface with REST (`X-API-Key`, `PLANE_HOST`, workspace slug, project identifiers). Jira is unchanged: no `--plane` still shells jira-cli. We rejected a second UI and scraping/SQL. Modules map to the Epic left rail; workflow states are Columns (empty states kept); `needs-input` is a Card badge; drag-move PATCHes work item state.

## Status

Accepted

## Considered options

- **jira-cli only (ADR-0001)** — rejected for Plane. There is no Plane equivalent of `jira issue move`.
- **Parallel Plane board** — rejected. Refresh and drop already speak `Cli`.
- **Scrape or SQL** — rejected. Out of scope.

## Consequences

- Contradicts ADR-0001 for the Plane path only. Jira write-back is still jira-cli.
- Auth is `PLANE_API_KEY` + `PLANE_HOST`. Do not hardcode the key.
- `--projects` still means project identifiers (`APH,PULSE`). `--workspace` defaults to `personal`.
