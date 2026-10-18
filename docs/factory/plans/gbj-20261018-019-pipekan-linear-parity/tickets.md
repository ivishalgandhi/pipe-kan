# tickets.md — gbj-20261018-019 pipe-kan Linear parity: Initiatives views & workspace/project switcher

## Dependencies
- gbj-20261017-014 (board/sidebar/command restyle) design tokens are already on `main`.
- This slice adds new views and chrome; it reuses the tokens but adds new state and components.

---

### T1 — Initiatives view (Plane modules as Linear Initiatives)

**What**
Add an "Initiatives" opener to the left pane (Plane mode only). When selected, the main canvas shows a list or board of Plane modules rendered as Linear-style Initiatives. Each Initiative shows status, priority, target date, and a synthetic health indicator.

**Why**
Linear's top-level Initiatives view lets leadership see strategic objectives and their health. Plane modules are the closest equivalent; today they only appear as Epic cards in All epics.

**Files**
- `src/App.tsx` — add "Initiatives" opener, new board kind `initiatives`, header conditional
- `src/plane.ts` — add module start_date and target_date to catalog; expose module list API
- `src/board.ts` — add `Initiative` type (or reuse Epic with additional fields)
- `src/visible.ts` — add initiative filter/sort helpers
- New component: `src/components/initiative-list.tsx` or inline in App.tsx

**Acceptance**
1. In Plane mode, left pane shows "Initiatives" button below "Calendar" (or in a logical order).
2. Clicking "Initiatives" sets `boardKind` to `"initiatives"` and shows a list view of modules.
3. Each Initiative row shows: module key (`{identifier}M-{seq}`), module name, status dot + text, priority pill, target date, and a health dot.
4. Health dot is synthesized:
   - `done` → green; `cancelled` → red; `in_progress` with past target_date → yellow; `in_progress` with future target_date → green; `todo` / `backlog` → gray.
