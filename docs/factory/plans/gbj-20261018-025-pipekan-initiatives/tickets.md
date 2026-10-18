# tickets.md — gbj-20261018-025 pipe-kan Initiatives plan

## Dependencies
- gbj-20261018-019 (Initiatives/Projects/Timeline/Display options) — functional parity on `main`.
- gbj-20261018-023 (Linear look plan) — icon spec, sidebar, views conventions on `main`.
- This slice replaces the modules-derived initiatives fallback with real Plane initiatives, adds a Postgres-backed initiative store for non-Plane sources, provisions the DB on a Proxmox LXC, and integrates into the multi-source switcher.

---

## Spike tickets (must resolve before P0 commit)

### T-Spike-Plane-Initiative-Tree

**What**
Verify whether Plane v2 (and v1) initiatives expose `parent_id`, `epic_ids`, or `/initiatives/{id}/epics/` endpoints. Document exact response shape from a real Plane workspace.

**Why**
Tree hierarchy and epic linking are core to Linear's initiatives UI. If Plane lacks them, the plan must shift to flat list + manual parent field.

**Files**
- `spikes/plane-initiative-shape.md` (new, ephemeral; not committed to main)

**Acceptance**
1. Call `GET /api/v2/workspaces/{slug}/initiatives/` on a test workspace with ≥1 initiative.
2. Document every field in the response.
3. If `parent_id` is present, call with `expand=parent` and document nested shape.
4. Attempt `GET /api/v2/workspaces/{slug}/initiatives/{id}/epics/` and record status code + body.
5. Attempt v1 fallback `/api/v1/workspaces/{slug}/initiatives/` and compare fields.
6. Record whether the workspace returns 402 (feature not enabled).
7. Output a decision matrix: if parent=yes + epics=yes → proceed with tree; else → flat list fallback.

**Verification**
Manual curl/script against real Plane workspace. Output appended to this ticket as a comment.

---

## P0 — Core: Real Plane initiatives read, DB schema, basic UI parity

### T1 — Plane initiative adapter: read native initiatives

**What**
Add a `PlaneInitiativeAdapter` that calls Plane REST v2 `GET /api/v2/workspaces/{slug}/initiatives/` (and v1 fallback on 404). Map response fields to `Initiative` type. Wire into `/api/initiatives` and update `/api/parity` to source initiatives from the adapter instead of modules.

**Why**
Current initiatives are modules; Plane has a real initiatives feature that must be used.

**Files**
- `src/plane-initiatives.ts` (new) — adapter, request builder, field mapping, v1/v2 fallback
- `src/plane.ts` — remove modules from `buildParity` initiatives mapping (keep modules for project roll-up if needed)
- `src/app-api.ts` — add `GET /api/initiatives`, `GET /api/initiatives/:id`
- `src/parity.ts` — extend `ParityInitiative` with `description?`, `lead?`, `state: InitiativeState`, `projectIds: string[]`, `labelIds: string[]`, `parentId?`
- `src/app.ts` — add `listInitiatives?()` and `getInitiative?(id)` to `App`

**Acceptance**
1. `GET /api/initiatives` returns initiatives from Plane v2 with fields: id, name, description, state, lead, startDate, endDate, labels, projectIds.
2. If v2 returns 404, adapter tries v1 and maps cursor-based pagination to offset.
3. If Plane returns 402, adapter returns `{ enabled: false, reason: "Initiatives not enabled" }` and UI shows graceful state.
4. Throttle honors ADR-0017: serialized requests, rate-limit headers, 429 retry once.
5. Workspace slug follows ADR-0015/0016: derived from flags/env, multi-workspace support.
6. Fake data in fixtures uses "Acme Demo", "DEMO-12" naming.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T2 — Postgres schema, migrations, pooled client

**What**
Create versioned SQL migrations for the initiative schema (initiatives, initiative_labels, initiative_links, initiative_views, initiative_favorites, initiative_display, schema_migrations tables). Add a pooled Postgres client wrapper with DSN from Vault-fed env, connection timeouts, offline degradation.

**Why**
Sources without native initiatives (Taskwarrior, Jira cross-project) need a persistent store.

