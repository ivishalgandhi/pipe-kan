# Refresh confirms all Epics or the focused Epic

Header Refresh, Command Refresh, and the Agent Action `refresh_board` open one AlertDialog before `POST /api/refresh`. The user chooses all Epics (today's full list and children-cache replace, ADR-0007) or the focused left-pane Epic. Selected merges that Epic's works into the children cache and does not rewrite Scope to `-P`. Cancel sends nothing. Move / create / edit follow-on Refresh stays a silent full Refresh. We rejected a second HTTP path and treating Card multi-select as Epic selection.

## Status

Accepted

## Considered options

- **Silent Refresh** — rejected. Header, Command, and Agent could replace the Board with no warning.
- **Always every Epic** — rejected. The focused Epic's works can update without listing every other Epic.
- **Selected rewrites Scope to `-P`** — rejected. Focusing an Epic is not a Scope change.
- **Card multi-select as Refresh targets** — rejected. Selected is the focused left-pane Epic.

## Consequences

- `/api/refresh` accepts `{ scope: "all" | "selected", epicKeys?, flags }`. Omitted `scope` is all.
- Agent `refresh_board` yields a confirm UI action instead of calling `app.refresh`.
