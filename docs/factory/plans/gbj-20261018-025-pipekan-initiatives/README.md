# gbj-20261018-025 pipe-kan Initiatives plan

**Scope:** Replace the modules-derived "Initiatives" fallback with real Plane initiatives, add a Postgres-backed initiative store for non-Plane sources, provision the DB on a Proxmox LXC, integrate into the multi-source switcher with a combined view, and match Linear's initiatives UI exactly.

**Branch:** `docs/pipekan-initiatives-plan-20261018`

**Parent release:** 0.35.0

## Plan documents

| File | Purpose |
|---|---|
| `spec.md` | Full specification: audit, target architecture, data model, API, UI spec, phasing, risks, assumptions |
| `tickets.md` | 15 code tickets + 1 spike ticket with What/Why/Files/Acceptance/Verification |
| `README.md` | This summary |

## What this plan covers

1. **Real Plane initiatives** — Read from `/api/v2/workspaces/{slug}/initiatives/` (v1 fallback), map fields (id, name, description, state, lead, dates, labels, project_ids, epics), retire modules-based fallback.
2. **Postgres database** — Dedicated DB on its own Proxmox LXC for sources lacking native initiatives (Taskwarrior, Jira cross-project). Schema, migrations, pooled client, offline degradation.
3. **Provisioning** — Inventory-driven Ansible role, read-only proposal script, check-mode diff, explicit approval gate. No hardcoded IPs/IDs.
4. **Multi-source combined view** — Merge Plane native + DB-backed + Jira cross-project initiatives with source badges, dedup rules, partial-failure handling.
5. **Linear UI parity** — Tabs (Active/Planned/Completed), table columns, tree, health popover, updates composer, progress graph, create modal, detail page.

## Ticket summary

| Ticket | Title | Phase |
|---|---|---|
| T-Spike | Plane initiative tree + epic link capability spike | Pre-P0 |
| T1 | Plane initiative adapter: read native initiatives | P0 |
| T2 | Postgres schema, migrations, pooled client | P0 |
| T3 | DB-backed initiative CRUD and cross-source links | P0 |
| T4 | Retire modules-based initiatives; keep modules visible | P0 |
| T5 | Linear initiatives list UI: tabs, columns, tree | P0 |
| T6 | Initiative create/edit modals | P1 |
| T7 | Project/epic link/unlink with optimistic update + rollback | P1 |
| T8 | Health updates popover + composer | P1 |
| T9 | Progress graph (stacked area/streamgraph) | P1 |
| T10 | Initiative detail page (overview, projects, children tabs) | P1 |
| T11 | Multi-source combined initiatives view | P2 |
| T12 | Saved views, favorites, display layout migrated to Postgres | P2 |
| T13 | Proxmox LXC provisioning (Ansible) | P2 |
| T14 | Monitoring hook, backups, restore test, ops runbook | P2 |
| T15 | Fake-data smoke tests, fixtures, ADR-0020 | P2 |

## Rules

- No code changes outside docs in this branch. Maker executes tickets.
- Fake data only in specs/tests (`Acme Demo`, `DEMO-12`, etc.).
- Local screenshots in `linear-refs-local/` are untracked and never committed.
- No vendor/hardware names in committed files.
- No real secrets in repo or docs; Vault placeholders only.
