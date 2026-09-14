# gbj-20260913-005 — Target End Date on Cards + Calendar sidebar

## Intent

Show work-Jira **Target End Date** on Cards after Refresh. Add a read-only FullCalendar sidebar of Issue **created** and **target end**. Does not replace the Board.

## Research

Cited from job card `gbj-20260913-005` (research: ok). Not re-run.

- `jira issue list --raw` remashals through jira-cli `IssueFields` and **drops** `customfield_*` / `duedate`. Named `"Target End Date"` keys exist only in fixtures.
- `jira issue view KEY --raw` is `ProxyGetIssueRaw` (HTTP GET `/issue/{key}` body) and **keeps** custom fields. Open already uses this (ADR-0005). `Cli.view` exists.
- Field ids are instance-specific. Resolve by **name**: exact `Target End Date`, then `Target End` / `Target end`. Never Target Start. Persist id locally (Filter-chrome class). Never git a work-Jira id, site URL, or token.
- Greedy “first date-shaped `customfield_*`” is wrong (Target Start / other pickers).
- `issueTargetEnd` stores `formatTargetEnd` display strings (`"Oct 15, 2026"`), which breaks ISO calendar/math. Store ISO; format at render.
- Calendar: official `@fullcalendar/react` + dayGrid (free). Shadcn-themed via existing CSS variables. No Premium/scheduler. Not ReUI Event Calendar.
- Target End Date ≠ system `duedate`.

## Plan

1. **Map by name, store ISO.** `issueTargetEnd` reads exact / alias names, then a names map (`customfield_*` → name from view-raw), then a locally persisted id. Remove greedy date scan. `Card.targetEnd` is `YYYY-MM-DD`.
2. **Refresh hydrate.** After list/epics/children, `jira issue view KEY --raw` for unique keys with bounded concurrency (same cap as children). Merge `fields` + `names` into the list-shaped row. Persist discovered id locally (not git). One view failure does not fail Refresh.
3. **Calendar sidebar.** Left-pane FullCalendar month; all-day events from visible Cards’ `created` and `targetEnd`; distinct colors; click Opens. Read-only.
4. **Docs.** CONTEXT Card language + Calendar term. ADR for mapping + calendar. PQC: `bun test`, `bun run typecheck`, `bun run build`.

## Tests

- Named Target End Date **and** decoy Target Start customfield → only Target End.
- List-shaped JSON without `"Target End Date"` key, hydrated from view-raw-shaped `customfield_*` + names.
- Calendar smoke: created + target end events.
