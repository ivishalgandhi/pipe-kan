# spec.md — gbj-20261017-014 pipecan linear ui

## Goal
Restyle pipe-kan to match Linear's visual language: dense, low-chrome, warm-gray palette, hairline borders, 8–12px radius, Inter Variable at 450/500 weights. First slice covers Board, Sidebar, Open/Peek pane, Command overlay, and dark-theme token alignment.

## Non-goals
- Do not add Linear features we don't have (cycles, estimates, projects as first-class entities, activity feed).
- Do not restyle Agent panel in first slice.
- Do not add Taskwarrior backend in first slice.
- Do not add true "list view" (Inbox-style dense rows) in first slice; keep Board default.

---

## 1. Design tokens

Source: `docs/research/linear-ui.md` §1.2 (splash), §1.4 (marketing), §2 (typography), §3 (layout).

### 1.1 Color

Update `:root` and `.dark` in `src/index.css`. Keep existing variable names where possible; adjust values.

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--background` | `#f9f9fa` | `#121213` | Main pane surface (`bgBase`) |
| `--foreground` | `#23252a` | `#ffffff` | Primary text (`labelHighlight`) |
| `--card` | `#ffffff` | `#18191a` | Card surface (`bgPanel`) |
| `--card-foreground` | `#23252a` | `#ffffff` | Card text |
| `--popover` | `#ffffff` | `#171718` | Menu / dropdown surface |
| `--popover-foreground` | `#23252a` | `#ffffff` | Menu text |
| `--primary` | `#6d78d5` | `#6d78d5` | Accent / buttons (`controlPrimary`) |
| `--primary-foreground` | `#ffffff` | `#ffffff` | On-primary text |
| `--secondary` | `#efeff0` | `#19191c` | Secondary surfaces (`bgSub`) |
| `--secondary-foreground` | `#23252a` | `#ffffff` | Secondary text |
| `--muted` | `#efeff0` | `#19191c` | Muted backgrounds |
| `--muted-foreground` | `#b0b5c0` | `#6b6f76` | Secondary / muted text (`labelMuted`) |
| `--accent` | `#e4e4e6` | `#1c1c1d` | Hover wash / selected (`bgSelected`) |
| `--accent-foreground` | `#23252a` | `#ffffff` | On-accent text |
| `--destructive` | `#eb5757` | `#eb5757` | Error |
| `--border` | `#e2e2e2` | `#212224` | Hairline borders (`bgBorder`) |
| `--input` | `#e2e2e2` | `#212224` | Input borders |
| `--ring` | `#7180ff` | `#7180ff` | Focus outline |
| `--sidebar` | `#efeff0` | `#09090a` | Left nav canvas (`bgSidebar`) |
| `--sidebar-foreground` | `#23252a` | `#ffffff` | Sidebar text |
| `--sidebar-primary` | `#6d78d5` | `#6d78d5` | Active nav item accent |
| `--sidebar-primary-foreground` | `#ffffff` | `#ffffff` | On-accent text |
| `--sidebar-accent` | `#e4e4e6` | `#ffffff08` | Selected row wash (8% white in dark) |
| `--sidebar-accent-foreground` | `#23252a` | `#ffffff` | On-selected text |
| `--sidebar-border` | `#e2e2e2` | `#212224` | Sidebar hairline |
| `--sidebar-ring` | `#7180ff` | `#7180ff` | Sidebar focus ring |

Add missing tokens:

```css
:root {
  --bg-border-color: #e2e2e2;
  --content-color: #b0b5c0;
  --content-highlight-color: #23252a;
  --focus-color: #7180ff;
  --shadow-color: rgba(0,0,0,0.05);
}

.dark {
  --bg-border-color: #212224;
  --content-color: #6b6f76;
  --content-highlight-color: #ffffff;
  --focus-color: #7180ff;
  --shadow-color: rgba(0,0,0,0.2);
}
```

### 1.2 Typography

- Family: Inter Variable (already in `index.html` via Google Fonts). Keep existing font stack.
- Body: 13px / weight 450 / line-height 1.4375rem (23px) for readable blocks.
- UI labels: 12px / weight 500.
- Card title: 13px / weight 450.
- Header title: 13px / weight 500.
- Mono (issue keys, tabular nums): Berkeley Mono if available, else existing stack. At minimum use `font-variant-numeric: lining-nums tabular-nums`.
- Display (if needed): weight 550, `font-variation-settings: "opsz" 28`.

