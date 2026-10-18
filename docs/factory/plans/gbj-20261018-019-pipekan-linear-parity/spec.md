# spec.md — gbj-20261018-019 pipe-kan Linear parity: Initiatives views & workspace/project switcher

## Goal
Make pipe-kan's Initiatives views (module-backed "epic" views in Plane mode) and its workspace/project switcher match Linear's real app exactly. This is a follow-up to gbj-20261017-014 (board/sidebar/command restyle); that slice covered visual language tokens. This slice covers functional view parity: what views exist, how the switcher behaves, and what display options/groupings are available.

## Scope
- Initiatives views in Plane mode (modules as epics)
- Project views in Plane mode (Plane projects)
- Workspace/project switcher chrome
- Display options (grouping, ordering, layout toggles)
- Timeline/roadmap view (project-level only, as Linear supports)
- Health indicators and updates (display-only for now)

## Non-goals
- Do NOT add true Linear "Initiatives" as a new entity type — Plane has no Initiatives API endpoint. We map Plane modules → Linear Initiatives and Plane projects → Linear Projects.
- Do NOT implement actual project updates write-back; display-only health/read-only updates.
- Do NOT add cycles, estimates, or team pages.
- Do NOT add a real Linear workspace switcher with multi-workspace auth; keep single Plane host.
- Do NOT add Swimlanes (sub-grouping rows) in this slice.
- No code changes to Jira mode except switcher chrome that already exists.

---

## 1. Research summary

### 1.1 Linear Initiatives
Source: `https://linear.app/docs/initiatives`

- Initiatives are workspace-level groupings of Projects around company objectives.
- Properties: Status (`Proposed`, `Planned`, `Active`, `Completed`, `Canceled`), Priority, Labels, Owner, Lead team, Target date, Resources, Latest update, Description, Projects.
- Initiative views: list or timeline layout. Group by lead, member, status, health, start date, target date.
- Health: derived from latest initiative update (`On track` = green, `At risk` = yellow, `Off track` = red, `No current update` = gray).
- Initiative graph: rate of completed issues per project over time.

### 1.2 Linear Projects
Source: `https://linear.app/docs/projects`

- Projects group issues with a clear outcome or planned completion date.
- Properties: Status, Priority, Target date, Start date, Lead, Members, Milestones, Labels, Initiatives.
- Project views: list, board, or timeline layout.
- Group by: initiative, lead, member, status, health, start date, target date.
- Order by: manual, status, priority, updated time, created time.
- Timeline zoom: week, month, quarter, year.
- Completed projects filter: last week/month/year/all/none.
- Project updates: structured reports with health indicator + description.
- Progress graph visible on project page.

### 1.3 Linear Display options
Source: `https://linear.app/docs/display-options`

- Issue views: layout (list/board), grouping (status, assignee, project, priority, cycle, label, parent, team, etc.), sub-grouping (rows in board), ordering, show empty groups, display properties toggle.
- Project/Initiative views: layout (list/timeline/board for projects), grouping, ordering, zoom (timeline), completed projects filter.
- Keyboard: `Shift+V` opens display options; `Cmd/Ctrl+B` toggles list/board on issue views.
- Saved per-user or "Set as default" for workspace.

### 1.4 Linear Workspace switcher
Source: `https://linear.app/docs/workspaces`

- Workspace name in upper-left corner; click → Settings or Switch workspace.
- Multi-workspace: hover "Switch workspace" → see list of workspaces associated with account.
- Shortcut: `O` then `W`.
- Teams live inside workspaces.

### 1.5 Linear Timeline
Source: `https://linear.app/docs/timeline`

- Project-only view. Issues cannot appear on timeline (they appear in list/board).
- Milestones shown as diamonds/cards on timeline.
- Dependencies shown as connecting lines.
- Group by Initiatives or other attributes.
- Zoom: week/month/quarter/year.
- Team cycles shown as overlay.

---

## 2. Gap analysis: pipe-kan vs Linear

### 2.1 Initiatives views (Plane modules as Initiatives)

| Linear feature | pipe-kan current state | Gap |
|---|---|---|
| Initiatives list view with columns: name, status, priority, target date, health, active projects | All epics shows a Kanban board of Epic cards grouped by status; no list view, no health, no initiative properties | Missing list layout for Initiatives; missing health column; missing initiative properties display |
| Initiatives timeline view | Not present | Missing timeline layout for Initiatives |
| Group Initiatives by status, health, lead, target date | Not present | Missing grouping controls for Initiatives |
| Order Initiatives by status, priority, updated time | Not present | Missing ordering controls for Initiatives |
| Initiative health indicator (green/yellow/red/gray dot) | Not present | Missing health indicator on module/epic cards |
| Initiative graph (completion rate over time) | Not present | Missing graph visualization |
| Click health → see latest update | Not present | Missing update display |