**Files**
- `migrations/001_init.sql` (new) — DDL for all tables, indexes, extensions
- `migrations/002_ltree.sql` (new) — `ltree` path column and GIST index (separate for environments without ltree)
- `src/db/postgres.ts` (new) — pooled `pg` client, DSN resolution from `PIPE_KAN_PG_DSN` env (Vault-injected), timeout/retry logic
- `src/db/migrate.ts` (new) — forward-only migration runner with checksum validation
- `src/db/initiative-store.ts` (new) — CRUD for DB-backed initiatives, links, views, favorites

**Acceptance**
1. `migrations/` contains SQL files named `NNN_description.sql` with `-- checksum: sha256` footer comments.
2. Migration runner executes forward-only in version order, aborts on checksum mismatch.
3. Client uses `pg` pool with `max: 10`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`.
4. If `PIPE_KAN_PG_DSN` is unset, server logs a warning and DB-backed endpoints return empty arrays with `offline: true` flag.
5. If pool connection fails at runtime, queries return empty results after one retry; UI shows degraded banner.
6. `bun run typecheck` passes.
7. Schema matches the DDL sketch in `spec.md` §3.2 exactly.

**Verification**
```bash
bun run typecheck
bun run build
# Ephemeral Postgres for tests (see T15 smoke test)
```

---

### T3 — DB-backed initiative CRUD and cross-source links

**What**
Implement `DbInitiativeAdapter` using the Postgres store. Support create/edit/archive, link/unlink external work items (Taskwarrior UUIDs, Jira epic keys), post health updates, compute progress roll-up from linked items.

**Why**
Taskwarrior and Jira need a place to store initiative definitions and their relationships to work items.

**Files**
- `src/db/initiative-store.ts` — full CRUD, link management, update logging, progress aggregation
- `src/db/initiative-adapter.ts` (new) — implements `InitiativeAdapter` interface for DB source
- `src/db/taskwarrior-linker.ts` (new) — resolves Taskwarrior UUIDs to cached titles/status
- `src/db/jira-linker.ts` (new) — resolves Jira epic keys cross-project to cached titles/status
- `src/app-api.ts` — add `/api/db/initiatives/*` routes

**Acceptance**
1. `POST /api/db/initiatives` creates an initiative with name, description, lead, state, dates, parent, labels.
2. `PATCH /api/db/initiatives/:id` edits any mutable field.
3. `DELETE /api/db/initiatives/:id` soft-deletes (sets `archived_at`).
4. `POST /api/db/initiatives/:id/links` creates a link with source_kind, external_key, cached title/status/progress; `fetched_at` is set to now; `ttl_seconds` defaults to 300.
5. `GET /api/db/initiatives/:id/progress` returns computed progress from linked items (average of `external_progress` or count ratio).
6. Taskwarrior linker runs `task UUID info` or reads from the local store to cache title/status.
7. Jira linker calls Jira REST `/issue/{key}` to cache title/status; respects existing jira-cli throttle.
8. Health updates are stored in a JSONB column or separate table; returned by `GET /api/db/initiatives/:id/updates`.
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T4 — Retire modules-based initiatives; keep modules visible

**What**
Remove modules from `buildParity`'s initiative mapping. Update sidebar nav: "Initiatives" now opens real Plane initiatives; add "Modules" under Projects or as a separate nav item if modules are still needed for project roll-up.

**Why**
Modules are not initiatives; conflating them creates data integrity issues.

**Files**
- `src/plane.ts` — `buildParity`: remove `initiatives` derived from modules; keep `projects` roll-up from modules if still needed
- `src/App.tsx` — update `openInitiatives` to use new `/api/initiatives`; add or repurpose nav for Modules
- `src/components/linear-chrome.tsx` — update `RoadmapTable` to use real initiative data; update `InitiativeOverview` with new fields
- `src/parity.ts` — deprecate old `ParityInitiative` fields if needed; add migration note

**Acceptance**
1. `GET /api/parity` no longer includes modules in `initiatives` array for Plane source.
2. Sidebar "Initiatives" opens real Plane initiatives (or DB-backed if Plane disabled).
3. Modules remain accessible: either as "Modules" nav item under "More" or in project detail view.
4. Existing `ParityInitiative` consumers (`RoadmapTable`, `InitiativeOverview`) compile with new fields.
5. `bun run typecheck` passes.
6. No runtime errors when switching between Plane/Jira/Taskwarrior sources.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T5 — Linear initiatives list UI: tabs, columns, tree

**What**
Redesign the initiatives list to match Linear exactly: pill tabs (Initiatives | Active | Planned | Completed), table columns, tree rendering with connector lines, source badges.

**Why**
User-facing parity with Linear's initiatives view.

**Files**
- `src/components/initiative-list.tsx` (new) — tabs, table, tree rows, column cells
- `src/components/initiative-cells.tsx` (new) — NameCell, OwnerCell, TargetCell, HealthCell, ProjectsCell, ActiveProjectsCell
- `src/components/linear-chrome.tsx` — replace existing `RoadmapTable` initiative branch with `InitiativeList` or parameterise
- `src/index.css` — add connector line tokens if needed

**Acceptance**
1. Tabs: "Initiatives | Active | Planned | Completed" with status icons (pill style, 28px height).
2. "+ New initiative" button top-right.
3. "Filter" and "Display" buttons in toolbar.
4. Table columns: Name (icon + title + description, expand caret), Owner (20px avatar or "—"), Target (quarter/half/year granularity), Health (pulse dot + label + age), Projects (hex-check + count), Active Projects (colored dots + counts).
5. Tree: sub-initiatives nested under parent with connector lines, up to 3 levels. Each row carries full column data.
6. Row hover: muted background wash. Row selected: left accent border.
7. Source badge on each row when in combined view (e.g. "Plane" pill, "DB" pill).
8. Fake data only: "Acme Demo", "DEMO-12".
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

## P1 — Write, link, updates, progress

### T6 — Initiative create/edit modals

**What**
Add create and edit modals for initiatives, with separate paths for Plane native (POST/PATCH Plane API) and DB-backed (POST/PATCH local Postgres).

**Why**
Users need to create and modify initiatives.

**Files**
- `src/components/initiative-composer.tsx` (new) — modal form: name, description, state, lead, dates, labels, parent, projects
- `src/App.tsx` — wire "+ New initiative" button to composer; wire edit from row context menu
- `src/plane-initiatives.ts` — create/edit helpers
- `src/db/initiative-store.ts` — create/edit helpers

**Acceptance**
1. Create modal opens from "+ New initiative" button. Fields: name (required), description, state (DRAFT default), lead picker, start/end dates, labels multi-select, parent picker, projects multi-select.
2. For Plane source: POST/PATCH calls Plane API v2; on 402 show "not enabled" banner.
3. For DB source: POST/PATCH writes to Postgres; validates name uniqueness per source_workspace.
4. Edit modal opens from row context menu "Edit initiative".
5. Both modals have Cancel / Save buttons; Save shows loading spinner; error toast on failure.
6. Fake data only.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T7 — Project/epic link/unlink with optimistic update + rollback

**What**
Add "Add project" and "Add epic" flows to initiative detail. Linking/unlinking uses optimistic UI update with rollback on error.

**Why**
Initiative progress depends on linked projects and epics.

**Files**
- `src/components/initiative-detail.tsx` (new) — projects tab, epics tab, add/unlink buttons
- `src/components/project-picker.tsx` (reuse/extend from gbj-20261018-023 T3 if exists)
- `src/plane-initiatives.ts` — link/unlink API wrappers
- `src/db/initiative-store.ts` — link/unlink for DB-backed

**Acceptance**
1. Initiative detail "Projects" tab shows linked projects with health, progress, issue count.
2. "Add project" opens a searchable picker of existing projects. Selecting adds with optimistic UI update.
3. "Unlink" button on each project row with confirmation dialog.
4. Same for epics (if Plane supports epic linking; otherwise disabled with tooltip).
5. On API error, toast shows failure and UI rolls back to pre-mutation state.
6. Fake data only.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T8 — Health updates popover + composer

**What**
Implement the health updates popover and inline composer. For Plane native, store updates locally if Plane lacks an update API; for DB-backed, store in Postgres.

**Why**
Linear's health updates are a key UX feature for tracking initiative status over time.

**Files**
- `src/components/initiative-updates.tsx` (new) — popover, update list, composer
- `src/db/initiative-store.ts` — add `initiative_updates` table if not already in schema
- `src/plane-initiatives.ts` — if Plane exposes updates endpoint, use it; else local fallback

**Acceptance**
1. Clicking health cell opens popover with latest update (health + age, author, body).
2. Popover has "Write update" button → inline composer.
3. Composer: health dropdown (On track / At risk / Off track), body textarea, Cancel / Post.
4. Posted updates appear in popover and in detail page updates tab.
5. Arrow-key navigation between initiative rows while popover is open (optional P1; can defer to P2).
6. Bell subscribe toggle (UI-only placeholder if no backend).
7. Fake data only.
8. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T9 — Progress graph (stacked area/streamgraph)

**What**
Add a progress graph to initiative detail: stacked area showing scope count over time, tooltip card on hover.

**Why**
Visual progress tracking is a Linear hallmark.

**Files**
- `src/components/initiative-progress-graph.tsx` (new) — SVG or canvas stacked area chart
- `src/parity.ts` — add `computeInitiativeProgress()` helper for roll-up math

**Acceptance**
1. Graph shows stacked area over initiative date range.
2. X-axis: weeks or months depending on range length.
3. Y-axis: scope count (work items).
4. Tooltip on hover: initiative name, scope count, lead.
5. Data source: for Plane native, rolled up from linked projects/epics → work items; for DB-backed, from `initiative_links` cached progress.
6. If no data, show empty state "No progress data yet".
7. Fake data only.
8. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T10 — Initiative detail page (overview, projects, children tabs)

**What**
Build the full initiative detail page with tabs: Overview (description, properties sidebar), Projects (linked projects), Children (sub-initiatives).

**Why**
Complete the initiative read experience.

**Files**
- `src/components/initiative-detail.tsx` — tabs, overview, properties sidebar, projects list, children list
- `src/components/linear-chrome.tsx` — replace or extend `InitiativeOverview`

**Acceptance**
1. Overview tab: description (rich text render if html available, else plain), properties sidebar (status badge, lead with avatar, target date range, labels as pills, projects list).
2. Projects tab: table of linked projects with status, health, progress %, issue count; "Add project" button.
3. Children tab: sub-initiative list with inline "Add sub-initiative" button; nested to 3 levels.
4. Back button returns to initiatives list.
5. "Open issues" button navigates to board filtered by initiative.
6. Fake data only.
7. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

## P2 — Combined view, provisioning, ops

### T11 — Multi-source combined initiatives view

**What**
Add a "Combined" source mode for initiatives that merges Plane native + DB-backed + Jira cross-project. Implement source badges, dedup/identity rules, partial-failure handling, per-source caching, sorting/grouping/filter across sources.

**Why**
Users want a unified roadmap across all connected sources.

**Files**
- `src/components/initiative-combined.tsx` (new) — merged list with source badges
- `src/initiative-service.ts` (new) — service layer that queries multiple adapters and merges
- `src/app-api.ts` — add `GET /api/combined-initiatives`
- `src/App.tsx` — add combined view toggle in source switcher or as a new nav mode

**Acceptance**
1. `GET /api/combined-initiatives?sources=plane,jira,taskwarrior` returns merged list.
2. Each row has a source badge (colored pill: Plane blue, Jira orange, Taskwarrior gray).
3. Dedup rule: if two initiatives share the same name and overlapping date range within 30 days, flag as potential duplicate (UI hint, not automatic merge).
4. Partial failure: if Plane API errors, still show DB-backed + Jira with a warning banner. If all sources fail, empty state with retry button.
5. Per-source cache: each adapter caches its last successful response in memory with 60s TTL.
6. Sorting/grouping/filter applies across all sources (e.g. filter by health shows matching items from all sources).
7. Progress roll-up for combined view uses weighted average by source initiative count.
8. Fake data only.
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T12 — Saved views, favorites, display layout migrated to Postgres

**What**
Migrate initiative-specific saved views, favorites, and display layout from localStorage to Postgres. Fall back to localStorage when Postgres is offline.

**Why**
Server-side persistence enables cross-device consistency and combined view configuration.

**Files**
- `src/db/initiative-store.ts` — CRUD for views, favorites, display
- `src/app-api.ts` — add `/api/initiative-views`, `/api/initiative-favorites`, `/api/initiative-display`
- `src/App.tsx` — replace localStorage reads/writes for initiatives with API calls; keep localStorage as fallback

**Acceptance**
1. `GET /api/initiative-views` returns views for the current user (opaque user_id).
2. `POST /api/initiative-views` creates a view with name, scope, filter_json, display_json, sources array.
3. Favorites survive browser refresh and work across tabs.
4. Display layout (grouping, ordering, zoom) is persisted per user.
5. If Postgres is offline, read from localStorage keys (`board-saved-views`, `linear-favorites`, `board-display-options`) and write back on reconnect.
6. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
```

---

### T13 — Proxmox LXC provisioning (Ansible)

**What**
Create an Ansible role and playbook to provision a small Proxmox LXC for the Postgres initiative database. Include a read-only proposal script, check-mode diff, and explicit approval gate.

**Why**
The initiative database needs a dedicated, reproducible, inventory-driven home.

**Files**
- `~/code/ansible-playbooks-homelab/roles/pipekan-pg-lxc/` (new) — role: LXC creation, Debian 12 template, Postgres 16 install, network config, pg_hba, firewall
- `~/code/ansible-playbooks-homelab/proxmox/pipekan-pg.yml` (new) — playbook
- `~/code/ansible-playbooks-homelab/inventory/group_vars/pipekan_db.yml` (new) — vars: proposed vmid, ip, hostname, resources
- `~/code/ansible-playbooks-homelab/scripts/propose-pipekan-db.sh` (new) — read-only discovery script

**Acceptance**
1. `propose-pipekan-db.sh` runs on the Ansible control node and outputs a JSON proposal:
   ```json
   {
     "vmid": "proposed (next free from pvesh)",
     "ip": "proposed (ARP/ping sweep cross-check)",
     "hostname": "pipekan-db-01",
     "resources": { "cores": 1, "memory": 1024, "disk": 8, "ostemplate": "debian-12-standard" }
   }
   ```
2. No hardcoded hosts/IPs/IDs in role or playbook; all values from inventory.
3. Playbook supports `--check` mode; diff is reviewable before approval.
4. Approval gate: playbook prints a summary and exits with code 0 only after `PIPEKAN_DB_APPROVE=1` is set.
5. Role installs Postgres 16, creates `pipekan` database + user, enables `uuid-ossp`, `pg_trgm`, `ltree`.
6. `pg_hba.conf` restricts listen to pipe-kan host subnet only; no public exposure.
7. Vault-fed DSN: role creates a Vault KV entry at path `secret/pipekan/db` with connection string; no plaintext secrets in repo.
8. `bun run typecheck` passes (for any TS scripts in the role).

**Verification**
```bash
# Run proposal script (read-only)
ansible-playbook -i inventory proxmox/pipekan-pg.yml --check --diff
# After approval:
PIPEKAN_DB_APPROVE=1 ansible-playbook -i inventory proxmox/pipekan-pg.yml
```

---

### T14 — Monitoring hook, backups, restore test, ops runbook

**What**
Add Postgres monitoring hook (health check endpoint), configure pg_dump/pgBackRest backups, PBS vzdump of the LXC, retention policy, restore test, and ops runbook.

**Why**
Operational reliability for the new database.

**Files**
- `src/app-api.ts` — add `GET /api/health/db` (returns pool status, last migration version)
- `~/code/ansible-playbooks-homelab/roles/pipekan-pg-lxc/templates/pgbackrest.conf.j2` (new)
- `~/code/ansible-playbooks-homelab/roles/pipekan-pg-lxc/templates/backup-cron.j2` (new)
- `docs/factory/plans/gbj-20261018-025-pipekan-initiatives/ops-runbook.md` (new)

**Acceptance**
1. `GET /api/health/db` returns `{ ok: boolean, migration: string, pool: { total: number, idle: number } }`.
2. pgBackRest configured for full backup daily, incremental every 6 hours, WAL archiving to PBS.
3. PBS vzdump of the entire LXC weekly (retention: 4 weekly, 12 monthly).
4. Restore test: quarterly manual restore from backup to a temp DB, verify migrations table checksums match.
5. Ops runbook documents: DSN rotation procedure (Vault), scaling (add CPU/memory), failure escalation (pipe-kan host cannot reach DB → check network → check LXC → check Postgres), backup recovery steps.
6. No real secrets in runbook; placeholders like `{{ vault_pipekan_db_dsn }}`.

**Verification**
```bash
# Health check
bun run dev
# Then: curl http://localhost:PORT/api/health/db
```

---

### T15 — Fake-data smoke tests, fixtures, ADR-0020

**What**
Create fake Plane initiatives fixture, ephemeral Postgres for migration + CRUD tests, UI smoke tests (Playwright/vitest per repo conventions), ADR-0020 draft, user docs.

**Why**
Vishal's rule: smoke test with fake data only. No live Plane/Jira credentials in tests or docs.

**Files**
- `fixtures/plane-initiatives.json` (new) — ≥5 fake initiatives with children, labels, projects, updates
- `fixtures/db-initiatives.json` (new) — ≥3 fake DB-backed initiatives with Taskwarrior/Jira links
- `src/db/initiative-store.test.ts` (new) — vitest against ephemeral Postgres (Docker or `pg_tmp`)
- `src/plane-initiatives.test.ts` (new) — vitest with nock/mock fetch for Plane v2/v1
- `src/components/initiative-list.test.tsx` (new) — vitest rendering with fake data
- `docs/adr/0020-initiatives-architecture.md` (new)
- `docs/factory/plans/gbj-20261018-025-pipekan-initiatives/user-guide.md` (new)
- `docs/factory/plans/gbj-20261018-025-pipekan-initiatives/smoke-log.md` (new)

**Acceptance**
1. `fixtures/plane-initiatives.json` contains fake names only ("Acme Demo", "DEMO-12", "Q3 Roadmap", "Platform Migration").
2. Ephemeral Postgres test uses `pg_tmp` or Docker `postgres:16-alpine`; migrations run forward; CRUD passes; teardown drops DB.
3. `src/plane-initiatives.test.ts` mocks Plane v2 responses, validates field mapping, tests v1 fallback on 404.
4. `src/components/initiative-list.test.tsx` renders tabs, table, tree with fake data; asserts data-smoke selectors.
5. ADR-0020 documents: decision to use real Plane initiatives, adapter pattern, DB-backed fallback, provisioning choice (LXC vs Docker), data-minimisation rules.
6. User guide covers: creating initiatives, linking projects, posting updates, understanding combined view.
7. Smoke log contains screenshots + console output from `bun run smoke`.
8. `bun test` passes.
9. `bun run typecheck` passes.

**Verification**
```bash
bun run typecheck
bun run build
bun test
bun run smoke
```

---

## Ticket ordering and waves

| Wave | Tickets | Theme |
|---|---|---|
| Pre-P0 | T-Spike-Plane-Initiative-Tree | Validate Plane API capabilities |
| P0 | T1, T2, T3, T4, T5 | Read, schema, DB CRUD, retire modules, basic UI |
| P1 | T6, T7, T8, T9, T10 | Write, link, updates, graph, detail |
| P2 | T11, T12, T13, T14, T15 | Combined view, persistence, provisioning, ops, docs |

**Parallel safe:** T1 and T2 are independent (Plane adapter vs Postgres schema). T3 depends on T2. T4 depends on T1. T5 depends on T1+T4. T6-T10 are sequential within P1 but T6/T7 can start once T5 is done. T11 depends on T1+T3+T5. T12 depends on T2+T5. T13/T14 are independent of code tickets. T15 depends on all prior.