5. Clicking an Initiative opens its work items on the board (same behavior as selecting an Epic today).
6. In Jira mode, "Initiatives" opener is not visible.
7. Keyboard Command overlay (`Cmd+K`) includes "Initiatives" jump.
8. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
# Launch with Plane mode and verify Initiatives opener appears
```

---

### T2 — Projects view (Plane projects as Linear Projects)

**What**
Add a "Projects" opener to the left pane (Plane mode only). When selected, the main canvas shows a list or board of Plane projects in the current workspace.

**Why**
Linear has a dedicated Projects view for roadmap planning. Today pipe-kan projects are only Scope flags, not first-class viewable entities.

**Files**
- `src/App.tsx` — add "Projects" opener, new board kind `projects`
- `src/plane.ts` — expose `listProjectIdentifiers` already exists; ensure project list includes name, identifier, and counts
- `src/board.ts` — add `Project` type
- New component: `src/components/project-list.tsx` or inline

**Acceptance**
1. In Plane mode, left pane shows "Projects" opener below "Initiatives".
2. Clicking "Projects" sets `boardKind` to `"projects"` and shows a list view of workspace projects.
3. Each Project row shows: project name, identifier chip, issue count (total work items in catalog), and a progress bar (completed / total).
4. Clicking a project scopes the board to that project's work items (updates Scope flags to `--projects {identifier}` and refreshes).
5. In Jira mode, "Projects" opener is not visible.
6. Keyboard Command overlay includes "Projects" jump.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T3 — Timeline view

**What**
Add a "Timeline" canvas tab alongside Board and Calendar. Timeline is available when viewing Projects or Initiatives. It renders items as horizontal bars on a time axis with week/month/quarter/year zoom.

**Why**
Linear's Timeline is a key differentiator for roadmap planning. It lets users visualize project/initiative schedules.

**Files**
- `src/App.tsx` — add `canvasTab` value `"timeline"`, tab button conditional on boardKind
- `src/calendar.ts` — add `readCanvasTab`/`writeCanvasTab` support for timeline (or extend tab type)
- New component: `src/components/timeline-view.tsx`

**Acceptance**
1. When `boardKind` is `"initiatives"` or `"projects"`, the canvas tabs show Board | Calendar | Timeline.
2. When `boardKind` is `"stories"`, `"epics"`, or `"combined"`, only Board | Calendar tabs show (Timeline hidden).
3. Timeline renders each Initiative/Project as a horizontal bar positioned by `start_date` → `target_date`.
4. Timeline has a zoom control: Week / Month / Quarter / Year.
5. Bars are grouped by the current grouping selection (see T6).
6. Current date is marked with a vertical line.
7. Items without dates show in an "Unscheduled" section below the timeline.
8. Clicking a bar opens the item's detail/properties rail.
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T4 — Workspace switcher redesign

**What**
Move the workspace picker from the board header to the sidebar upper-left. Redesign the dropdown to match Linear's workspace switcher: workspace name as a prominent pill, click → "Switch workspace" heading + workspace list.

**Why**
Current workspace picker is a small pill hidden in the board header among many controls. Linear puts it prominently in the sidebar top-left.

**Files**
- `src/App.tsx` — remove `WorkspacePicker` from header; add new `WorkspaceSwitcher` component in sidebar
- `src/command.ts` — ensure `O` then `W` keyboard shortcut is wired

**Acceptance**
1. Sidebar top section (above "All stories") shows a workspace pill with the current workspace name.
2. Pill is ~36px height, rounded-lg, includes a small icon or avatar placeholder, and the workspace name.
3. Clicking the pill opens a dropdown with:
   - Heading: "Switch workspace"
   - List of fetched workspaces (`personal`, `team`, etc.) with name + slug
   - A "Settings" link (can be a no-op for now)
4. The old `WorkspacePicker` in the board header is removed.
5. Keyboard shortcut `O` then `W` from Command overlay jumps to workspace list.
6. In Jira mode, workspace pill is not shown.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T5 — Project switcher dropdown

**What**
Replace the static project chip in the board header with an interactive dropdown that lists all workspace projects as checkable items. Multi-select updates Scope flags.

**Why**
Today users must type `--projects APH,PULSE` in Scope flags to switch projects. Linear has a native project switcher.

**Files**
- `src/App.tsx` — replace static `<span>` project chip with `ProjectSwitcher` dropdown
- `src/flags.ts` — ensure `setProjectsFlag` handles multi-select correctly

**Acceptance**
1. Board header shows a project pill that displays current project identifiers (e.g., "APH, PULSE") or "All projects" when none selected.
2. Clicking the pill opens a dropdown with:
   - Heading: "Projects"
   - List of all workspace projects as checkbox items
   - Checked items match current Scope
3. Checking/unchecking a project updates the Scope flags string in real time.
4. "Refresh" must be triggered after project selection changes (or auto-refresh with confirmation).
5. In Jira mode, the project switcher shows project keys from `parseFlags(flags).projects` but may not have a dropdown if project list isn't fetched from Jira. Keep static chip in Jira mode for now.
6. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T6 — Display options panel

**What**
Expand the existing "Display" dropdown into a full Display options panel with layout, grouping, ordering, zoom, show empty groups, and completed projects filter.

**Why**
Linear's Display options are a major feature for customizing views. Current pipe-kan "Display" only toggles card properties.

**Files**
- `src/App.tsx` — expand Display dropdown content; add new chrome state fields
- `src/visible.ts` — add grouping, ordering, zoom, showEmptyGroups, completedFilter types and helpers
- `src/index.css` — add any new tokens needed for display panel

**Acceptance**
1. "Display" dropdown opens a panel (not just a small menu) with sections:
   - **Layout**: List / Board / Timeline (contextual; Timeline only for Projects/Initiatives)
   - **Grouping**: For Initiatives — Status, Health, Target date; for Projects — Status, Health, Initiative; for Issues — Status, Assignee, Project, Priority, Label
   - **Ordering**: Status, Priority, Updated time, Created time, Target date, Manual
   - **Zoom**: Week / Month / Quarter / Year (Timeline only)
   - **Show empty groups**: toggle
   - **Completed projects**: Last week / Last month / Last year / All / None
   - **Card properties**: existing toggles (ID, status, assignee, priority, labels, due date, target end, age)
2. Selections persist in local chrome state.
3. `Shift+V` keyboard shortcut opens the Display options panel.
4. Grouping changes re-render the board/list/timeline immediately.
5. Ordering changes re-sort items immediately.
6. Show empty groups toggle shows/hides empty columns in board view.
7. Completed projects filter affects Projects and Initiatives views.
8. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T7 — Health indicator synthesis

**What**
Implement a synthetic health indicator for Initiatives and Projects based on status and target date.

**Why**
Linear shows health (green/yellow/red/gray) on Initiatives and Projects. Plane has no native health field.

**Files**
- `src/plane.ts` — add `computeHealth` function
- `src/App.tsx` — render health dot on Initiative/Project rows and cards
- `src/components/initiative-list.tsx` (if T1 created it)
- `src/components/project-list.tsx` (if T2 created it)

**Acceptance**
1. `computeHealth(status: string, targetDate?: string): "green" | "yellow" | "red" | "gray"` returns:
   - `done` → `green`
   - `cancelled` → `red`
   - `in_progress` with past `targetDate` → `yellow`
   - `in_progress` with future/no `targetDate` → `green`
   - `todo` / `backlog` → `gray`
2. Health dot is rendered as a 8px colored circle next to the Initiative/Project name.
3. Colors: green `#22c55e`, yellow `#eab308`, red `#ef4444`, gray `#9ca3af`.
4. Health is shown in list view, board view, and timeline view.
5. Health is sortable/filterable in Display options (group by Health).
6. `bun test` covers `computeHealth` edge cases.
7. `bun run typecheck` passes.