### 2.2 Project views (Plane projects as Projects)

| Linear feature | pipe-kan current state | Gap |
|---|---|---|
| Projects list view | Not present as a first-class view. Projects are only a Scope filter (comma-separated identifiers) | Missing a "Projects" view that lists all workspace projects |
| Project board view | Board shows work items, not projects | Missing project-as-card board view |
| Project timeline view | Calendar shows issue dates, not project timelines | Missing project timeline with milestones |
| Group projects by initiative, status, health | Not present | Missing grouping for projects |
| Completed projects filter | Not present | Missing filter for completed/canceled projects |
| Project progress graph | Not present | Missing progress graph on project |

### 2.3 Workspace/project switcher

| Linear feature | pipe-kan current state | Gap |
|---|---|---|
| Workspace name in upper-left as a clickable pill with logo | `WorkspacePicker` is a small `bg-primary/10` pill next to the project badge in the board header, not in the sidebar upper-left | Wrong position; wrong visual weight; missing workspace logo/icon |
| Hover workspace → "Switch workspace" submenu | Dropdown only shows filter input + list of workspaces; no submenu structure | Missing submenu with "Switch workspace" heading |
| Workspace list with names + slugs | Shows `name.trim() || slug` + slug; okay but styling differs | Styling drift from Linear's clean row layout |
| Project switcher (separate from workspace) | Project is a static chip (`projects.join(", ")` or "DEMO") with no dropdown | Missing project switcher dropdown; no way to quickly switch projects without editing Scope flags |
| Keyboard shortcut `O` then `W` for workspace switch | Not present | Missing keyboard shortcut |

### 2.4 Display options

| Linear feature | pipe-kan current state | Gap |
|---|---|---|
| Display options button in top-right of view | Present as "Display" dropdown in header; shows Card properties toggles | Current Display only toggles card properties; missing layout, grouping, ordering, zoom |
| `Shift+V` shortcut | Not present | Missing keyboard shortcut |
| Layout toggle (list/board/timeline) | Only Board/Calendar tabs exist; no List view, no Timeline view for projects/initiatives | Missing List and Timeline layouts |
| Grouping controls | Not present for any view type | Missing grouping for board and list views |
| Ordering controls | Sort dropdown exists (Payload, Priority, Age, Due date, Key) but only for issue board | Sort is only for issues; missing ordering for Initiatives/Projects |
| Zoom controls for timeline | Not present | Missing timeline zoom |
| Show empty groups toggle | Plane keeps empty workflow states; Jira omits them. No user toggle. | Missing user-facing "Show empty groups" toggle |
| Completed projects filter | Not present | Missing filter |

---

## 3. Plane mapping

### 3.1 Data model mapping

| Linear concept | Plane concept | pipe-kan representation |
|---|---|---|
| Initiative | Module | Epic in left rail; key = `{identifier}M-{sequence}` |
| Project | Project | Project identifier chip in header; Scope filter `--projects` |
| Issue | Work item | Card on board; key = `{identifier}-{sequence}` |
| Status | State | Column name |
| Priority | Priority | Card priority pill |
| Label | Label | Card label pill |
| Target date | Module target_date / Issue target_date | Card "Target end" field |
| Start date | Module start_date | Not currently displayed |
| Health | (no native concept) | Must synthesize from module status or issue completion |
| Owner/Lead | (no direct field) | Not mapped |
| Milestone | (no direct concept) | Not mapped |
| Team | (no direct concept) | Not mapped |

### 3.2 Plane API context

- Host: `https://plane.tail48fe8.ts.net`
- API: `{host}/api/v1`
- Workspaces: `/workspaces/{slug}/` — two known workspaces: `personal`, `work`
- Projects: `/workspaces/{slug}/projects/` — returns 24+10 projects across both workspaces
- Modules: `/workspaces/{slug}/projects/{project_id}/modules/`
- Work items: `/workspaces/{slug}/projects/{project_id}/issues/` or `inbox-issues/`
- States: `/workspaces/{slug}/projects/{project_id}/states/`
- Labels: `/workspaces/{slug}/projects/{project_id}/labels/`
- Module status values: `backlog`, `todo`, `in_progress`, `done`, `cancelled`
- API rate limit: ~60 requests/minute
- Trailing-slash gotcha: some endpoints 404 without trailing `/`

