# ADR 0019: Linear parity views, multi-select scope, and source switch

Plane mode grows Initiatives, Projects, and Timeline views, and the sidebar switcher checks more than one Workspace and Project. Jira write-back is unchanged: still only jira-cli.

## Context

ADR-0016 types a single Workspace slug and rewrites `--projects` to that tenant. The Linear switcher instead checks a list. `work` and `personal` both contain a project named PULSE, so a merged Board cannot use bare keys. Users also switch Plane and Jira without restarting the process. Taskwarrior is a visible source that this repo does not connect.

## Decision

- The sidebar header is the switcher in every source. It checks Source, Workspace, and Project. CLI `--plane`, `--workspace`, `--workspaces`, `--scopes`, and `--projects` are the startup selection. The switcher writes those flags back and refreshes.
- `--workspace` stays the first checked slug. `--projects` stays the unique project identifiers. `--scopes` is `workspace/PROJECT` pairs.
- With more than one Workspace in the catalog, issue and module keys are prefixed `slug/KEY`. One Workspace keeps bare keys.
- Plane catalog reads stay serial, cached, and trailing-slash. The UI waits briefly before refresh so checking several rows does not burst the ~60 request/minute budget.
- `POST /api/source` rebuilds the Board app in the running server. Jira still moves and edits through jira-cli (`-a` assignee, `--priority` priority). Plane assignee and priority use the Plane REST API. There is no direct Jira REST write-back.
- Taskwarrior is listed and disabled: "Taskwarrior is not connected". Jira without jira-cli stays enabled and uses Fake Jira.
- Initiative and Project health is synthetic from status and target date. Plane has no health field.
- `PLANE_FIXTURE=synthetic` (or a JSON path) serves a fake catalog for smoke. It is not used unless that env is set.
- Display options, view filters, saved views, and Favorites are local storage. They do not change Scope.

ADR-0016 still describes the typed-slug commit helper. Its header pill and single-tenant `--projects` rewrite are superseded here when the user checks more than one row.

## Consequences

- `work/PULSE` and `personal/PULSE` can sit on one Board.
- A process that was started with `--plane` can show the Fake Jira or jira-cli Board after a source switch, and the reverse.
- Smoke (`bun run smoke`) is the check that the merged view, source switch, filters, row menu, command palette, and Initiatives/Projects/Timeline helpers work on synthetic data.
