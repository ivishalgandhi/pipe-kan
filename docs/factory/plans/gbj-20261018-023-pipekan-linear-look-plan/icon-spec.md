# icon-spec.md — gbj-20261018-023 pipe-kan Linear look plan

## Scope
Specification for all small icons in pipe-kan to match Linear's interface. Covers size, stroke, colour tokens, and states.

---

## 1. Status circles

### 1.1 Size and shape
- Diameter: **14px** (`size-3.5` in Tailwind).
- Border-radius: **50%** (circle).

### 1.2 Stroke and fill
- Stroke width: **1.5px** (`stroke-[1.5]`).
- Active/completed states: **filled** with status colour at 100% opacity.
- Backlog/todo states: **hollow** (transparent fill, coloured stroke).
- In-progress: **filled** with status colour at 100% opacity.
- Cancelled: **filled** with `#ef4444` (red).
- Paused: **hollow** with `#eab308` (yellow) stroke.

### 1.3 Colour tokens
| Status | Token | Hex (light) | Hex (dark) |
|---|---|---|---|
| Backlog | `--status-backlog` | `#6b7280` | `#9ca3af` |
| Todo | `--status-todo` | `#6b7280` | `#9ca3af` |
| In Progress | `--status-active` | `#3b82f6` | `#60a5fa` |
| Done | `--status-done` | `#22c55e` | `#4ade80` |
| Cancelled | `--status-cancelled` | `#ef4444` | `#f87171` |
| Paused | `--status-paused` | `#eab308` | `#facc15` |

### 1.4 Usage
- Column header: status circle + status name + count.
- Card header: status circle left of issue key.
- Roadmap table: status circle in status column.
- Filter menu: status circles in Status submenu.

---

## 2. Priority flags

### 2.1 Size and shape
- Width: **12px**, Height: **12px** (`size-3` in Tailwind).
- Shape: upward-pointing triangle (flag) or diamond.

### 2.2 Stroke and fill
- Stroke width: **1.5px**.
- All priorities: **filled**.

### 2.3 Colour tokens
| Priority | Hex (both themes) |
|---|---|
| Urgent | `#ef4444` |
| High | `#f97316` |
| Medium | `#eab308` |
| Low | `#3b82f6` |
| None | `#9ca3af` |

### 2.4 Usage
- Card footer: priority pill includes flag icon + text.
- Roadmap table: priority icon in priority column.
- Filter menu: priority icons in Priority submenu.

---

## 3. Project cube

### 3.1 Size and shape
- Width: **14px**, Height: **14px** (`size-3.5`).
- Shape: 3D cube outline (Lucide `Box` or `Package`).

### 3.2 Stroke and fill
- Stroke width: **1.5px**.
- Fill: none (outline only).
- Colour: `--muted-foreground` (`#b0b5c0` light, `#6b6f76` dark).

### 3.3 States
- Idle: `--muted-foreground`.
- Hover: `--foreground` (`#23252a` light, `#ffffff` dark).
- Active/selected: `--primary` (`#6d78d5`).

### 3.4 Usage
- Project picker rows: cube icon left of project name.
- Card footer: project chip includes cube icon.
- Sidebar "Projects" nav item.
- Move-to-project picker.

---

## 4. Cycle clock

### 4.1 Size and shape
- Width: **12px**, Height: **12px** (`size-3`).
- Shape: clock with circular arrow (Lucide `Clock` or `RefreshCw`).

### 4.2 Stroke and fill
- Stroke width: **1.5px**.
- Fill: none.
- Colour: `--muted-foreground`.

### 4.3 States
- Idle: `--muted-foreground`.
- Hover: `--foreground`.
- Active: `--primary`.

### 4.4 Usage
- Sidebar "Cycles" nav item and sub-items.
- Filter menu: Cycle row icon.
- Disabled in all places (Plane has no native cycles); shown with `opacity-50`.

---

## 5. Label dots

### 5.1 Size and shape
- Diameter: **8px** (`size-2` in Tailwind).
- Border-radius: **50%**.

### 5.2 Fill
- Fill: solid, 100% opacity.
- Colour: same as label background colour.

### 5.3 Usage
- Card footer: dot + label text in pill.
- Filter menu: dot left of label name in submenu.
- Roadmap table: dot in labels column.

### 5.4 Label colour palette
Use existing label colours from `src/index.css` or computed HSL. No new tokens needed.

---

## 6. Avatar

