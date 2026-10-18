# spec.md — gbj-20261018-023 pipe-kan Linear look plan

## Goal
Make pipe-kan's UI match Linear's interface in detail. This plan covers six interface areas that are either missing or need redesign after the prior 014 (board/sidebar/command restyle) and 019 (Initiatives/Projects/Timeline/Display options) slices:

1. Views: Issues/Projects tabs; Personal vs workspace views; per-view icons; "New view" create flow with Save to Personal/team; filter bar.
2. Full Add Filter menu (`F` shortcut): AI filter, Advanced filter, Status, Status type, Assignee, Agent, Creator, Priority, Estimate, Labels, Relations, Suggested label, Dates, Project, Project properties, Initiative, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template.
3. "Move to project" picker (`Shift+P`): search, checkmark, hover cards.
4. Inbox with unread count.
5. Left sidebar: Workspace (Projects/Views/Initiatives/More); Favorites with folders, nested items, drag, add-folder icon; Your teams (Home/Triage/Issues/Cycles(Current/Upcoming)/Projects/Views); Try/Invite people/Connect.
6. Icon spec: all small icons (status, priority, project, cycle, label dots, avatar) with size, stroke, colour tokens, and states.

## Non-goals
- Do NOT add real AI filter backend. The "AI filter" row is UI-only (opens a prompt composer).
- Do NOT add Estimate field to Plane/Jira data model. UI placeholder only.
- Do NOT add Cycle entity. UI placeholder only (Plane has no native cycles).
- Do NOT add real Subscribers/Auto-closed/Content/Links/Template filter backends. UI skeletons with "coming soon" or disabled state.
- Do NOT implement real Inbox notifications backend. Badge count is synthetic (e.g. from open issue count or fixture).
- No code changes outside docs except the .gitignore line added for `linear-refs-local/`.
- Do NOT merge this PR. Maker does not start.

---

## 1. Research summary (from local screenshots + public Linear docs)

### 1.1 Views / "All issues" create flow
From local refs2 screenshots (read for layout only, no text quoted):
- Top header shows "Views › All issues" breadcrumb.
- Below: icon + "All issues" title with description field.
- Right side: "Save to Personal" (or team) dropdown, Cancel, "Create view" button.
- Issues | Projects tabs below title.
- Filter bar under tabs: chips show active filters (e.g. "is: open", "status: In Progress").
- "Add Filter..." button on right of filter bar.
- Each view in the sidebar has a small icon (varies by view type).

### 1.2 Add Filter menu (`F`)
From local refs2 screenshots:
- Tall vertical menu, ~280px wide, dark popover surface.
- Sections: AI filter, Advanced filter, then field list.
- Field list: Status, Status type, Assignee, Agent, Creator, Priority, Estimate, Labels, Relations, Suggested label, Dates, Project, Project properties, Initiative, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template.
- Each row has an icon on the left, label, and right chevron indicating submenu.
- Keyboard: `F` opens unless focus is in a text field.

### 1.3 Move to project picker (`Shift+P`)
From local refs2 screenshots:
- Searchable dropdown, "Move to project..." placeholder.
- "No project" at top with `0` count.
- Section header: "Projects in {team} team".
- Each project row: icon + name, checkmark on selected, hover reveals a detail card on right.
- Detail card shows: project identifier chip, project name, status badge, owner, priority, progress %, issue count.
- Bottom: "New project" button, "Create new project..." link.
- Keyboard: `Shift+P`.

### 1.4 Inbox
From local refs2 screenshots:
- Sidebar item "Inbox" with badge count (e.g. "2").
- Click opens an Inbox list of notifications.
- Each item: avatar + issue key + summary + action text ("Closed by {user}").
- "..." menu on Inbox header.

### 1.5 Left sidebar structure
From local refs2 screenshots:
- Top: workspace pill (avatar + name + dropdown chevron).
- Below: Inbox, Pulse (with count), Agent.
- Section: "Workspace ▾" with items: Projects, Views, Initiatives, More.
- Section: "Favorites ▾" with folder support, nested items, drag handles, add-folder icon.
- Section: "Your teams ▾" with team name, then nested: Home, Triage (with count), Issues, Cycles (with Current/Upcoming sub-items), Projects, Views.
- Bottom: "Try ▾", "+ Invite people", "Connect GitHub".
- Nav items are 28px height, 8px radius, with icons.

### 1.6 Icon spec (from public Linear splash + local screenshots)
- Status circles: 14×14px, 1.5px stroke (hollow for some states), filled for active.
- Priority: small flag/triangle icons, ~12×12px.
- Project: small cube/box icon, ~14×14px.
- Cycle: small clock/arrow icon, ~12×12px.
- Label dots: 8×8px filled circle, same colour as label background.
- Avatar: 20×20px circle, border 1px hairline, fallback initials.
- Sidebar nav icons: 16×16px, stroke 1.5px, muted colour, active state uses accent.

