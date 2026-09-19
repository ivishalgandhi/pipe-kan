# Plane Workspace switch is a typed slug in Plane mode

Plane REST is always `/workspaces/{slug}/…`. Public PAT still has no shipped list-workspaces, so the in-app switch is a header pill that types the slug, writes `--workspace` into Scope flags, and Refresh-confirms **all**. We rejected a dropdown against `GET /api/v1/users/me/workspaces/` (Cloud 404 today), Scope-flags-only (no dedicated control), last-used local persistence (argv/env already win on next launch), and showing the control in Jira.

## Status

Superseded by ADR-0016

## Considered options

- **List API / probe** — rejected for this job. `makeplane/plane#9427` is open; `#9503` is unmerged.
- **Scope flags only** — rejected. The ask is an in-app switch.
- **Last-used slug in localStorage** — rejected. Next launch stays argv `--workspace` > `PLANE_WORKSPACE` > `personal`.
- **Gate on `--plane` in Scope flags** — rejected. Process kind (`plane` vs `jira`) owns the chrome; a Jira process must omit the pill even if someone types `--plane` in flags.

## Consequences

- `GET /api/board` and Refresh include `kind` and the resolved Workspace slug so the pill can show env/`personal` without rewriting flags until the user switches.
- The control always writes `--workspace <slug>`, including `personal`, so an env default cannot bounce the pill back.
- Jira Board omits the pill. Google SSO is not Workspace selection.
