# tickets.md — gbj-20261020-035 Taskwarrior-first kanban profile

## Dependencies
- `gbj-20261018-019` (Linear parity: board/sidebar/command restyle) is on `main`.
- `gbj-20261020-035` adds Taskwarrior source + profile; reuses tokens and patterns.

---

### T2 — Taskwarrior source adapter (`src/taskwarrior.ts`)

**What**
Implement `createTaskwarriorCli()` that satisfies the `Cli` interface used by Jira and Plane adapters. All `task` invocations use strict argv via `execFile`; no shell strings.

**Why**
Taskwarrior is already listed as a disabled source (ADR-0019). It needs a working adapter to become selectable.

**Files**
- `src/taskwarrior.ts` — new; `createTaskwarriorCli()`, `taskExport()`, `taskAdd()`, `taskModify()`, `taskDone()`, `taskStart()`, `taskStop()`
- `src/taskwarrior-map.ts` — new; TW JSON ↔ `RawIssue` mapping
- `src/taskwarrior-validation.ts` — new; UUID/project/tag validators

**Acceptance**
1. `createTaskwarriorCli({ taskBin: "task", taskData: "/tmp/fake-task" })` returns a `Cli` object.
2. `cli.refresh()` runs `task export` and returns `RawIssue[]`.
3. `cli.move(uuid, "Done")` runs `task <uuid> done`.
4. `cli.create({ summary: "Test", project: "demo" })` runs `task add project:demo Test`.
5. `cli.edit(uuid, { priority: "H" })` runs `task <uuid> modify priority:H`.
6. All calls use `execFile` with an argv array.
7. Hostile-input tests pass: description with `; rm -rf /`, backticks, quotes, pipes.
8. `bun test` covers adapter functions.
9. `bun run typecheck` passes.

**Verification**
```bash
bun test src/taskwarrior*.test.ts
bun run typecheck
```

---

### T3 — Taskwarrior field mapping and board columns

**What**
Map Taskwarrior fields to `RawIssue`/`Card`/`Column` and implement the default column model (Inbox, Next, Active, Waiting, Scheduled, Done).

**Why**
Taskwarrior statuses do not map 1:1 to kanban columns. The column model is the core UX difference from Jira/Plane.

**Files**
- `src/taskwarrior-map.ts` — extend with `toRawIssue()`, `toCard()`, `taskToColumnKey()`
- `src/taskwarrior-columns.ts` — new; column rule evaluation

**Acceptance**
1. A task with `status:pending`, no `project`, no `scheduled` → Inbox.
2. A task with `status:pending`, `project:work`, no `start`, no `wait` → Next.
3. A task with `status:pending`, `start:2026-10-20T08:00:00Z` → Active.
4. A task with `status:pending`, `wait:2026-10-25T00:00:00Z` → Waiting.
5. A task with `status:pending`, `scheduled:2026-10-22T00:00:00Z`, no `start` → Scheduled.
6. A task with `status:completed` → Done.
7. Column rules are editable in local chrome state (stored in `localStorage`).
8. `bun test` covers all six column buckets.
9. `bun run typecheck` passes.

**Verification**
```bash
bun test src/taskwarrior-columns.test.ts
bun run typecheck
```

---

### T4 — Quick-add NLP composer

**What**
Extend `issue-composer.tsx` (or create `quick-add-composer.tsx`) with regex-based NLP extraction: `+project`, `@tag`, due date keywords, priority keywords.

**Why**
Todoist-grade quick-add is a key differentiator for a 2026 task manager.

**Files**
- `src/taskwarrior-nlp.ts` — new; parser
- `src/components/quick-add-composer.tsx` — new or extend `issue-composer.tsx`

**Acceptance**
1. Input `"Buy milk +groceries tomorrow @errand p1"` extracts:
   - description: `"Buy milk"`
   - project: `"groceries"`
   - due: tomorrow's date (ISO day)
   - tags: `["errand"]`
   - priority: `"H"`
2. Input `"Call mom scheduled:friday"` extracts scheduled date.
3. Input `"Follow up wait:2weeks"` extracts wait date.
4. Unmatched text is preserved as description.
5. Composer UI shows parsed chips before submit.
6. Submit calls `cli.create()` with the parsed fields.
7. `bun test` covers parser with ≥10 cases.
8. `bun run typecheck` passes.

**Verification**
```bash
bun test src/taskwarrior-nlp.test.ts
bun run typecheck
```

---

### T5 — Taskwarrior sidebar profile

