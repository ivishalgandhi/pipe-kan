# tickets.md — gbj-20261017-014 pipecan linear ui

Slice 1 (T1–T8) is implemented on `feat/pipecan-linear-ui-maker-20261018`. Grill choices are in `grill.md`. Smoke output is in `smoke-log.md`.

## Slice 1: Board, Sidebar, Open pane, Command overlay, Dark theme

---

### T1 — Theme tokens and CSS foundation

**What**  
Update `src/index.css` color tokens to match Linear's splash palette. Add scrollbar tokens and `@layer base` scrollbar styles. Adjust radius tokens (controls 8px, cards 9px, panes 12px).

**Files**  
- `src/index.css`

**Acceptance**
1. Light mode: `--sidebar` `#efeff0`, `--background` `#f9f9fa`, `--border` `#e2e2e2`, `--muted-foreground` `#b0b5c0`.
2. Dark mode: `--sidebar` `#09090a`, `--background` `#121213`, `--border` `#212224`, `--muted-foreground` `#6b6f76`, `--sidebar-accent` `#ffffff08`.
3. New tokens present: `--bg-border-color`, `--content-color`, `--content-highlight-color`, `--focus-color`, `--shadow-color`, `--scrollbar-color`, `--scrollbar-color-hover`.
4. Scrollbar CSS in `@layer base` sets `scrollbar-width: thin` and WebKit thumb/track rules.
5. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```
Open the app, toggle theme via sun/moon button. Inspect `:root` and `.dark` variables in DevTools. Screenshot both modes.

---

### T2 — Layout shell density

**What**  
Restyle the app shell so the board pane floats with uniform 8px inset and 12px radius. Tighten sidebar nav items to 28px height with 8px radius and 5% hover wash. Tighten epic rows (`EpicButton`) to 40px height with 8px radius.

**Files**  
- `src/App.tsx` (root layout, sidebar nav, `EpicButton`, `EpicStatusGroup`)

**Acceptance**
1. Board pane `div` has `p-2` on all sides (not `p-2 pl-0`), `rounded-[12px]`, `border border-[var(--bg-border-color)]`.
2. Sidebar nav buttons (All stories, All epics, Combined, Calendar) are `h-7` (28px), `rounded-lg` (8px), `px-[7px]`, font 13px/500.
3. Sidebar nav hover uses `hover:bg-foreground/[0.05]` (light) and `hover:bg-white/[0.05]` (dark) or equivalent via Tailwind.
4. `EpicButton` row is `h-10` (40px), `rounded-lg` (8px), padding `px-3`.
5. `EpicButton` selected state uses `bg-sidebar-accent` which maps to `#ffffff08` in dark.
6. Favourites / Presets / Epic group headers are 28px height, 8px radius, 11px muted labels.
7. No visual regression in sidebar collapse/expand.

**Verification**
```bash
bun run typecheck
bun run build
```
Launch with Fake Jira (`JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bunx pipe-kan`). Screenshot sidebar with All stories selected and an epic hovered.

---

### T3 — Header chrome

**What**  
Restyle the board header controls to Linear's 28px pill language. Restyle search input and scope input to muted, border-transparent, 28px height. Restyle Filter/Sort/Columns/Display/Refresh/Agent/Theme buttons to 28px ghost pills.

**Files**  
- `src/App.tsx` (header section inside board panel)

**Acceptance**
1. Board | Calendar tabs: `h-7 rounded-lg px-2 text-[13px] font-medium`.
2. Project badge / workspace picker: `h-7 rounded-lg px-2 text-[11px] font-medium`.
3. Search `InputGroup`: `h-7 bg-muted border-transparent shadow-none`, placeholder muted, icon 14px.
4. Scope flags input: `h-7 bg-muted border-transparent rounded-md px-2 text-[13px]`.
5. Filter / Sort / Columns / Display / Refresh / Agent buttons: `variant="ghost" size="sm" className="h-7 rounded-lg px-2 text-[13px]"`.
6. Theme toggle: `size="icon-xs"` with 28px hit area.
7. Error text stays below header, `text-destructive text-[13px]`.
8. No button text wraps at reasonable widths (≥1280px).

**Verification**
```bash
bun run typecheck
bun run build
```
Launch with Fake Jira. Screenshot header at default width. Verify all controls visible and aligned.

