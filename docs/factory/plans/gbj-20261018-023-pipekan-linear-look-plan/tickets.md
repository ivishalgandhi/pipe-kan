# tickets.md — gbj-20261018-023 pipe-kan Linear look plan

## Status

| Ticket | Status |
|---|---|
| T1 Views | done |
| T2 Add Filter | done. The named list is 23 rows; the "21" in the ticket text under-counts that list. |
| T3 Move to project | done. Local assignment plus refresh. No remote project write. |
| T4 Inbox | done |
| T5 Sidebar | done. Existing Board openers stay under a Board section. |
| T6 Icons | done. Connect GitHub uses `GitFork` because this Lucide build has no `Github` export. |
| T7 Smoke | done |
| T8 UI review | maker checklist written. Independent specialist review is still pending. |
| T9 Performance | done. See `perf.md`. |
| T10 Docs | done |

## Dependencies
- gbj-20261017-014 (board/sidebar/command restyle) — design tokens on `main`.
- gbj-20261018-019 (Initiatives/Projects/Timeline/Display options/Workspace switcher) — functional parity on `main`.
- This slice is **UI chrome and layout only**; it builds on top of 019's data model.

---

### T1 — Views: Issues/Projects tabs, view browser, "New view" create flow

**What**
Redesign the "Views" sidebar button to open a view browser instead of the filter menu. Add a "New view" composer overlay with icon selector, title, description, Issues/Projects tabs, Save to Personal/team, filter bar, and Create view button.

**Why**
Linear's top-level navigation is view-centric. pipe-kan currently has no concept of saved named views beyond the `SavedView` filter snapshot.

**Files**
- `src/App.tsx` — change "Views" nav button behaviour, add view browser state
- `src/components/linear-views.tsx` — new `ViewBrowser`, `ViewComposer` components; extend `ViewFilterEditor`
- `src/parity.ts` — extend `SavedView` with `icon`, `description`, `scope` ("personal" | team)

**Acceptance**
1. Sidebar "Views" button opens a view browser panel (not filter).
2. View browser shows two groups: "Personal" and workspace-named group.
3. Each view row shows icon + name + owner badge ("Personal" or team name).
4. "New view" button opens a composer overlay.
5. Composer has: icon selector (grid of 8 Lucide icons), title input, description textarea, Issues | Projects tabs, "Save to" dropdown (Personal / team), filter bar with chips from current `viewFilter`, "Create view" primary button.
6. Creating a view writes to `SAVED_VIEWS_KEY` with the new fields.
7. Fake data only: use "Acme Demo", "DEMO-12" in screenshots/tests.
8. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T2 — Full Add Filter menu (`F` shortcut)

**What**
Replace the current Filter dropdown with a full Add Filter menu matching Linear's 21-row list. Each row has an icon, label, and chevron. Backend rows open submenus with values; non-backend rows are disabled/dimmed.

**Why**
Linear's filter discoverability is a major UX advantage. Current pipe-kan filter only covers 5 fields.

**Files**
- `src/components/linear-views.tsx` — new `AddFilterMenu` component; extend `RowContextMenu`
- `src/App.tsx` — wire `F` keydown to open/close Add Filter
- `src/parity.ts` — add placeholder filter fields to `ViewFilter` (no-op keys for Agent, Creator, Estimate, Relations, Suggested label, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template)

**Acceptance**
1. Pressing `F` (when not in a text field) opens the Add Filter menu.
2. Menu has 21 rows in this order: AI filter, Advanced filter, Status, Status type, Assignee, Agent, Creator, Priority, Estimate, Labels, Relations, Suggested label, Dates, Project, Project properties, Initiative, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template.
3. Each row: 32px height, 16px icon left, label 13px/450, chevron right.
4. Backend rows (Status, Status type, Assignee, Priority, Labels, Dates, Project, Project properties, Initiative) open a submenu popover with values.
5. Non-backend rows are `opacity-50` and show a tooltip "Coming soon" on hover.
6. AI filter row opens a small composer prompt: "Describe what you want to filter..." (no backend; just UI).
7. Advanced filter row opens the existing facet toggle UI.
8. Submenus close on Escape or clicking outside.
9. Selected filters render as chips in the filter bar under the view tabs.
10. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T3 — "Move to project" picker (`Shift+P`)