**What**
Create `taskwarrior-sidebar.tsx` with Inbox, Today, Upcoming, Projects, Tags, and Contexts sections. Replace the Jira/Plane sidebar when source is Taskwarrior.

**Why**
Taskwarrior concepts (projects, tags, contexts) do not match Jira workspaces or Plane projects. A dedicated profile keeps terminology correct.

**Files**
- `src/components/taskwarrior-sidebar.tsx` — new
- `src/App.tsx` — conditionally render sidebar based on active source

**Acceptance**
1. When source = Taskwarrior, sidebar shows:
   - Inbox (badge = count of tasks with no project and no scheduled)
   - Today (ephemeral lens)
   - Upcoming (ephemeral lens)
   - Projects (collapsible, from `task _projects`)
   - Tags (collapsible, from `task _tags`)
   - Contexts (from `task _context`)
2. Clicking a project scopes the board to that project.
3. Clicking a tag scopes the board to tasks with that tag.
4. Clicking a context applies its filter string.
5. Today lens shows tasks due today OR started today.
6. Upcoming lens shows tasks due or scheduled in next 7 days.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T6 — Keyboard shortcuts for Taskwarrior profile

**What**
Add keyboard shortcuts: `C` (create), `E` (edit), `D` (done), `S` (start/stop), `R` (refresh), `J`/`K` (nav), `1`–`5` (jump to column), `G` chords.

**Why**
Keyboard-first is a requirement; Linear parity demands single-key shortcuts.

**Files**
- `src/App.tsx` — add global keydown listener
- `src/command.ts` — add Taskwarrior-specific jumps (projects, tags, contexts)

**Acceptance**
1. `C` opens quick-add composer (unless focus in text field).
2. `E` opens edit for selected/hovered card.
3. `D` marks selected card as done (with confirmation toast).
4. `S` toggles start/stop on selected card.
5. `R` triggers refresh from Taskwarrior.
6. `J`/`K` moves card selection down/up.
7. `1`–`5` jumps focus to column 1–5.
8. `G` then `I/T/U/P/A/C/V` jumps to Inbox/Today/Upcoming/Projects/Tags/Contexts/Views.
9. Shortcuts are documented in a help overlay (`?` key).
10. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T7 — Calendar view for Taskwarrior

**What**
Reuse `board-calendar.tsx` to show `due` and `scheduled` dates from Taskwarrior tasks. Read-only; no drag-to-date.

**Why**
Calendar is already implemented for Jira/Plane Target End dates; Taskwarrior just needs a different date source.

**Files**
- `src/components/board-calendar.tsx` — modify to accept a date-picker function per source
- `src/taskwarrior-map.ts` — add `taskCalendarDates()`

**Acceptance**
1. In Taskwarrior source, Calendar tab shows events for `due` and `scheduled` dates.
2. Each event shows task UUID chip + description.
3. Clicking event opens detail pane.
4. Events from `due` and `scheduled` are visually distinct (dot color).
5. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T8 — Open detail pane (annotations, depends)

**What**
Create `taskwarrior-open.tsx`: detail pane showing full task fields, annotations list, and depends list.

**Why**
Taskwarrior annotations and dependencies are not shown in the card summary; they need a detail view.

**Files**
- `src/components/taskwarrior-open.tsx` — new
- `src/App.tsx` — wire open pane for Taskwarrior cards