### 1.3 Radius

- Controls (buttons, inputs): 8px (was 4–6px).
- Cards: 9px (was `rounded-[9px]` already — keep).
- Sidebar nav items: 8px (was `rounded-lg` ~8px — keep).
- Pills / badges: `9999px` (already `rounded-full`).
- Pane border: 12px (Board pane outer radius).
- Menu / popover: 8px.

### 1.4 Spacing / density

- Sidebar width: 244px (already close; keep).
- Board pane inset: 8px margin from viewport edge, 12px radius, 1px hairline border.
- Column gap: 12px.
- Card internal padding: 8px 10px 12px 12px (top right bottom left).
- Card stack gap: 8px (was `gap-2` ~8px — keep).
- Column header: padding `13px 12px 20px`.
- List row height: 40px (issue rows in sidebar).
- Header control height: 28px (pills, search trigger).

---

## 2. Layout shell

### 2.1 Page structure

Current: sidebar + board panel with `p-2 pl-0` and internal `rounded-xl border`.
Target: sidebar is the page background; board is a **floating rounded pane** with 8px inset from viewport edges.

In `src/App.tsx` root:
```tsx
<div className="bg-sidebar flex h-screen">
  {/* sidebar panel */}
  {/* handle */}
  <ResizablePanel id="board" ...>
    <div className="flex h-full min-h-0 flex-col p-2 pl-0">
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
```

Change to:
```tsx
<div className="bg-sidebar flex h-screen">
  {/* sidebar */}
  {/* handle */}
  <ResizablePanel id="board" ...>
    <div className="flex h-full min-h-0 flex-col p-2">
      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-[12px] border border-[var(--bg-border-color)]">
```

Remove `pl-0`; add uniform `p-2` so the board pane floats with 8px inset on all sides. On small viewports (`max-width: 1023px`) collapse margins to edge-to-edge (future responsive ticket).

### 2.2 Sidebar

- Background: `var(--sidebar)` (`#09090a` dark, `#efeff0` light).
- Nav items: height 28px, radius 8px, padding-inline 7px, gap 8px, font 12–13px/500.
- Hover: `#ffffff05` in dark, `#00000005` in light (subtle 5% wash).
- Active/selected: `var(--sidebar-accent)` (`#ffffff08` dark).
- Section labels: 11px, muted, padding `4px 0 4px 6px`, line-height 14px.
- Collapsible triggers: same 28px height, 8px radius.
- EpicButton rows: keep existing structure but tighten padding and ensure 8px radius on hover/selected.
- Favourites / Presets / Epic groups: reduce vertical spacing; gap 0.5px → 2px between rows.

### 2.3 Header chrome

Current header has: Board | Calendar tabs, project badge, workspace picker, search input, scope input, Filter/Sort/Columns/Display buttons, Refresh, Agent, theme toggle.

Restyle to Linear header:
- Tabs (Board | Calendar): 28px height, radius 8px, active state `bg-muted text-foreground`, idle `text-muted-foreground hover:text-foreground`.
- Project badge / workspace pill: 28px height, radius 8px, `bg-primary/10 text-primary` (keep).
- Search: replace large outlined input with a **28px muted pill button** that opens the existing Command overlay (`Cmd+K`). Linear's search is `Cmd/Ctrl F` inside a view; pipe-kan's is global jump. Keep the existing `InputGroup` for now but restyle it to 28px height, `bg-muted`, border transparent, shadow none. Or replace with a button that focuses into Command.
- Scope flags input: same 28px height, `bg-muted`, border transparent.
- Filter / Sort / Columns / Display: restyle dropdown triggers to 28px ghost buttons with 8px radius.
- Refresh / Agent / Theme: 28px icon-only ghost buttons.

### 2.4 Column chrome

- Column header: not a card. Status circle 14×14, title 13px/500, count 12px muted tabular.
- Collapsible trigger: full row clickable, chevron 14px.
- Column actions (+ create, hide): 14px icon buttons, quaternary color, hover tertiary.
- Column handle (drag): show on hover, 14px grip.
- Column gap: 12px.
- Cards container: padding `0 12px 12px 12px`, gap 8px.

---

## 3. Card restyle