---

### T4 — Card and column chrome

**What**  
Restyle `IssueCard` and `StatusColumn` to match Linear's board card language. Card: 9px radius, hairline border, 8px/10px/12px/12px padding, no shadow, hover wash. Column header: not a card, status dot 14px, title 13px/500, count 12px muted tabular, 12px column gap.

**Files**  
- `src/App.tsx` (`IssueCard`, `StatusColumn`)

**Acceptance**
1. Card outer `div`: `bg-card rounded-[9px] border border-[var(--bg-border-color)] px-3 pt-2 pb-3` (current is close; tighten padding to `8px 10px 12px 12px` if feasible without breaking layout).
2. Card hover: `transition-colors duration-150`, hover background `var(--accent)` (`#ffffff08` dark, `#e4e4e6` light).
3. Card header row: `flex h-[22px] items-center justify-between gap-2`.
4. Issue key: `text-[12px] font-medium tabular-nums text-muted-foreground`.
5. Card title: `text-[13px] leading-[18px] truncate`.
6. Footer priority pill: `h-6 rounded-full border px-2 text-[12px] font-medium capitalize`.
7. Footer label pill: `h-6 rounded-full border px-2 text-[12px] text-muted-foreground`.
8. `StatusColumn` header: `flex items-center gap-2 px-3 pt-[13px] pb-5` — keep structure but ensure status dot is `size-3.5` (14px), title `text-[13px] font-medium`, count `text-[12px] tabular-nums text-muted-foreground`.
9. Column gap is `gap-3` (12px) in `KanbanBoard`.
10. Cards container gap is `gap-2` (8px).
11. Epic card variant no longer has `border-l-4 border-l-primary`; instead uses the same card chrome with a subtle "Epic" type pill.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```
Launch with Fake Jira. Verify cards show priority, labels, assignee, age. Screenshot one column with mixed cards. Drag a card to another column — move still works.

---

### T5 — Properties rail (Open pane)

**What**  
Restyle the right-side Open pane into a Linear-style properties rail. Narrow to 320px, hairline left border, properties as label/value stack (not DL grid). Add status dot to status row. Optionally render epic children if the opened issue is an epic.

**Files**  
- `src/App.tsx` (`OpenFields`, open pane panel)

**Acceptance**
1. Open pane panel: `w-80` (320px) when open, `min-w-72` (288px) under 1280px.
2. Open pane border: `border-l border-[var(--bg-border-color)]`.
3. Header: key displayed as a breadcrumb-style chip `h-7 rounded-lg px-2 text-[13px] font-medium tabular-nums bg-muted` or as plain linked text.
4. `OpenFields` replaced or restyled: each field is a vertical stack — label `text-[11px] font-medium text-muted-foreground`, value `text-[13px] text-foreground`, gap between label and value `4px`, gap between rows `12px`.
5. Status row shows a colored dot (`size-3.5 rounded-full`) next to the status text.
6. Labels row shows horizontal flex-wrap of 24px rounded pills (same as card labels).
7. Jira URL is a link under the key, not a separate labeled row. Or keep it as a compact link row.
8. No `dl` / `dt` / `dd` tags; use `div` stacks for styling flexibility.
9. iframe (if same-origin) has `rounded-lg` and `min-h-64`. Remote Jira message stays muted.
10. If opened issue is an epic and has children, show a "Children" section with a collapsible list of child keys + summaries (optional; if too large, defer to T6).

**Verification**
```bash
bun run typecheck
bun run build
bun test
```
Launch with Fake Jira. Click a card — Open pane opens. Screenshot properties rail. Verify all fields render. Click Edit — composer opens. Close pane — board visible.

---

### T6 — Command overlay restyle

**What**  
Restyle `CommandOverlay` to match Linear's quick-search modal: 12px radius, input 44px, rows 40px, selected row `bg-accent` with inset 1px focus ring, hover wash, group labels 11px muted.

**Files**  
- `src/components/command-overlay.tsx`

**Acceptance**
1. Modal container: `bg-popover rounded-xl border shadow-md` — keep, ensure radius is 12px (`rounded-xl` is 12px in Tailwind default).
2. Input row: `flex h-11 items-center gap-2 border-b px-3` — keep height 44px (11 * 4px = 44px), but remove heavy border; use `border-b border-[var(--bg-border-color)]`.
3. Input text: `text-[13px]` weight 450, placeholder muted.
4. Row button: `flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px]`.
5. Selected row: `bg-accent text-foreground shadow-[inset_0_0_0_1px_var(--ring)]`.
6. Hover row: `hover:bg-accent/50`.
7. Group label: `text-muted-foreground px-3 py-1 text-[11px] font-medium`.
8. kbd hint: `rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground`.
9. Keyboard navigation (Up/Down/Enter) unchanged.
10. `bun test` covers command overlay if tests exist.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```
Launch with Fake Jira. Press `Cmd+K`. Type "create". Navigate with arrows. Screenshot overlay with selected row. Press Escape — overlay closes.