**Verification**
```bash
bun test
bun run typecheck
```

---

### T8 — Keyboard shortcuts

**What**
Add `Shift+V` to open Display options and `O` then `W` in Command overlay to filter to workspaces.

**Why**
Linear uses these shortcuts. Current Command overlay already has workspace jumps but not the `O` `W` sequence.

**Files**
- `src/App.tsx` — add `Shift+V` keydown listener
- `src/command.ts` — add `O` `W` sequence or workspace filter shortcut
- `src/components/command-overlay.tsx` — ensure workspace group is filterable

**Acceptance**
1. Pressing `Shift+V` anywhere in the app opens the Display options dropdown/panel.
2. In Command overlay, typing `O` then `W` filters the list to workspace rows (or jumps directly if only one workspace).
3. These shortcuts are documented in the UI (e.g., Display button tooltip shows "Shift V").
4. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T9 — Smoke test with synthetic Plane fixtures

**What**
Create or extend Plane synthetic fixtures to include modules with varied statuses, target dates, start dates, and projects with identifiers. Verify all new views render correctly.

**Why**
Vishal's rule: smoke test with fake data only. No live Plane credentials in tests.

**Files**
- `fixtures/plane-modules.json` (new) or extend existing fixture
- `fixtures/plane-projects.json` (new)
- `docs/factory/plans/gbj-20261018-019-pipekan-linear-parity/smoke-log.md`

**Acceptance**
1. Synthetic fixture contains ≥5 Plane modules across ≥2 projects with:
   - Varied statuses: `backlog`, `todo`, `in_progress`, `done`, `cancelled`
   - Varied target dates: past, future, none
   - Varied start dates
   - Varied priorities