Current card: `bg-card hover:bg-foreground/5 rounded-[9px] border px-3 pt-2 pb-3`.

Target card (Linear IssueCard):
```
border: 1px solid var(--bg-border-color);
background: linear-gradient(rgba(255,255,255,0.05), rgba(255,255,255,0.05)), var(--card);
border-radius: 9px;
padding: 8px 10px 12px 12px;
```

In Tailwind terms (dark mode aware):
```tsx
<div className="bg-card rounded-[9px] border border-[var(--bg-border-color)] px-3 pt-2 pb-3 hover:bg-accent/50 transition-colors duration-150">
```

Wait: Linear uses a `::after` pseudo-element for hover (`#ffffff08`), not a background class. Use Tailwind `hover:before:bg-foreground/[0.03] dark:hover:before:bg-white/[0.03]` or simply `hover:bg-accent/50` since `--accent` maps to `#ffffff08` in dark.

**Card header row:**
- Height: 22px.
- Left: status slot (14×14 circle) + issue key (12px, muted, tabular) + type badge (optional, 11px muted).
- Right: age or priority indicator.

**Card title:**
- 13px / 450 / line-height 18px.
- Ellipsis, nowrap.
- `mt-0.5`.

**Card footer:**
- `margin-top: auto` (pushes to bottom of card).
- Priority pill: height 24px, hairline border, rounded-full, text 12px.
- Label pills: height 24px, hairline, rounded-full, text 12px.
- Assignee / due date / target end: 11–12px muted, tabular where numeric.
- Avatars: not in current data model; skip.

**Epic card variant:**
- Current: `bg-muted/40 border-l-4 border-l-primary`.
- Target: same 9px radius, hairline, no left border. Epic type shown as a label pill or muted text. Keep it visually similar to story cards to avoid jarring differences.

---

## 4. Open pane → Properties rail

Current Open pane: 30% width, border-left, header with key + Edit + Close, then `OpenFields` (label/value pairs in a definition list), then iframe or "Jira refuses" message.

Target: Linear detail sidebar.
- Width: 320px (or 30% min 280px under 1280px).
- Border: hairline left (`var(--bg-border-color)`).
- Header: key as breadcrumb chip (28px, 8px radius, tabular), close button right.
- Body: properties as a vertical stack of label + value, not a DL grid.
- Each property row: label 11px muted, value 13px base. Spacing between rows: 12px.
- Status: shown as a colored dot + text pill.
- Labels: horizontal flex wrap of 24px rounded pills.
- Jira URL: rendered as a link under the key, not a separate "Jira URL" row.
- Children (if we add them): collapsible list of child issue keys + summaries.
- iframe: keep as-is but add `rounded-[8px]` inside the pane if it fits.

---

## 5. Command overlay restyle

Current: centered overlay, `bg-popover rounded-xl border shadow-md`, input with search icon, kbd hint, grouped rows.

Target: Linear quick-search overlay.
- Overlay background: `bg-black/40` (keep).
- Modal: `bg-popover rounded-xl border shadow-md` — change radius to 12px, border to hairline.
- Input: height 44px, 13px/450, no border-bottom (or subtle hairline), placeholder muted.
- Rows: 40px height, 8px radius, padding-inline 12px.
- Selected row: `bg-accent` (`#ffffff08` dark) + inset focus ring `box-shadow: 0 0 0 1px var(--ring) inset`.
- Hover row: `hover:bg-accent/50`.
- Group labels: 11px muted, padding `4px 12px`.
- Transition: `.15s` on background.

---

## 6. Dark theme alignment