**What**
Add a searchable project picker that can be triggered from the row context menu or by `Shift+P` when an issue is selected. Shows projects with checkmark, hover detail card, and "No project" option.

**Why**
Linear lets users quickly re-scope an issue to a different project without editing Scope flags.

**Files**
- `src/components/linear-views.tsx` — new `ProjectPicker` component
- `src/App.tsx` — wire `Shift+P` shortcut; add picker to row menu actions
- `src/parity.ts` — no changes needed (uses existing `ParityProject`)

**Acceptance**
1. `Shift+P` opens the project picker when an issue card is hovered or open.
2. Picker is a 320px wide popover with search input at top.
3. "No project" row at top with count `0`.
4. Section header "Projects in {team} team" (use fake team name "Acme-product").
5. Each row: 36px height, project icon (14px cube), name (13px), checkmark on current project.
6. Hovering a row shows a detail card to the right (absolute positioned, 240px wide):
   - Project identifier chip (e.g. "P-DEMO-12").
   - Project name.
   - Status badge (Backlog / In Progress / Done).
   - Owner avatar + name.
   - Priority dot + label.
   - Progress bar (percentage).
   - Issue count.
7. Selecting a project updates the issue's project scope and triggers refresh.
8. Bottom has "+ New project" button and "Create new project..." link (both no-op with tooltip).
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T4 — Inbox with unread count

**What**
Add an Inbox sidebar item with a badge count. Clicking opens an Inbox list view in the main canvas. Notifications are synthetic.

**Why**
Linear's Inbox is a core navigation item and drives engagement. pipe-kan has no notification surface.

**Files**
- `src/App.tsx` — add Inbox nav item, Inbox canvas view, badge state
- `src/components/linear-views.tsx` — new `InboxList` component
- `src/parity.ts` — add `InboxNotification` type (synthetic)

**Acceptance**
1. Sidebar shows "Inbox" item below workspace pill, above "Pulse".
2. Badge shows a count (synthetic: number of issues with `needs-input` label, capped at 9+).
3. Badge is 16px height, rounded-full, `bg-primary text-primary-foreground`, 10px font, positioned right of label.
4. Clicking Inbox sets `sidebarPage` to `"inbox"` and shows `InboxList` in main canvas.
5. Inbox list shows ≥5 synthetic notifications:
   - Avatar placeholder (20px circle, initials).
   - Text: "DEMO-12 was updated" or "DEMO-3 assigned to you".
   - Timestamp (e.g. "2h ago").
6. Each row is 48px height, hover wash, clickable to open the issue.
7. Header has "Inbox" title + "..." menu with "Mark all read" (clears badge).
8. Empty state: "You're all caught up" with a checkmark icon.
9. In Jira mode, Inbox is visible but uses Jira issue keys.
10. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T5 — Left sidebar: Workspace, Favorites with folders, Your teams, footer

**What**
Restructure the left sidebar to match Linear's hierarchy: Workspace section, Favorites with folder support (drag-to-file, add-folder icon), Your teams with nested nav, and footer (Try, Invite, Connect).

**Why**
Current sidebar is a flat list of openers. Linear's grouped hierarchy is more scannable and supports favourites organisation.

**Files**
- `src/App.tsx` — restructure sidebar nav JSX
- `src/components/linear-views.tsx` — extend `FavoriteRows` with folder UI; add `TeamNav`, `SidebarSection`
- `src/visible.ts` — extend `LinearFavorite` with `folder?: string` support (or reuse `FavouriteFolder`)

**Acceptance**
1. Sidebar top: Inbox, Pulse, Agent.
2. "Workspace ▾" section with items: Projects, Views, Initiatives, More.
   - Clicking "More" expands to show Teams, Settings (no-op).
3. "Favorites ▾" section:
   - Shows existing `linearFavorites` grouped by folder.
   - Each folder is a collapsible row with folder icon + name + item count.
   - Folder children are indented 16px.
   - Dragging a favorite onto a folder files it there.
   - Add-folder icon (`+` in a folder icon) at bottom opens a inline input to name the folder.
   - Empty folders show "Empty folder" muted text.