**Acceptance**
1. Clicking a Card opens detail pane (320px rail).
2. Pane shows: description, project, tags, priority, status, due, scheduled, wait, start, entry, modified.
3. Annotations shown as a timestamped list.
4. Depends shown as a list of blocked-by UUIDs with descriptions.
5. Links to `task <uuid>` CLI reference (for operator debugging).
6. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
```

---

### T9 — Playwright smoke + screenshots

**What**
New Playwright test on fake Taskwarrior data: Board view, drag between columns, quick-add, complete, edit, Calendar view, light/dark screenshots at 1440x900.

**Why**
Vishal's acceptance criteria require smoke on fake data with visual proof.

**Files**
- `tests/taskwarrior-smoke.spec.ts` — new
- `fixtures/taskwarrior.json` — new; fake `task export` payload
- `scripts/smoke-taskwarrior.ts` — new; boot app with `TASKWARRIOR_FIXTURE`

**Acceptance**
1. Playwright test boots pipe-kan with `TASKWARRIOR_FIXTURE=synthetic`.
2. Board renders with fake tasks in correct columns.
3. Test drags a Card from Next → Done; column counts update.
4. Test opens quick-add, types "Test task +demo tomorrow", submits; new card appears in Next.
5. Test clicks Card, clicks Done; toast confirms.
6. Test switches to Calendar tab; events visible.
7. Screenshots saved: `smoke-tw-board-light.png`, `smoke-tw-board-dark.png`, `smoke-tw-calendar-light.png`.
8. All screenshots are 1440x900.
9. `bun run smoke` passes.
10. No real task data in fixtures or screenshots.

**Verification**
```bash
bun run build
TASKWARRIOR_FIXTURE=synthetic bun run smoke
```

---

### T10 — Taskwarrior round-trip tests

**What**
Node-based integration tests on a throwaway `TASKDATA` directory: UI mutations must be visible in `task export`; CLI mutations must be visible in UI after refresh.

**Why**
Security and correctness: the adapter must not corrupt the Taskwarrior database.

**Files**
- `tests/taskwarrior-roundtrip.test.ts` — new

**Acceptance**
1. Create a temp `TASKDATA` directory.
2. Call `cli.create({ summary: "Roundtrip test", project: "test" })`.
3. Run `task export` in that directory; verify task exists with correct fields.
4. Call `cli.move(uuid, "Done")`.
5. Run `task export`; verify `status:completed`.
6. Call `cli.edit(uuid, { priority: "H" })`.
7. Run `task export`; verify `priority:H`.
8. Run `task add "CLI test"` directly.
9. Call `cli.refresh()`; verify new task appears in returned `RawIssue[]`.
10. Clean up temp directory.
11. `bun test` passes.

**Verification**
```bash
bun test tests/taskwarrior-roundtrip.test.ts
```

---

### T11 — Server source switch + fixture boot

**What**
Enable `taskwarrior` in `server.ts` source switch and add `TASKWARRIOR_FIXTURE` support.

**Why**
The server already stubs Taskwarrior as disabled. It needs to boot the real adapter when env is present.

**Files**
- `src/server.ts` — modify switchSource, boot path
- `src/app-api.ts` — report taskwarrior as enabled
- `src/parity.ts` — `sourceOptions` already has stub; enable when env present

**Acceptance**
1. `TASKWARRIOR_FIXTURE=synthetic bunx pipe-kan` boots with Taskwarrior source enabled.
2. `POST /api/source` with `{source:"taskwarrior"}` switches successfully.
3. `GET /api/board` returns Taskwarrior-shaped issues.
4. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
TASKWARRIOR_FIXTURE=synthetic bun run smoke
```

---

### T12 — Documentation updates

**What**
Update `CONTEXT.md` and `README.md` with Taskwarrior terminology and usage.

**Why**
Future agents need correct language for the new source.

**Files**
- `CONTEXT.md`
- `README.md`

**Acceptance**
1. CONTEXT.md adds definitions:
   - **Task** — a Taskwarrior task identified by UUID
   - **Project** — a Taskwarrior project (hierarchical, dot-separated)
   - **Tag** — a Taskwarrior tag (`+tag` on CLI)
   - **Context** — a saved Taskwarrior filter
   - **Annotation** — a timestamped note on a task
   - **Depends** — a Taskwarrior dependency (UUID reference)
   - **Urgency** — Taskwarrior's built-in urgency score
2. README.md adds Taskwarrior source section with env vars (`TASKDATA`, `TASKWARRIOR_FIXTURE`).
3. No code changes outside docs.

**Verification**
```bash
# Manual review
```

---

## Ticket order

1. **T2** (Adapter) and **T3** (Mapping/columns) are the foundation. Do T2 first, then T3.
2. **T4** (NLP) and **T5** (Sidebar) can be parallel after T3.
3. **T6** (Keyboard) depends on T5 (sidebar chrome needs jump targets).
4. **T7** (Calendar) and **T8** (Open pane) can be parallel after T3.
5. **T11** (Server switch) can be done early in parallel with T2 (it's plumbing).
6. **T9** (Smoke) is last — needs all UI tickets.
7. **T10** (Round-trip) is last — needs T2/T11.
8. **T12** (Docs) can be parallel with T9/T10.

```
T2 → T3 → T4 ─┬→ T6
        └→ T5 ─┘
        └→ T7
        └→ T8
T11 (parallel with T2)
T9, T10 (after all UI)
T12 (parallel with T9/T10)
```

---

## Notes

- **Fake data only** — fixtures must not contain real task descriptions, projects, or tags.
- **No secrets** — `TASKDATA` path stays env-only; never commit.
- **Hostile input** — every argv builder gets validation + tests.
- **Jira/Plane regression** — all new code must be behind `activeSource === "taskwarrior"`. Existing sources unchanged.