### 3.3 PULSE project

- `PULSE` exists in both `personal` and `work` workspaces.
- When switching workspaces, the project list refreshes.
- Module list is per-project per-workspace.

---

## 4. Design direction

### 4.1 Initiatives view (Plane modules)

Add a new left-pane opener: **Initiatives** (Plane mode only; hidden in Jira mode). This sits alongside All stories / All epics / Combined / Calendar.

When Initiatives is selected:
- Main canvas shows a list or board of Initiatives (Plane modules).
- Each Initiative row/card shows: name, status dot + text, priority pill, target date, health indicator, active project count.
- Clicking an Initiative shows its projects (Plane projects) or its issues (work items) — to be decided. Linear shows projects within an initiative. For pipe-kan, clicking an Initiative should probably show its work items (as today All epics → select epic shows children).
- Health indicator: since Plane has no native health, synthesize from:
  - If module status is `done` → green (on track, completed)
  - If module status is `cancelled` → red (off track)
  - If module status is `in_progress` → green unless target_date is past → yellow (at risk)
  - If module status is `todo` → gray (no current update)
  - If module status is `backlog` → gray
  This is a synthetic heuristic for display purposes only.

### 4.2 Projects view (Plane projects)

Add a new left-pane opener: **Projects** (Plane mode only; hidden in Jira mode).

When Projects is selected:
- Main canvas shows a list or board of Projects (Plane projects from current workspace).
- Each Project row/card shows: name, identifier, status, lead (not available), target date, health indicator, progress bar (issue completion %).
- Clicking a Project scopes the board to that project's work items.

### 4.3 Timeline view

Add Timeline as a canvas tab (alongside Board | Calendar) when viewing Projects or Initiatives.
- Timeline shows projects/initiatives as horizontal bars across a time axis.
- Milestones shown as markers.
- Zoom: week / month / quarter / year.
- Since Plane modules have `start_date` and `target_date`, use those for bar positioning.
- Since Plane projects have no start/target dates natively, infer from module dates or issue dates, or omit timeline for projects.

### 4.4 Workspace switcher redesign

Move workspace picker from board header to sidebar upper-left:
- Sidebar top section shows workspace name as a pill/button.
- Clicking opens a dropdown: "Switch workspace" heading + list of workspaces.
- Each workspace row shows name + slug.
- Below that: "Settings" link (optional; out of scope for now).
- Keyboard: `O` then `W` opens the Command overlay filtered to workspaces.

### 4.5 Project switcher

Add a project switcher dropdown in the board header (next to or replacing the static project chip):
- Shows current project(s) as a pill.
- Clicking opens dropdown with all workspace projects as checkable items.
- Selecting/deselecting updates Scope flags and triggers Refresh.
- Multi-select supported (comma-separated in flags).

### 4.6 Display options redesign

Replace current "Display" dropdown with full Display options panel:
- **Layout**: List / Board / Timeline (contextual: Timeline only for Projects/Initiatives).
- **Grouping**: For Initiatives — by Status, Health, Target date; for Projects — by Status, Health, Initiative; for Issues — by Status, Assignee, Project, Priority, Label.
- **Ordering**: Status, Priority, Updated time, Created time, Target date, Manual.
- **Zoom**: Week / Month / Quarter / Year (Timeline only).
- **Show empty groups**: toggle.
- **Completed projects**: Last week / Last month / Last year / All / None.
- **Card properties**: existing toggles (ID, status, assignee, priority, labels, due date, target end, age).

---

## 5. Files to examine (no edits yet)

| File | What to look for |
|---|---|
| `src/App.tsx` | Left-pane openers, header chrome, WorkspacePicker, boardKind/canvasTab state |
| `src/plane.ts` | Module/project/work item types, catalog loading, API paths |
| `src/command.ts` | Command overlay jump kinds, workspace group |
| `src/visible.ts` | Filter, sort, hide logic; Preset type |
| `src/board.ts` | Board, Card, Epic types; card age, epic grouping |
| `src/refresh.ts` | Refresh request body, workspace warning text |
| `src/flags.ts` | `--projects`, `--workspace` flag parsing |
| `src/components/command-overlay.tsx` | Command overlay UI |
| `src/components/board-calendar.tsx` | Calendar tab implementation |
| `src/index.css` | Design tokens (from gbj-20261017-014) |

---

## 6. Acceptance criteria (operator)

