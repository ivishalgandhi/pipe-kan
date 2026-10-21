# Competitive review — 2026 task managers with kanban

gbj-20261020-035-taskwarrior-kanban-ui

## Scope
Linear, Todoist, Things 3, TickTick, Notion, Plane, Vikunja, Super Productivity; plus Height/Asana/Trello/Akiflow/Sunsama and Taskwarrior TUIs (taskwarrior-tui, vit) where useful.

## Feature matrix

| Tool | Board | List | Today/Upcoming | Calendar/Timeblock | Quick-add NLP | Keyboard | Cmd+K | Offline | Recurrence | Subtasks/Depends | Filters/Saved views | Sharing | Mobile/PWA |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Linear | ✅ | ✅ | ✅ Inbox | ✅ Timeline | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ Blocks | ✅ Views | ✅ Team | ❌ Web only |
| Todoist | ✅ (boards) | ✅ | ✅ Today/Upcoming | ✅ (integrations) | ✅ Best-in-class | ✅ | ✅ | ✅ | ✅ | ✅ Subtasks | ✅ Filters | ✅ | ✅ iOS/Android |
| Things 3 | ✅ Projects | ✅ | ✅ Today/Upcoming | ❌ | ✅ Magic Plus | ✅ | ❌ | ✅ | ✅ Projects=lists | ✅ Projects | ❌ Tags only | ❌ iCloud | ✅ macOS/iOS |
| TickTick | ✅ Kanban | ✅ | ✅ Today | ✅ Calendar | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ Subtasks | ✅ Smart Lists | ✅ | ✅ All platforms |
| Notion | ✅ Board | ✅ | ✅ (databases) | ✅ Calendar | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ Relations | ✅ Views | ✅ | ✅ All platforms |
| Plane | ✅ Board | ✅ | ✅ Cycles | ✅ Timeline | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ Depends | ✅ Views | ✅ Team | ❌ Web only |
| Vikunja | ✅ Kanban | ✅ | ❌ | ✅ Gantt | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ Subtasks | ✅ Filters | ✅ | ✅ iOS/Android |
| Super Productivity | ✅ Kanban/Eisenhower | ✅ | ✅ Today | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ | ✅ Subtasks | ✅ | ❌ | ❌ Desktop/Web |
| Height | ✅ Board | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ | ✅ Team | ❌ Web only |
| Trello | ✅ Board | ✅ (but weak) | ❌ | ✅ Power-Up | ❌ | ✅ | ❌ | ❌ | ✅ ( Butler) | ✅ Checklists | ❌ | ✅ | ✅ All platforms |
| Akiflow | ❌ (list only) | ✅ | ✅ Today | ✅ Calendar+Timeblock | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ Web only |
| Sunsama | ✅ Board | ✅ | ✅ Today | ✅ Timeblock | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ Subtasks | ✅ | ❌ | ❌ Web only |
| taskwarrior-tui | ✅ Kanban | ✅ | ❌ | ❌ | ❌ | ✅ vim | ❌ | ✅ | ✅ | ✅ depends | ✅ | ❌ | ❌ Terminal |
| vit | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ vim | ❌ | ✅ | ✅ | ✅ depends | ✅ | ❌ | ❌ Terminal |

Sources:
- Linear Docs — Board layout: https://linear.app/docs/board-layout
- Linear Enablement — Navigating: https://linear.app/enablement/guide/navigating-linear
- Todoist Quick Add NLP: https://www.todoist.com/help/todoist/product-updates/a-cleaner-simpler-quick-add-june-29-PuIpiLmLh
- Things 3 NLP: https://culturedcode.com/things/support/articles/9780167
- Vikunja features: https://vikunja.io/features/
- Super Productivity: https://super-productivity.com/app/
- Plane: https://plane.so (product pages, 2026)
- TickTick features: https://beta.ticktick.com/features
- Taskwarrior sync docs: https://taskwarrior.org/docs/sync
- taskwarrior-tui: https://github.com/kdheepak/taskwarrior-tui
- vit: https://github.com/vit-project/vit

## UX bar (what "best-in-class 2026" means)

### Latency
- **Linear**: <100ms for issue create, <50ms for status change (optimistic UI + WebSocket). Gold standard.
- **Todoist**: ~200ms for add, optimistic list reorder. Very good.
- **Things 3**: Instant (local Core Data). Benchmark for offline-first.
- **pipe-kan today**: Jira write-back is jira-cli process spawn (~1-2s). Plane is REST (~300-800ms). Taskwarrior will be local `task` spawn (~100-500ms).

**Copy**: optimistic UI (move card immediately, toast on error), skeleton screens on first load, no blocking spinners for local actions.
**Skip**: real-time WebSocket sync (overkill for a single-user Taskwarrior setup).

### Density
- **Linear**: 8px gutters, 28px controls, hairline borders, no chrome chrome. Maximal information per px.
- **Things 3**: whitespace-forward but still dense. Beautiful empty states.
- **Todoist**: slightly less dense, more padding.

**Copy**: pipe-kan already has Linear parity tokens (8px inset, 12px radius board, 9px card radius, 28px header controls). Keep them.
**Skip**: Trello's excessive card padding and drop-shadow heaviness.

