# Plane Workspace switch lists tenants, rewrites Projects, and is on Command

Plane REST is always `/workspaces/{slug}/…`. This host’s PAT still 404s list-workspaces (`GET /api/v1/users/me/workspaces/` and `/workspaces/`; makeplane/plane#9427 open, #9503 unmerged), but the user needs to **pick** a Workspace and load that tenant’s Projects, including from Command. We probe those list paths and use `{id, name, slug}` when present; 404 or an empty list keeps typed Other-slug. A switch writes `--workspace` and **rewrites `--projects`** from `GET /workspaces/{slug}/projects/` identifiers so Scope, the project chip, and the rail do not keep the previous tenant’s ids. Session-only: argv `--workspace` / env `PLANE_WORKSPACE` / default `personal` still win next launch. Jira omits the control and omits Command Workspace rows (no disabled chrome). Google SSO is not Workspace selection.

This supersedes ADR-0015 (typed-slug-only, no list probe, no `--projects` change, no Command row).

## Status

Accepted (supersedes ADR-0015)

## Considered options

- **Typed-only header pill (ADR-0015)** — rejected. Operator wanted selection from workspaces the PAT can see, Projects that follow, and Command.
- **Skip the probe until #9503 merges** — rejected. Ship the probe so an instance that lands the route can list; typed Other remains the 404/empty path.
- **Keep previous `--projects` across a switch** — rejected. Those identifiers belong to the old tenant; `loadCatalog` would filter the new catalog to the wrong ids.
- **Last-used slug in localStorage** — rejected. Next launch stays argv > env > `personal`.
- **Disabled Jira control / Command rows** — rejected. Omit entirely. Process kind owns chrome, not `--plane` in Scope flags.
- **Google SSO as Workspace selection** — rejected. Orthogonal (`gbj-20260918-002` / PR #58).

## Consequences

- Board/Refresh JSON may include a workspace list when the probe returns one; omit the field on 404/empty so the client uses Other/type slug.
- Command (ADR-0011) stays a jump overlay for listed Issues, not Search. Plane adds a **Workspace** group on that same overlay; picking a row uses the header picker’s commit path (flags + Refresh-all confirm).
- Favourites still reset after a **successful** all-Refresh whose resolved Workspace differs from the stamp (same idea as today’s `--projects` stamp).
- Generic example slugs only in git (`personal`, `team`, `other`).
