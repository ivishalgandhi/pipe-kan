# gbj-20261018-019 — pipe-kan Linear parity: Initiatives views & workspace/project switcher

Plan directory for making pipe-kan's Initiatives views and workspace/project switcher match Linear's real app.

## Files

- `spec.md` — Gap analysis, Plane mapping, design direction, acceptance criteria
- `tickets.md` — Tickets T1–T15 with acceptance criteria, verification steps, and ordering
- `smoke-logs/` — Output of `bun run smoke`
- `linear-refs/` — Linear screenshots used as the visual source for the workspace menu, initiatives, projects, display options, teams, and update schedule
  - `.gitkeep` — Keeps directory in git

## Prior art

- `docs/factory/plans/gbj-20261017-014/` — Board/sidebar/command restyle (design tokens)

## Rules

- Plan only; no code changes outside docs/
- Synthetic fixtures only for smoke tests
- No secrets committed
- Do not merge this plan PR