---

## 2. Gap analysis: pipe-kan current vs Linear target

### 2.1 Views (Issues/Projects tabs, New view, Save to)

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Issues / Projects tabs at top of view | Board/Calendar/Timeline tabs only; no Issues/Projects grouping | Missing Issues/Projects tabs |
| "New view" create flow with title, description, Save to | No view creation flow | Missing entire create-view UI |
| Per-view icon in sidebar | No view icons | Missing view icon system |
| Filter bar with chips under tabs | ViewFilterChips exist but not in a filter bar | Needs repositioning into a bar |
| "Add Filter..." button in filter bar | Filter button in header; no "Add Filter..." | Rename/reposition |

### 2.2 Add Filter menu

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Full field list (21 items) | Filter menu has Status, Assignee, Priority, Labels, Project only | Missing ~16 filter types |
| AI filter row | Not present | Add UI-only row |
| Advanced filter row | Not present | Add row (opens existing facet logic) |
| Submenus with chevrons | Simple toggles | Needs nested menu architecture |
| Agent, Creator, Estimate, Relations, etc. | Not present | Add disabled/skeleton rows |

### 2.3 Move to project picker

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Searchable project dropdown | No move-to-project UI | Missing entirely |
| Hover detail card | Not present | Missing detail card |
| Checkmark on selected | Not present | Needs selection indicator |
| "No project" option | Not present | Needs option |
| Keyboard `Shift+P` | Not present | Needs shortcut |

### 2.4 Inbox

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Inbox sidebar item with badge | Not present | Missing sidebar item |
| Notification list | Not present | Missing view |
| Unread count badge | Not present | Needs synthetic count |

### 2.5 Left sidebar

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Workspace section (Projects/Views/Initiatives/More) | Initiatives/Projects buttons exist but not grouped under "Workspace" | Needs grouping + "Views" + "More" |
| Favorites with folders, drag, add-folder | linearFavorites exist but no folders/drag/add-folder | Missing folder UI for Linear favorites |
| "Your teams" with nested items | "Joined Projects" exists but no team grouping | Needs team→nav nesting |
| Cycles (Current/Upcoming) | Not present | Add disabled placeholders |
| Try / Invite / Connect | Not present | Add footer items |
| Inbox + Pulse + Agent at top | Agent exists in header; no Inbox/Pulse sidebar items | Needs repositioning |

### 2.6 Icon spec

| Linear feature | pipe-kan current | Gap |
|---|---|---|
| Status circles with stroke rules | Status dots exist but not spec'd | Needs formal spec |
| Priority flags at 12×12 | Lucide icons used; sizes not locked | Needs size/stroke spec |
| Label dots 8×8 | Labels are pills, not dots | Needs dot variant spec |
| Avatar 20×20 with border | Avatars not used in cards | Needs spec for when added |

---

## 3. Design direction

### 3.1 Views create flow
- When the "Views" sidebar button is clicked (currently opens filter), change to open a view browser.
- Views browser shows: Personal views (grouped under "Personal") and Workspace views (grouped under workspace name).
- "New view" button opens a composer overlay:
  - Icon selector (left of title).
  - Title input (e.g. "All issues").
  - Description input (optional).
  - Issues | Projects tabs.
  - "Save to" dropdown: Personal or team.
  - Filter bar with chips.
  - "Create view" primary button.
- Fake data example: "Acme Demo", "DEMO-12".

### 3.2 Add Filter menu
- Expand existing `FilterMenu` or replace with a new `AddFilterMenu` component.
- 21 rows, each with icon + label + chevron.
- Clicking a row opens a submenu popover (to the right) with filter values.
- Rows that have no backend (Agent, Creator, Estimate, Relations, Suggested label, Cycle, Added to cycle, Subscribers, Auto-closed, Content, Links, Template) are shown disabled with "Coming soon" tooltip or dimmed.
- Rows with backend (Status, Status type, Assignee, Priority, Labels, Dates, Project, Project properties, Initiative) are active.
- Keyboard: `F` opens/closes. Arrow keys navigate. Enter selects. Escape closes.

### 3.3 Move to project picker
- New component `ProjectPicker`.
- Triggered by: row context menu on issue cards, or keyboard `Shift+P` when an issue is selected/open.
- Search input at top filters projects by name/identifier.
- "No project" row at top with count.
- Sectioned by team/workspace.
- Hovering a project row shows a detail card to the right with: project identifier, name, status, health, priority, progress bar, issue count.
- Selecting a project calls existing scope/project change logic.

### 3.4 Inbox
- New sidebar item "Inbox" with a badge count.
- Badge is synthetic: count of issues with `needs-input` label, or a fixed fixture count.
- Clicking opens an Inbox view in the main canvas.
- Inbox shows a list of notification-like items (synthetic: "Issue DEMO-12 updated", "DEMO-3 assigned to you").
- Each item: avatar placeholder + text + dismiss.
- "..." menu with "Mark all read".