### Motion
- **Linear**: subtle spring on card move, smooth column collapse.
- **Things 3**: spring animations on add/remove, fluid layout changes.

**Copy**: dnd-kit already handles this. Keep `layoutId` transitions for view switches.
**Skip**: Notion's slow database re-renders.

### Empty states
- **Linear**: contextual empty states with a "New issue" CTA and shortcut hint.
- **Things 3**: "You're all caught up" with celebratory micro-animation.
- **Todoist**: "No tasks yet — add one with q".

**Copy**: contextual empty states per column (Inbox: "Press C to add"; Active: "Drag a card here or press S to start a task").
**Skip**: generic "No items" placeholders.

### Keyboard-first
- **Linear**: every action has a shortcut. `C` = new issue, `Cmd+K` = command, `Shift+V` = display, `O` `W` = switch workspace, `E` = edit, `D` = done, `#` = label, `@` = assignee.
- **Todoist**: `q` = quick add, `Shift+A` = add above, `Shift+T` = today.
- **Things 3**: `Cmd+N` = quick add, `Space` = expand, `Tab` = indent (subtask).

**Copy**: Linear's shortcut density. `C` quick-add, `Cmd+K` palette, `E` edit, `D` done/complete, `S` start/stop, single-key navigation (J/K) on cards.
**Skip**: vim-mode (too niche for a web app; taskwarrior-tui already serves that audience).

### Quick-add NLP
- **Todoist**: best-in-class. "Buy milk tomorrow at 5pm #groceries p1" → due tomorrow, project groceries, priority 1.
- **Things 3**: natural language dates in Magic Plus. "Call mom in 2 hours".
- **Linear**: no NLP; structured fields only.

**Copy**: Todoist-style NLP for project (`+project`), tags (`@tag`), due (`tomorrow`, `next week`), priority (`p1`/`H`/`M`/`L`).
**Skip**: LLM-based parsing (unreliable, adds latency). Regex-based extraction is enough.

### Calendar/Timeblock
- **Akiflow/Sunsama**: drag tasks onto calendar slots. Time-blocking as first-class.
- **Linear**: Timeline for projects/initiatives only. No personal time-blocking.
- **Todoist**: calendar integration via third-party.

**Copy**: Calendar view (like pipe-kan's existing Board | Calendar tabs) showing due/scheduled dates. Not time-blocking — that's what `/timebox` is for and it stays untouched.
**Skip**: Drag-to-calendar-slot (out of scope; would need fullcalendar-premium or custom DnD calendar).

### Offline
- **Things 3/Todoist**: full offline, sync when back online.
- **Linear/Plane**: no offline.

**Copy**: pipe-kan is already local-first (fixture on first paint, store in memory). With Taskwarrior as source, the replica is local; offline is natural.
**Skip**: Complex sync conflict resolution (single user, single replica).

### Subtasks / Dependencies
- **Linear**: blocks/blocked-by, sub-issues.
- **Todoist**: subtasks (indent), sections.
- **Taskwarrior native**: `depends:` field (UUID refs), no native subtasks.

**Copy**: Taskwarrior `depends` field visualized as "Blocked by" on card detail. No nested subtask UI (Taskwarrior doesn't have them natively; annotations are the closest thing).
**Skip**: True subtask nesting (would require UDA or project hierarchy hack).

## What to copy vs skip — summary

| Feature | Copy from | Skip because |
|---|---|---|
| Kanban density + motion | Linear | — |
| Keyboard shortcuts (C, E, D, S, Cmd+K) | Linear | — |
| Quick-add NLP (+project, @tag, due, priority) | Todoist | — |
| Today/Upcoming sidebar lens | Things 3/Todoist | — |
| Calendar view (due/scheduled) | pipe-kan existing | — |
| Empty states with action hints | Linear/Things 3 | — |
| Optimistic UI + toasts | Linear | — |
| Synthetic health from status+date | pipe-kan Plane parity | Reuse existing heuristic |
| Project sidebar as scopes | Things 3 | Taskwarrior projects are flat |
| Tag sidebar | Things 3/Todoist | Taskwarrior tags are first-class |
| Time-blocking / drag-to-calendar | — | `/timebox` already exists |
| Real-time sync | — | Single-user local replica |
| Native subtasks | — | Taskwarrior has `depends` only |
| Sharing/multiplayer | — | Single-user instance |
| Mobile app/PWA | — | Out of scope for first slice |

## Taskwarrior TUI comparison

| Tool | Board | Keyboard | Due date viz | Urgency sort | Annotations | Contexts |
|---|---|---|---|---|---|---|
| taskwarrior-tui | ✅ Kanban columns | ✅ vim-style | ✅ | ✅ | ❌ | ✅ |
| vit | ❌ List only | ✅ vim-style | ✅ | ✅ | ✅ | ✅ |
| **pipe-kan TW profile** | ✅ + List + Calendar | ✅ Cmd+K + shortcuts | ✅ Calendar | ✅ Urgency column | ✅ Detail pane | ✅ Sidebar |

The pipe-kan profile beats TUIs on view variety (Board/List/Today/Calendar) and visual polish, while keeping the same data fidelity.
