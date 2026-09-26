# Factory stage tags on board cards and ACP factory tools

pipe-kan will read the software-factory ledger (`jobs.jsonl`) to derive a live
stage tag for each active factory job and surface it as a badge on Plane/Jira
cards that reference a `gbj-*` id.  The same feature extends the ACP sidepanel
(ADR 0010) with three factory-aware tools: a read-only `factory_job_status`
query, and two user-approved mutation stubs (`factory_start_job`,
`factory_move_job`) that enqueue requests to `docs/factory/outbox/` for the
Grokbot Coordinator to action — keeping jobs.jsonl single-writer.

## Status

Accepted

## Context

ADR 0009 deferred a factory board; job `gbj-20260926-009` produced an HTML mock
and full design (read-only PIP KPI).  Job `gbj-20260926-011` (this feature) is
the green-lit maker wave.

Systems of record (locked, do not change):
- Factory lifecycle: `jobs.jsonl` (append-only) + `jobs/active/<id>.md`
- GitHub = PR merged signal
- Plane = `needs-input` inbox only (badge, not lifecycle)
- Jira = day-job Kanban only

Pipe-kan must not write to `jobs.jsonl` directly; there is no safe public
append API yet.  Mutations go through the outbox pattern below.

## Decision

### Stage tag derivation

Derive the **latest event** per job id from `jobs.jsonl` (file order =
append order).  Map that event to one of five tags using the priority chain
below (first match wins; scan `detail` + `status` + `summary` + `target_agent`
+ `from_bot`):

| Priority | Tag | Signals |
|----------|-----|---------|
| 1 | `human-wait` | `status === "blocked"` OR text contains: needs judgment / green-light / await ship / needs-input / waiting operator / checks pass / verify pass |
| 2 | `coordinator` | `status === "queued"` or `"routed"` OR from_bot contains Grokbot Coordinator / Intake switchboard OR text contains: routing / switchboard |
| 3 | `planning` | `target_agent` matches planner\* / PLAN\_\* / stage\_1a OR text contains: planner / to-spec / to-tickets / grill-with-docs |
| 4 | `desk` | `detail` contains `desk=` OR text contains: preflight / research gate / research dossier |
| 5 | `maker` | `target_agent` matches maker / implement / Referee / omp / stage\_2 OR text contains: maker / implement / referee / PR open |

Terminal states (`status === "done"` or `"cancelled"`) produce no tag (`null`).

### Server

- `FACTORY_LEDGER_PATH` env var (default `~/code/software-factory/asf/runtime/factory-coordinator/jobs.jsonl`).
- `GET /api/factory/jobs` — returns `{ jobs: FactoryJob[], error?: string }`.
  Reads ledger on every request; mtime cache avoids re-parsing unchanged file.
- `GET /api/factory/jobs/:id` — single-job lookup.
- No SSE for v1; clients poll at ≤10 s.  Switch to `fs.watch`/SSE in a
  follow-up if latency matters.

### UI — factory stage badges

- Cards whose `summary`, `description`, or `labels` contain a `gbj-*` id get
  an overlay chip showing the derived stage tag.
- Tag colours: `human-wait` = amber, `coordinator` = blue, `planning` = violet,
  `desk` = cyan, `maker` = green.
- Overlay is read-only; no write-back to Jira/Plane for factory stages.
- A **Factory sidebar strip** (collapsed by default) shows the full ledger KPI
  list (in-progress counts) when the Factory view is toggled.

### ACP tools (extends ADR 0010)

Three new tools added to `src/server/agent/tools.ts`:

| Tool | Mutates | Description |
|------|---------|-------------|
| `factory_job_status` | no | Returns latest status + stage tag for one job id (or the 20 most-recent active jobs when no id given). |
| `factory_start_job` | yes (approval required) | Writes a start-request file to `docs/factory/outbox/` for Grokbot Coordinator to pick up.  Never appends to `jobs.jsonl` directly. |
| `factory_move_job` | yes (approval required) | Writes a move-request file to `docs/factory/outbox/` for Grokbot Coordinator to pick up. |

The outbox file format is `<timestamp>-<uuid>-<action>.json` containing the
request payload plus a `requested_by: "pipe-kan-acp"` field.  The coordinator
reads and acts on these files, then appends the real ledger event.

## Considered options

- **Direct append to `jobs.jsonl`** — rejected.  `jobs.jsonl` is
  single-writer; a second writer risks interleaved lines and duplicate ids.
  The outbox pattern keeps the append path with the coordinator.
- **SSE push for live updates** — deferred.  Poll with mtime cache is simpler
  for v1; the `/api/factory/jobs` route is already incremental-safe.
- **Separate Factory view / Kanban columns** — deferred to a follow-up job
  (ADR 0009 design).  This wave adds badges and a sidebar strip only.
- **MCP layer instead of ACP tools** — rejected; ADR 0010 already chose ACP
  for the sidepanel.  Factory tools are a natural extension of the existing
  tool registry.

## Additive-overlay constraint (Vishal, 2026-09-26)

Factory integration is a **read-only overlay** that must not alter any
existing Plane or Jira code path.  Specifically:

1. **No writes to Plane/Jira from factory code.**  Stage tags are derived
   solely from `jobs.jsonl` and rendered as overlay chips in the UI.  They
   are never written back to Plane issue state, Jira labels, or any remote
   API.  The Plane `needs-input` badge path (`src/plane.ts`, existing) is
   untouched.

2. **No changes to flag parsing or JQL construction.**  The Jira
   `--projects KEY1,KEY2` comma-split path (`src/flags.ts` lines 82–85) is
   not touched by this feature.  Regression evidence:

   | Test file | Test name | Status |
   |-----------|-----------|--------|
   | `src/flags.test.ts:22` | `--projects parses multiple projects into JQL` | ✅ pass |
   | `src/flags.test.ts:44` | `--plane + --workspace + --projects parses combined flags` | ✅ pass |
   | `src/cli.test.ts:446` | `createJiraCli scopes epics to multiple projects via --projects` | ✅ pass |
   | `src/cli.test.ts:465` | `createJiraCli scopes epic children to multiple projects via --projects` | ✅ pass |

   All 54 tests in `src/flags.test.ts` + `src/cli.test.ts` pass without
   modification (`bun test src/flags.test.ts src/cli.test.ts`: 54 pass, 0 fail).

3. **`handleAppApi` route handler is strictly append-only.**  The two new
   factory routes (`/api/factory/jobs`, `/api/factory/jobs/:id`) are appended
   after all existing routes and before the final `return false`.  No existing
   route handler, URL pattern, or response logic is modified.

4. **`tools.ts` changes are import-expansion + append only.**  The only
   modification to existing lines is widening
   `import { readFileSync }` → `import { mkdirSync, readFileSync, writeFileSync }`.
   All existing tool definitions and executor implementations are unchanged.

## Consequences

- `src/factory-ledger.ts` owns all ledger parsing and stage-tag logic.
- `FACTORY_LEDGER_PATH` env var must be set (or default path must exist) for
  factory badges to appear; missing path fails closed with a clear API error.
- `docs/factory/outbox/` must exist (created automatically on first mutation
  tool call if absent).
- Mutations through the outbox are fire-and-forget from pipe-kan's perspective;
  the coordinator is responsible for processing and confirming via ledger events.
- No new npm runtime dependencies; uses Node `fs` builtins already present.