4. "Your teams ▾" section:
   - Team row with avatar + name + collapse chevron.
   - Nested items: Home, Triage (with count), Issues, Cycles (▾ with Current/Upcoming), Projects, Views.
   - Counts are synthetic (e.g. Triage shows "15").
   - Cycles sub-items are disabled with "Coming soon" tooltip.
5. Footer: "Try ▾", "+ Invite people", "Connect GitHub".
   - All are muted, 12px, no-op with tooltip.
6. Section headers are 11px uppercase, muted, with ▾/▸ toggle.
7. Nav items are 28px height, 8px radius, with 16px icon left.
8. Active item uses `bg-sidebar-accent`.
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T6 — Icon spec implementation

**What**
Formalise and implement the small icon spec for status, priority, project, cycle, label dots, avatar, and nav icons. Document in `icon-spec.md` and apply to components.

**Why**
Inconsistent icon sizing creates visual noise. A spec ensures every small icon follows the same stroke, size, and colour rules.

**Files**
- `docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan/icon-spec.md` (new)
- `src/index.css` — add icon tokens if needed
- `src/components/linear-views.tsx`, `src/App.tsx` — apply spec to existing icons

**Acceptance**
1. `icon-spec.md` exists and documents:
   - Status circles: 14px, stroke 1.5px, hollow/filled rules per state.
   - Priority flags: 12px, stroke 1.5px, colour per level.
   - Project cube: 14px, stroke 1.5px, `--muted-foreground`.
   - Cycle clock: 12px, stroke 1.5px, `--muted-foreground`.
   - Label dot: 8px filled circle, same colour as label.
   - Avatar: 20px circle, 1px `--border` stroke, fallback initials 10px.
   - Nav icon: 16px, stroke 1.5px, `--muted-foreground` idle, `--foreground` active.
2. All existing status dots in `RoadmapTable`, `IssueGroupList`, and `IssueCard` use 14px.
3. All existing priority indicators use 12px.
4. Label pills optionally show an 8px dot before the text.
5. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T7 — Fake-data smoke test (synthetic fixtures only)

**What**
Create or extend synthetic fixtures to include all data needed for the new UI: views with icons, inbox notifications, team hierarchy, favorite folders.

**Why**
Vishal's rule: smoke test with fake data only. No live Plane/Jira credentials in tests or docs.

**Files**
- `fixtures/plane-linear-look.json` (new) — synthetic Plane catalog with views, notifications, teams
- `fixtures/jira-linear-look.json` (new) — synthetic Jira data for Jira-mode verification
- `docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan/smoke-log.md` (new)

**Acceptance**
1. Fixture contains ≥3 saved views with icons, descriptions, and Personal/workspace scopes.
2. Fixture contains ≥5 inbox notifications with varied types (update, assign, mention).
3. Fixture contains ≥1 team with nested nav items (Home, Triage, Issues, Cycles, Projects, Views).
4. Fixture contains favorites in folders.
5. Fake Jira/Plane mode loads the fixture and renders:
   - View browser with Personal/workspace groups.
   - Add Filter menu with all 21 rows.
   - Inbox with badge and notification list.
   - Sidebar with Workspace/Favorites/Your teams hierarchy.
   - All icons match `icon-spec.md`.
6. `bun test` passes.
7. `bun run smoke` passes (or equivalent manual smoke with `bun run dev`).
8. Screenshots and console logs saved to `smoke-log.md`.

**Verification**
```bash
bun test
bun run typecheck
bun run build
# Launch with fake data and verify all new UI
```

---

### T8 — UI-specialist review gate

**What**
Before PR merge (or before maker handoff), an Opus UI specialist reviews pipe-kan against local Linear screenshots. Screenshots must be viewable (pipe-kan vs local refs, local only). Kimi Referee (ollama-cloud/kimi-k2.6) validates spec compliance.

**Why**
Visual parity is subjective; a human UI specialist catches spacing, colour, and proportion issues that automated tests miss. Kimi Referee validates ticket completeness.

**Files**
- `docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan/ui-review.md` (new)

