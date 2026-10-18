# gbj-20261018-023 pipe-kan Linear look plan

**Scope:** Make pipe-kan's UI match Linear's interface in detail. Plan only — no maker, no merge.

**Branch:** `docs/pipekan-linear-look-plan-20261018`

**Parent release:** 0.34.2 (commit a5f75c5)

## Plan documents

| File | Purpose |
|---|---|
| `spec.md` | Full specification: research summary, gap analysis, design direction, acceptance criteria |
| `tickets.md` | 10 tickets with owns, deps, acceptance criteria, verification steps, and ordering |
| `icon-spec.md` | Size/stroke/colour/state specification for all small icons |

## What this plan covers

1. **Views** — Issues/Projects tabs, Personal vs workspace views, per-view icons, "New view" create flow with Save to Personal/team, filter bar.
2. **Full Add Filter menu** (`F` shortcut) — AI filter, Advanced filter, Status, Status type, Assignee, Agent, Creator, Priority, Estimate, Labels, Relations, Suggested label, Dates, Project, Project properties, Initiative, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template.
3. **"Move to project" picker** (`Shift+P`) — search, checkmark, hover cards.
4. **Inbox** — unread count badge, notification list.
5. **Left sidebar** — Workspace (Projects/Views/Initiatives/More); Favorites with folders, nested items, drag, add-folder icon; Your teams (Home/Triage/Issues/Cycles/Projects/Views); Try/Invite/Connect footer.
6. **Icon spec** — all small icons with size, stroke, colour tokens, and states.

## Ticket summary

| Ticket | Title | Notes |
|---|---|---|
| T1 | Views: Issues/Projects tabs, view browser, "New view" create flow | UI-only; extends `SavedView` |
| T2 | Full Add Filter menu (`F` shortcut) | 21 rows; backend rows active, rest disabled |
| T3 | "Move to project" picker (`Shift+P`) | Searchable picker with hover detail card |
| T4 | Inbox with unread count | Synthetic notifications; badge from `needs-input` |
| T5 | Left sidebar: Workspace, Favorites with folders, Your teams, footer | Restructure sidebar hierarchy |
| T6 | Icon spec implementation | Formalise and apply icon spec |
| T7 | Fake-data smoke test (synthetic fixtures only) | Fixtures + screenshots + console log |
| T8 | UI-specialist review gate | Opus UI specialist + Kimi Referee |
| T9 | Performance guard | Budgets: cold load +50ms, switch +30ms |
| T10 | Docs stage ticket | Update CONTEXT.md and README |

## Rules

- No code changes outside docs (plus `.gitignore` line for `linear-refs-local/`).
- Fake data only in specs/tests (`Acme Demo`, `DEMO-12`, etc.).
- Local screenshots in `linear-refs-local/` are untracked and never committed.
- Neutral terms only; no vendor/hardware names in committed files.