1. **Initiatives opener** — In Plane mode, left pane shows "Initiatives" opener. Clicking it shows a list or board of Plane modules with status, priority, target date, and synthetic health.
2. **Projects opener** — In Plane mode, left pane shows "Projects" opener. Clicking it shows a list or board of Plane projects.
3. **Timeline tab** — When viewing Projects or Initiatives, Board | Calendar | Timeline tabs are available. Timeline renders modules/projects as bars on a time axis with week/month/quarter/year zoom.
4. **Workspace switcher** — Workspace pill moved to sidebar upper-left. Dropdown shows "Switch workspace" heading + workspace list. Keyboard `O` `W` works.
5. **Project switcher** — Board header has a project dropdown (replacing static chip) with checkable workspace projects. Multi-select updates Scope flags.
6. **Display options** — "Display" dropdown expanded to include layout (list/board/timeline), grouping, ordering, zoom, show empty groups, completed projects filter, and card properties.
7. **Health indicator** — Synthetic health (green/yellow/red/gray) shown on Initiative and Project cards/rows based on status + target date.
8. **Smoke test** — `bun test` passes; Plane fixture data (or synthetic Plane data) renders all new views; screenshots + console log in PR.
9. **No Jira regression** — Jira mode shows no new Plane-only openers; existing behavior unchanged.
10. **Docs update** — CONTEXT.md updated with new terminology (Initiatives, Projects, Timeline, Health). README updated with Plane view docs.

---

## 7. References

- Linear Docs — Initiatives: https://linear.app/docs/initiatives
- Linear Docs — Projects: https://linear.app/docs/projects
- Linear Docs — Display options: https://linear.app/docs/display-options
- Linear Docs — Timeline: https://linear.app/docs/timeline
- Linear Docs — Workspaces: https://linear.app/docs/workspaces
- Linear Docs — Initiative and project updates: https://linear.app/docs/initiative-and-project-updates
- Prior plan: `docs/factory/plans/gbj-20261017-014/`

## Addendum (2026-10-18): Linear-style switching across ALL backends (T12)

Vishal's requirement: switching must be done in the UI, not by typing flags (`--plane`, `--workspace`, `--projects`, Scope flags field).
- Sidebar header menu (Linear-style): choose **source/backend** (Plane, Jira, Taskwarrior where applicable), then workspace/team/project.
- "Switch workspace" with keyboard shortcut `O` then `W`; checkmark on the current item.
- Sidebar lists joined teams/projects for the current workspace, plus a **Favorites** section.
- Source switch reloads the board for that backend with no restart; unavailable backends are shown disabled with reason.
- CLI flags and env remain working as **startup defaults** only.
- Jira write-back remains exclusively through jira-cli (ADR 0001/0002); the switcher never writes to Jira directly.
- Plane workspace slugs are `work` and `personal` (PULSE exists in both).
- Linear reference captures: if not present in `linear-refs/`, the maker works from the notes in this spec and flags it in the PR.

## Addendum (2026-10-18): multi-select scope

The workspace/project switcher is **multi-select across every backend**. A checkable list lets the operator pick several workspaces and several projects at once. The board, Initiatives, Projects, and Timeline then show one **merged** view of that selection.

- Plane slugs in this slice are `work` and `personal`. `PULSE` exists in both; checking `work/PULSE` and `personal/PULSE` merges those two projects.
- Selection is stored as `--workspaces` plus `--scopes workspace/PROJECT` (and the existing `--workspace` / `--projects` flags stay in sync for startup defaults and the header chip).
- CLI `--plane`, `--workspace`, `--projects`, and the Scope flags field remain startup defaults. Later changes happen in the sidebar menu, not by typing flags.
- Plane catalog loads stay serial, cached, and trailing-slash. About 60 requests per minute.

## Addendum (2026-10-18): stretch T13–T15

- **T13 View filters.** Filter menu, `F` shortcut, chips, and saved views (including a default) for Created date, Updated date, Due date, Status, Assignee, Priority, Labels, and Project.
- **T14 Row menus.** Right-click an issue, initiative, or project row for status, assignee, priority, labels, and copy link. Jira mutations still go through jira-cli.
- **T15 Command palette.** Cmd+K searches and jumps to a view, issue, or project; switches workspace or source; changes status or assignee on the selected item; toggles Display. `O` then `W` opens Switch workspace.

Smoke: `bun run smoke` (`scripts/smoke-linear-parity.ts`) uses `PLANE_FIXTURE=synthetic` only. It checks the merged work+personal PULSE view, source switch, filters, the row menu, the command palette, and Initiatives/Projects/Timeline. The log is `smoke-logs/smoke.log`. Reference screenshots live in `linear-refs/`. Sub-initiatives, owners, progress graphs, initiative updates, the teams page, and update reminders are not implemented.