**Acceptance**
1. Opus UI specialist runs pipe-kan locally and captures screenshots of:
   - View browser + composer
   - Add Filter menu
   - Move to project picker with hover card
   - Inbox with badge
   - Sidebar hierarchy (Workspace/Favorites/Your teams)
   - Icon close-ups (status, priority, label dot)
2. Screenshots are compared side-by-side with local refs (local only, not committed).
3. Review document lists any discrepancies with severity (blocker / minor / polish).
4. Kimi Referee runs against `spec.md` and `tickets.md` and outputs:
   - Coverage score (% of AC covered by existing code or tickets).
   - Any missing acceptance criteria.
   - Recommendations for ticket ordering.
5. Both reviews are linked in the PR description.

**Verification**
Manual review process. No automated test.

---

### T9 — Performance guard

**What**
Establish performance budgets for board cold load and cached project/workspace switches. Document measurement method in the plan.

**Why**
Adding UI chrome must not regress first-paint time or switch responsiveness.

**Files**
- `docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan/perf.md` (new)

**Acceptance**
1. Baseline measured on `main` at 0.34.2:
   - Board cold load: time from `performance.now()` at script start to first column render complete.
   - Cached project switch: time from click to new columns rendered.
   - Cached workspace switch: time from click to new data visible.
2. Budgets:
   - Cold load ≤ baseline + 50ms.
   - Project switch ≤ baseline + 30ms.
   - Workspace switch ≤ baseline + 30ms.
3. Measurement method: add a `performance.mark`/`measure` API in `src/App.tsx` or a debug util.
4. Smoke test records measurements in `smoke-log.md`.
5. If any measurement exceeds budget, ticket is blocked until optimisation or budget adjustment with justification.

**Verification**
```bash
bun run build
# Launch and measure with performance marks
```

---

### T10 — Docs stage ticket

**What**
Update CONTEXT.md and README with new terminology and documentation for Views, Inbox, Favorites folders, Your teams, and Icon spec.

**Why**
Future agents need correct language. CONTEXT.md is the vocabulary contract.

**Files**
- `CONTEXT.md`
- `README.md`

**Acceptance**
1. CONTEXT.md adds definitions for:
   - **View** — A saved, named filter+layout configuration. Can be Personal or workspace-scoped. Has an icon, title, and optional description.
   - **Inbox** — Synthetic notification list showing issue updates, assignments, and mentions. Badge count is derived from `needs-input` issues.
   - **Favorite folder** — A named group of Linear favorites in the sidebar. Supports drag-to-file and collapsible state.
   - **Your teams** — Sidebar section listing joined teams with nested navigation (Home, Triage, Issues, Cycles, Projects, Views).
   - **Team** — A workspace subdivision containing projects. In pipe-kan, mapped from Plane workspace/project grouping.
2. README.md adds:
   - Description of Views browser and create flow.
   - Description of Inbox (synthetic).
   - Description of sidebar hierarchy.
   - Screenshot placeholders.
3. No code changes outside docs.

**Verification**
Manual review of CONTEXT.md and README.md.

---

## Ticket order

1. **T6** first (icon spec is a dependency for all UI tickets).
2. **T5** (sidebar redesign) can parallel with **T1** (views) and **T4** (inbox) — they touch different parts of the sidebar.
3. **T2** (add filter) depends on T1's filter bar positioning.
4. **T3** (move to project) can parallel with T2 — independent picker.
5. **T7** (smoke test) is last — needs all UI tickets done.
6. **T8** (UI review) runs after T7.
7. **T9** (performance) runs in parallel with T7/T8.
8. **T10** (docs) can parallel with T7/T8/T9.

---

## Notes

- **Synthetic fixtures only** — never use live Plane/Jira credentials in tests or docs.
- **No secrets** — `PLANE_API_KEY` / `JIRA_API_TOKEN` stay environment-only.
- **Fake data** — Use "Acme Demo", "DEMO-12", "Acme-product", "work-product" in specs and tests.
- **Local screenshots** — `linear-refs-local/` is untracked and never committed. Used for layout reference only.
- **Neutral terms** — No vendor/hardware names in committed files.