### 6.1 Size and shape
- Diameter: **20px** (`size-5`).
- Border-radius: **50%**.
- Border: **1px solid** `var(--border)`.

### 6.2 Fallback
- When no image: initials in **10px** font, weight 500, centred.
- Background: deterministic colour from name hash (reuse existing logic).
- Text colour: white or black based on background luminance.

### 6.3 Usage
- Card footer: assignee avatar.
- Inbox: notification avatar.
- Move-to-project hover card: owner avatar.
- Sidebar team header: team avatar.

---

## 7. Navigation icons (sidebar)

### 7.1 Size and stroke
- Size: **16px** (`size-4`).
- Stroke width: **1.5px**.
- Stroke linecap: round, linejoin: round.

### 7.2 Colour tokens
| State | Token | Hex (light) | Hex (dark) |
|---|---|---|---|
| Idle | `--muted-foreground` | `#b0b5c0` | `#6b6f76` |
| Hover | `--foreground` | `#23252a` | `#ffffff` |
| Active/selected | `--foreground` | `#23252a` | `#ffffff` |

### 7.3 Icon mapping
| Nav item | Lucide icon |
|---|---|
| Inbox | `Inbox` |
| Pulse | `Activity` |
| Agent | `Bot` |
| Projects | `Box` |
| Views | `LayoutGrid` |
| Initiatives | `Target` |
| More | `MoreHorizontal` |
| Favorites (folder) | `Folder` |
| Favorites (add) | `FolderPlus` |
| Home | `Home` |
| Triage | `Inbox` |
| Issues | `CircleDot` |
| Cycles | `Clock` |
| Views (team) | `LayoutGrid` |
| Try | `Zap` |
| Invite | `UserPlus` |
| Connect GitHub | `GitFork` |

---

## 8. Filter menu icons

### 8.1 Size and stroke
- Size: **16px** (`size-4`).
- Stroke width: **1.5px**.

### 8.2 Icon mapping
| Filter row | Lucide icon |
|---|---|
| AI filter | `Sparkles` |
| Advanced filter | `SlidersHorizontal` |
| Status | `CircleDot` |
| Status type | `Layers` |
| Assignee | `User` |
| Agent | `Bot` |
| Creator | `UserPlus` |
| Priority | `Flag` |
| Estimate | `Gauge` |
| Labels | `Tag` |
| Relations | `GitBranch` |
| Suggested label | `Lightbulb` |
| Dates | `Calendar` |
| Project | `Box` |
| Project properties | `Settings` |
| Initiative | `Target` |
| Cycle | `Clock` |
| Added to cycle | `PlusCircle` |
| Subscribers | `Users` |
| Auto-closed | `CheckCircle2` |
| Content | `FileText` |
| Links | `Link` |
| Template | `FileStack` |

---

## 9. View composer icons

### 9.1 Icon selector grid
- Grid of 8 icons, each 24px, selectable.
- Selected state: `bg-sidebar-accent` background + `ring-1 ring-[var(--ring)]`.

### 9.2 Available view icons
| Icon | Lucide name |
|---|---|
| List | `List` |
| Board | `LayoutGrid` |
| Timeline | `CalendarDays` |
| Chart | `BarChart3` |
| Bug | `Bug` |
| Feature | `Zap` |
| Roadmap | `Map` |
| Sprint | `Timer` |

---

## 10. Chevron and caret icons

### 10.1 Size and stroke
- Size: **12px** (`size-3`).
- Stroke width: **2px**.

### 10.2 Usage
- Section collapse: `ChevronDown` / `ChevronRight`.
- Submenu chevrons: `ChevronRight` on filter rows.
- Dropdown chevrons: `ChevronDown` on pills.

---

## 11. General rules

1. **No custom SVGs** — Use Lucide icons exclusively. No inline SVG paths in components.
2. **Consistent sizing** — Never mix `size-3` and `size-4` for the same semantic icon within a view.
3. **Theme-aware** — All icon colours must use CSS custom properties, not hardcoded hexes.
4. **Hover states** — Every clickable icon must have a visible hover state (colour change or background wash).
5. **Disabled states** — Non-functional icons (e.g. Cycle in Plane mode) use `opacity-50` and `cursor-not-allowed`.
6. **Accessibility** — All icons inside buttons must have `aria-label`. Decorative icons must have `aria-hidden="true"`.
7. **Footer connect row** — Lucide 1.40 has no `Github` export. The muted footer row keeps the label Connect GitHub and draws `GitFork` at 16px, stroke 1.5.
