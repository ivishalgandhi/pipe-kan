# Taskwarrior is a local source via strict-argv CLI

Taskwarrior becomes a selectable source in pipe-kan. It reads from and writes to a local Taskwarrior 3.x replica using the `task` binary with `execFile` argv arrays. No shell strings. No direct TaskChampion API in this slice.

## Status
Accepted

## Considered options

- **TaskChampion sync server REST API** — rejected for the first slice. The sync server protocol is internal and not stable for client use. The `task` CLI is the stable public interface.
- **Taskwarrior 2.x JSON import/export files only** — rejected. File-based read/write would race with other Taskwarrior processes and lose atomicity. The `task` CLI handles locking.
- **Shell strings with `exec`** — rejected. The April 2026 command-injection fix in `taskwarrior-web-ui` proved shell strings are unsafe. `execFile` with argv arrays is the only acceptable path.
- **Write-back through `task` CLI; read via `task export`** — accepted. This mirrors ADR-0001 (write-back through jira-cli) for the Taskwarrior path. The Board's `Cli` interface already abstracts refresh/move/create/edit; the Taskwarrior adapter implements it with `task` subcommands.

## Consequences

- The host running pipe-kan must have `task` (Taskwarrior 3.x) on PATH and a valid `TASKDATA`.
- All user input that reaches argv (description, project, tags, UUID) is validated before argv construction. Rejected input shows a toast; it never reaches the CLI.
- Hostile-input tests are mandatory for every argv builder.
- The adapter does not implement `task` subcommands that delete data permanently (e.g., `task delete` is not exposed through Move; Done uses `task done`).
- A throwaway `TASKDATA` is used in tests and smoke; never the operator's real task database.
- `TASKWARRIOR_FIXTURE` env serves synthetic data for first paint and smoke, same pattern as `PLANE_FIXTURE`.
- The source is single-user and local. Multi-device sync is a later concern (TaskChampion sync server or file sync).