Current dark tokens are close but need tuning:
- `--sidebar-accent` dark: change from `#1c1c1d` to `#ffffff08` (8% white overlay, matching Linear's selected row).
- `--accent` dark: change from `#1c1c1d` to `#ffffff08` or keep as hover wash.
- `--secondary` dark: `#19191c` → keep; matches Linear `bgSub`.
- `--muted-foreground` dark: `#6b6f76` → keep; matches Linear.
- `--border` dark: `#212224` → keep; matches Linear `bgBorder`.
- Add `color-scheme: dark` already present.

Ensure `document.documentElement.classList.toggle("dark", ...)` still works (already in `App.tsx`).

---

## 7. Scrollbars

Current: default browser scrollbars.
Target: Linear app scrollbars.

Add to `src/index.css`:
```css
@layer base {
  * {
    scrollbar-width: thin;
    scrollbar-color: var(--scrollbar-color) transparent;
  }
  *::-webkit-scrollbar {
    width: 12px;
    height: 12px;
  }
  *::-webkit-scrollbar-thumb {
    background-color: var(--scrollbar-color);
    border-radius: 12px;
    background-clip: content-box;
    border: 3px solid transparent;
  }
  *::-webkit-scrollbar-thumb:hover {
    background-color: var(--scrollbar-color-hover);
  }
  *::-webkit-scrollbar-track {
    background: transparent;
  }
}
```

Add tokens:
```css
:root {
  --scrollbar-color: rgba(0,0,0,0.15);
  --scrollbar-color-hover: rgba(0,0,0,0.25);
}
.dark {
  --scrollbar-color: rgba(255,255,255,0.12);
  --scrollbar-color-hover: rgba(255,255,255,0.20);
}
```

Hide scrollbars on surfaces that Linear hides them (board horizontal scroll): use `overflow-x-auto` but consider `scrollbar-width: none` for the board track if it conflicts with drag handles.

---

## 8. Smoke test data

Vishal's rule: smoke test with fake data, logs attached to PR.

### 8.1 Extend fixtures

File: `fixtures/issues.json`

Current fixture is minimal. Add:
- At least 20 issues across 3+ statuses (To Do, In Progress, Done).
- Mix of priorities: Highest, High, Medium, Low.
- Mix of assignees: "Alice", "Bob", "Carol".
- Mix of labels: "bug", "feature", "needs-input", "design", "ai".
- Mix of due dates and target end dates (some past, some future within 3 days).
- At least 3 epics with children.
- One epic with `needs-input` label.

### 8.2 Smoke test command

```bash
JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bunx pipe-kan
```

Verify visually:
1. Dark theme loads by default if OS is dark.
2. Sidebar has 244px width, nav items 28px, epic rows 40px.
3. Board pane has 12px radius, 8px inset.
4. Cards show key, summary, priority pill, labels, assignee, age.
5. Column headers show status dot + name + count.
6. Open pane (click card) shows properties rail with fields.
7. Command overlay (`Cmd+K`) has 12px radius, 40px rows, indigo selected ring.
8. No console errors; `bun test` passes.

### 8.3 Log artifact

Capture browser console and screenshot. Save to `docs/factory/plans/gbj-20261017-014/smoke-log.md`.

---

## 9. Files to touch

| File | Change |
|------|--------|
| `src/index.css` | Token values (light/dark), scrollbar styles, radius utilities |
| `src/App.tsx` | Layout shell padding, header restyle, sidebar nav density, Open pane properties rail |
| `src/components/ui/kanban.tsx` | Column/card spacing if needed |
| `src/components/command-overlay.tsx` | Row height, radius, selected ring, transition |
| `src/components/issue-composer.tsx` | Composer chrome (radius, padding) if visible in smoke test |
| `src/components/board-calendar.tsx` | Background, border-radius, typography |
| `fixtures/issues.json` | Richer data for smoke testing |

---

## 10. Acceptance criteria (operator)

1. **Theme tokens** — Dark mode sidebar is `#09090a`, surface `#121213`, border `#212224`, accent `#ffffff08`. Light mode sidebar `#efeff0`, surface `#f9f9fa`, border `#e2e2e2`.
2. **Layout shell** — Board pane has uniform 8px inset and 12px radius on all breakpoints ≥1024px.
3. **Sidebar density** — Nav items 28px, epic rows 40px, radius 8px, hover wash 5%, selected wash 8%.
4. **Card chrome** — 9px radius, hairline border, 8px/10px/12px/12px padding, no shadow. Hover: subtle wash.
5. **Column chrome** — Header not a card; status dot 14px; count tabular muted; 12px column gap.
6. **Header chrome** — Controls 28px; search/scoped input restyled to muted pills; no large outlined fields.
7. **Open pane** — 320px width, hairline left border, properties as label/value stack, not DL grid.
8. **Command overlay** — 12px radius, 40px rows, selected row has inset 1px ring.
9. **Scrollbars** — Thin custom scrollbars in WebKit + Firefox.
10. **Smoke test** — `bun test` passes; fixture data renders all chrome states; screenshot + console log in PR.