### 3.5 Left sidebar redesign
Restructure sidebar nav to match Linear's vertical hierarchy:

```
[Workspace pill (avatar + name + chevron)]

Inbox          [2]
Pulse
Agent

Workspace ▾
  Projects
  Views
  Initiatives
  More

Favorites ▾
  [folder icon] Roadmap
    DEMO-1 Ship v2
    DEMO-2 Fix login
  [folder icon] Sprint 42
    DEMO-5 Board drag
  DEMO-3 Unfiled fav
  [+ add folder icon]

Your teams ▾
  [team icon] Acme-product ▾
    Home
    Triage          [15]
    Issues
    Cycles ▾
      Current
      Upcoming
    Projects
    Views

Try ▾
+ Invite people
Connect GitHub
```

- Each nav item is 28px height, 8px radius, 12px font, 500 weight.
- Section headers are 11px, muted, uppercase, with ▾/▸ collapse chevron.
- "Your teams" maps to existing `JoinedProjects` but nests under a team name.
- "Favorites" uses existing `linearFavorites` but adds folder grouping with drag-to-file.
- Footer items are muted, 12px.

### 3.6 Icon spec
See `icon-spec.md` for full details. Summary:
- Status: 14px circles, stroke 1.5px, filled/hollow per state.
- Priority: 12px triangles/flags, stroke 1.5px.
- Project: 14px cube, stroke 1.5px.
- Cycle: 12px clock-arrow, stroke 1.5px.
- Label dot: 8px filled circle.
- Avatar: 20px circle, 1px border, fallback initials 10px.
- Nav icons: 16px, stroke 1.5px, colour `--muted-foreground` idle, `--foreground` active.

---

## 4. File inventory (no edits — reference for maker)

| File | Relevance |
|---|---|
| `src/App.tsx` | Sidebar nav structure, header, board tabs, filter menu, state |
| `src/components/linear-views.tsx` | `ViewFilterEditor`, `ViewFilterChips`, `FavoriteRows`, `JoinedProjects`, `DisplayOptionItems`, `RowContextMenu` |
| `src/components/linear-chrome.tsx` | `TeamsPage`, `TeamHome`, `RoadmapTable`, `InitiativeOverview`, `ProjectOverview` |
| `src/components/command-overlay.tsx` | Command palette UI |
| `src/parity.ts` | `ViewFilter`, `SavedView`, `LinearFavorite`, `DisplayOptions`, `computeHealth`, `matchViewFilter` |
| `src/visible.ts` | `FavouriteFolder`, `addFolder`, `moveFavourite`, `removeFolder`, `renameFolder` |
| `src/index.css` | Design tokens |

---

## 5. Acceptance criteria (operator)

1. **Views create flow** — Sidebar "Views" opens a view browser. "New view" opens composer with icon selector, title, description, Issues/Projects tabs, Save to dropdown, filter bar, Create view button. Fake data only.
2. **Add Filter menu** — `F` opens a 21-row menu with icons and chevrons. Backend rows work; non-backend rows are disabled/dimmed. Submenus show filter values.
3. **Move to project** — `Shift+P` opens searchable picker. Hover shows detail card. Selection updates issue project.
4. **Inbox** — Sidebar shows "Inbox" with badge count. Click opens notification list. Synthetic data only.
5. **Sidebar** — Restructured to Workspace/Favorites/Your teams/Try hierarchy. Favorites support folders with drag and add-folder. Teams nest under team name with Cycles/Projects/Views.
6. **Icon spec** — All small icons match size/stroke/colour/states in `icon-spec.md`.
7. **Smoke test** — Synthetic fixtures render all new UI. Screenshots + console log in PR.
8. **UI review gate** — Opus UI specialist review with pipe-kan vs local refs screenshots. Kimi Referee (ollama-cloud/kimi-k2.6) validates spec compliance.
9. **Performance guard** — No regression vs 0.34.2 on board cold load and cached project/workspace switches. Measurement: `performance.now()` from initial paint to first column render. Budgets: cold load ≤ baseline + 50ms; switch ≤ baseline + 30ms.
10. **No Jira regression** — New sidebar items hidden in Jira mode where not applicable. Existing behaviour unchanged.

---

## 6. References

- Linear Docs — Views: https://linear.app/docs/views
- Linear Docs — Filters: https://linear.app/docs/filters
- Linear Docs — Inbox: https://linear.app/docs/inbox
- Linear Docs — Keyboard shortcuts: https://linear.app/docs/keyboard-shortcuts
- Prior plan: `docs/factory/plans/gbj-20261018-019-pipekan-linear-parity/`
- Prior plan: `docs/factory/plans/gbj-20261017-014/`
- Local screenshots: `linear-refs-local/` (untracked, never commit)
