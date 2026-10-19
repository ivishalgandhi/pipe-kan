# Sidebar functional fixes

Patch on 0.35.1. Fake fixtures only.

## What changed

- Triage, Active, and Backlog are ephemeral lenses. Sidebar navigation does not write the saved view filter, and leaving the lens clears it.
- Home is an overview. Pulse is a recent-update list. Cycles (Current and Upcoming) render from Plane cycles and are hidden for other sources. Settings is a real page. Dead footer rows are gone.
- The scope chip says All projects when no project keys are selected. Choosing a team clears a project check instead of narrowing to one project.
- Sidebar rows share one icon column, one label column, and a right-aligned count per level. Sections remember open or closed.
- G then I, M, A, B, E, T, C, V, W, P, U, S, D, or H jumps to a view. Cmd+K or Ctrl+K still opens Command. The header breadcrumb shows scope and view.
- Plane catalog GETs run four at a time. A 429 waits for Retry-After once. If the catalog is still short, the Board keeps loaded rows, shows partial, and finishes in the background. The previous cache window stays.

## Checks

`bun run typecheck`, `bun run test`, `bun run build`, then `bun run smoke`. The click smoke opens the built UI against the Plane synthetic catalog, `fixtures/issues.json`, and `fixtures/taskwarrior.json`, clicks every sidebar row, and checks icon and label x with `getBoundingClientRect`.

## Follow-ups

- UI review nit (non-blocking): `Projects` and `Views` appear in both the Workspace section and under each team. Consider one entry with a scope switch, as Linear does. Also collapse the empty trailing count gutter on rows with no count.
- Deployed: CT 425 on 0.35.2 (UI asset matches npm). Work workspace holds 28 projects and 247 issues.
