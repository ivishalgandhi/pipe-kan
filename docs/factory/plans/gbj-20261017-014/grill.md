# grill.md — gbj-20261017-014 pipecan linear ui

## Open questions for Vishal

### Q1. First-slice view mode: List vs Board default?
Linear defaults to a dense **list view** (Inbox / My Issues). Pipe-kan today is board-only.
Should the first slice add a **List view toggle** (Board | List tabs, like Linear's `Cmd/Ctrl B`), or should we restyle the existing Kanban first and defer list view to a later ticket?
- Risk: List view needs a new `IssueList` component, virtual scrolling, and column sort headers. Significant scope increase.
- Safe path: Keep Board as default; add List view in T2 or T3.

### Q2. Issue "peek" (Space to preview) — inline or side pane?
Linear's "peek" is a transient modal (Space on a row, Escape to dismiss) that shows the full issue without navigating away. Pipe-kan today has a persistent right-side Open pane.
Should "peek" mean:
- **(a)** Restyle the existing Open pane to look like Linear's detail sidebar (properties rail, cleaner typography), OR
- **(b)** Add a new `PeekOverlay` that opens on Space/Escape over the current board, separate from the existing Open pane?
- Risk: (b) duplicates view logic. (a) is a restyle of existing surface.

### Q3. Properties rail — which properties are in scope?
The Open pane today shows: Key, Summary, Jira URL, Priority, Assignee, Due date, Target end, Labels.
Linear's detail view shows: Status, Assignee, Labels, Project, Cycle, Estimate, Priority, Due date, Sub-issues, Relations, Activity, Git integrations.
Which of these should the properties rail include in the first slice?
- Must-have (restyle existing): Status, Assignee, Labels, Priority, Due date, Target end.
- Questionable: Sub-issues / children list (epic children already exist in pipe-kan but are not shown in the Open pane). Should children be rendered in the rail?
- Out of scope for first slice: Cycle, Estimate, Relations, Activity feed, Git integrations — pipe-kan has no data model for these.

### Q4. Dark theme — is the existing dark mode sufficient, or does it need a token overhaul?
Pipe-kan already has `.dark` CSS variables (`src/index.css`) with a reasonably close palette (`#121213` surface, `#09090a` sidebar, `#6d78d5` primary). The Linear research doc confirms these are directionally correct.
Should the first slice:
- **(a)** Audit and tighten tokens (e.g., change `--sidebar-accent` to match Linear's row-selected `#ffffff08` overlay, add `--bg-border-color`, adjust radius tokens), OR
- **(b)** Leave tokens as-is and focus on component chrome (card shape, header pills, row density)?

### Q5. Taskwarrior as a source — what phase?
The card mentions "Jira, Plane, Taskwarrior, or anything they pipe into" as sources. Taskwarrior has no REST API; it would need a CLI parser (`task export`) and a new backend module (`taskwarrior.ts`) alongside `jira-config.ts`, `plane.ts`, etc.
Should Taskwarrior backend be:
- **(a)** A separate ticket after the Linear UI is complete (ui-first, sources-later), OR
- **(b)** Part of the same slice because the UI needs to know what fields Taskwarrior provides (no assignee, no labels as such, status is `pending`/`completed`/`deleted`)?
- Recommendation: defer to later slice. The Linear UI should be source-agnostic.

### Q6. Smoke test data — should we extend fixtures?
Vishal's new rule: smoke test with fake data, logs attached to PR. The existing `fixtures/issues.json` seeds Fake Jira. Should we:
- **(a)** Add a `fixtures/plane.json` for Plane-mode smoke testing (the README says Plane mode does not show fixtures after a failed refresh), OR
- **(b)** Extend `fixtures/issues.json` with richer labels, priorities, and assignees so the restyled cards have data to render?

### Q7. REA clone — still needed?
The card says "Use REA (reverse-engineering-anything; github.com/morluto/rea) — clone into ~/code/FOSS if required." The existing `docs/research/linear-ui.md` already contains extracted tokens from Linear's CSS. Is REA still required, or is the existing research sufficient for planning?
- My assessment: the existing research is sufficient for the plan. REA may be useful for the operator if they need pixel-perfect measurements of specific components (e.g., the exact padding inside the issue peek modal). Recommend deferring REA clone until operator phase if needed.

### Q8. Agent panel chrome — in scope or preserve?
The Agent sidepanel (`src/components/agent/agent-panel.tsx`) is a separate surface with its own chat UI, tool cards, and permission flows. Should it be restyled to match Linear's visual language in the first slice, or is it out of scope?
- Risk: Agent panel has complex internal components (message bubbles, tool cards, attachment chips). Restyling it is non-trivial.
- Safe path: Exclude Agent panel from first slice; restyle only Board + Sidebar + Open/Peek surfaces.

### Q9. Calendar tab — restyle or preserve?
The Calendar tab (`src/components/board-calendar.tsx`) uses FullCalendar with custom CSS. Should it be restyled to match Linear's density/spacing, or is it acceptable as-is?
- Linear has no calendar view; this is a pipe-kan-specific feature.
- Safe path: Minimal restyle (background, border-radius, typography tokens) but keep FullCalendar structure.

### Q10. Command overlay — restyle to Linear's quick-search?
Linear's command palette (`Cmd/Ctrl K`) is a centered overlay with a search input, grouped results, and keyboard navigation. Pipe-kan's `CommandOverlay` is already close in structure.
Should it be restyled in the first slice to match Linear's exact chrome (28px pills, muted hover `#ffffff08`, indigo accent for selected row)?
- Recommendation: Yes, low effort, high visual impact.

## Maker decisions (2026-10-18)

Conservative choices. No new data model fields.

- Q1. Board stays the default. No list view in this slice.
- Q2. Restyle the existing Open pane. No separate peek overlay.
- Q3. The rail shows status, assignee, labels, priority, due date, and target end. Epic children stay off the rail.
- Q4. Tokens were tightened. Dark `--sidebar-accent` and `--accent` are `#ffffff08` (ticket T4). The spec color table's solid dark accent `#1c1c1d` was not used.
- Q5. No Taskwarrior backend.
- Q6. `fixtures/issues.json` was extended. No Plane fixture file.
- Q7. No REA clone. `docs/research/linear-ui.md` was enough.
- Q8. Agent panel is unchanged.
- Q9. Calendar keeps FullCalendar. Wrapper, toolbar, and event type use the surface tokens.
- Q10. Command overlay was restyled. Keyboard behavior is unchanged.