---

### T7 — Calendar minimal restyle

**What**  
Apply Linear surface tokens to `BoardCalendar` wrapper: background `--background`, border-radius 12px on the wrapper, typography tokens on FullCalendar overrides.

**Files**  
- `src/components/board-calendar.tsx`
- `src/index.css` (`.pk-calendar` overrides)

**Acceptance**
1. Calendar wrapper `div` has `bg-background rounded-xl border border-[var(--bg-border-color)]`.
2. `.pk-calendar .fc-toolbar-title`: `text-[13px] font-medium`.
3. `.pk-calendar .fc-button`: `h-7 text-[12px] rounded-lg`.
4. `.pk-calendar .fc-event`: `rounded-md text-[11px]`.
5. `.pk-calendar .fc-event-key`: inherits body font, 12px.
6. Calendar fills pane height (`h-full`).
7. No FullCalendar structural changes.

**Verification**
```bash
bun run typecheck
bun run build
```
Launch with Fake Jira. Click Calendar in sidebar. Verify month grid renders. Screenshot.

---

### T8 — Smoke test fixture data

**What**  
Extend `fixtures/issues.json` to include at least 20 issues across 3+ statuses, with varied priorities, assignees, labels, due dates, target end dates, and 3 epics with children. Add one epic with `needs-input` label.

**Files**  
- `fixtures/issues.json`

**Acceptance**
1. File contains ≥20 issues.
2. Statuses: "To Do", "In Progress", "Done" (or equivalent).
3. Priorities: at least one each of "Highest", "High", "Medium", "Low".
4. Assignees: at least 3 distinct names.
5. Labels: includes "needs-input", "bug", "feature", "design".
6. Due dates: at least one past, one within 3 days, one future.
7. Target end dates: at least one past, one future.
8. ≥3 epics with `issuetype.name = "Epic"`.
9. Epic children linked via `customfield_10014` or `parent` fields.
10. Fake Jira config writes correctly (`JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml`).

**Verification**
```bash
bun test
bun run build
JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bun run dev &
sleep 5
curl -s http://127.0.0.1:5173/api/board | jq '.columns | length'
curl -s http://127.0.0.1:5173/api/board | jq '.epics | length'
```
Capture browser console logs and screenshot. Attach to PR as `smoke-log.md`.

**Smoke test run command**
```bash
# Terminal 1
JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bun run dev

# Terminal 2 (after dev server ready)
curl -s http://127.0.0.1:5173/api/board | jq '.'
```

**Smoke test log artifact**
Save to `docs/factory/plans/gbj-20261017-014/smoke-log.md`:
- `bun test` output
- `bun run typecheck` output
- Screenshot URLs or file paths
- Browser console export (if any errors)

---

## Ticket order

1. **T1** first (tokens are a dependency for everything).
2. **T2** and **T3** can be parallel (layout shell + header are independent).
3. **T4** after T1 (cards need tokens).
4. **T5** after T4 (Open pane shares card field rendering).
5. **T6** after T1 (overlay needs tokens).
6. **T7** after T1 (calendar needs tokens).
7. **T8** last (fixture data can be updated independently, but smoke test needs all UI tickets done).

---

## Notes

- **List view** (Linear-style dense issue list) is deferred to a future slice. The current Board stays default.
- **Issue peek** (Space modal) is implemented as the restyled Open pane (T5). A true transient peek overlay can be added later.
- **Agent panel** is out of scope for slice 1.
- **Taskwarrior backend** is out of scope for slice 1.
- **REA clone** is not required for slice 1; existing `docs/research/linear-ui.md` is sufficient.