2. Synthetic fixture contains ≥3 Plane projects with identifiers.
3. Fake Plane mode (`PLANE_API_KEY=fake` or mock fetch) loads the fixture and renders:
   - Initiatives list with health dots
   - Projects list with progress bars
   - Timeline view with bars positioned by dates
   - Workspace switcher showing workspace names
   - Project switcher showing project list
   - Display options panel with all sections
4. `bun test` passes.
5. Screenshots and console logs are saved to `smoke-log.md`.

**Verification**
```bash
bun test
bun run typecheck
bun run build
# Launch with fake Plane data
```

**Smoke test log artifact**
Save to `docs/factory/plans/gbj-20261018-019-pipekan-linear-parity/smoke-log.md`:
- `bun test` output
- `bun run typecheck` output
- Screenshot file paths
- Browser console export (if any errors)

---

### T10 — Documentation updates

**What**
Update CONTEXT.md and README with new terminology and Plane view documentation.

**Why**
New concepts (Initiatives, Projects, Timeline, Health) need definitions in CONTEXT.md so future agents use correct language.

**Files**
- `CONTEXT.md`
- `README.md`

**Acceptance**
1. CONTEXT.md adds definitions for:
   - **Initiative** — Plane module mapped to Linear Initiative; strategic objective with status, priority, target date, health
   - **Project** — Plane project mapped to Linear Project; scoped unit of work with identifier
   - **Timeline** — time-axis view for Initiatives and Projects
   - **Health** — synthetic indicator (green/yellow/red/gray) derived from status and target date
   - **Display options** — panel for layout, grouping, ordering, zoom, filters
2. README.md adds:
   - Description of new Plane-only views (Initiatives, Projects, Timeline)
   - Screenshot placeholders for new views
   - Updated `--projects` and `--workspace` usage with project switcher note
3. No code changes outside docs.

**Verification**
```bash
# Manual review of CONTEXT.md and README.md
```

---

### T11 — TODO: Linear screenshot reference integration

**What**
Vishal will send Linear screenshots later. They should be placed in `docs/factory/plans/gbj-20261018-019-pipekan-linear-parity/linear-refs/` and referenced in spec.md/tickets.md to validate visual parity.

**Acceptance**
1. `linear-refs/` directory exists with a `.gitkeep` (already created).
2. When screenshots arrive, they are named descriptively:
   - `linear-initiatives-list.png`
   - `linear-projects-board.png`
   - `linear-timeline.png`
   - `linear-workspace-switcher.png`
   - `linear-project-switcher.png`
   - `linear-display-options.png`
3. spec.md is updated with inline image references and gap annotations comparing screenshots to pipe-kan.
4. This ticket is tracked but NOT blocking other tickets.

---

## Ticket order

1. **T4** (Workspace switcher) and **T5** (Project switcher) can be done first — they are chrome-only and don't depend on new views.
2. **T7** (Health) is a pure utility — can be done early and used by T1/T2.
3. **T1** (Initiatives) and **T2** (Projects) can be parallel after T7.
4. **T3** (Timeline) depends on T1 and T2 (needs Initiative/Project data).
5. **T6** (Display options) can be done in parallel with T1–T3 but benefits from having all views to test.
6. **T8** (Keyboard shortcuts) depends on T4 and T6.
7. **T9** (Smoke test) is last — needs all UI tickets done.
8. **T10** (Docs) can be done in parallel with T9.
9. **T11** is a placeholder for future Vishal input.

---

## Notes

- **Synthetic fixtures only** — never use live Plane credentials in tests or docs.
- **No secrets** — `PLANE_API_KEY` stays environment-only; never commit.
- **Trailing-slash gotcha** — when adding new Plane API calls, ensure trailing `/` is present on endpoints that require it.
- **Rate limit** — Plane API ~60 req/min. The catalog loader already batches; new views should reuse `loadCatalog` or cached data.
- **Jira mode** — All new Plane-only openers must be conditionally hidden. No regression in Jira mode.
- **PULSE** — exists in both workspaces; test workspace switching with PULSE present.
