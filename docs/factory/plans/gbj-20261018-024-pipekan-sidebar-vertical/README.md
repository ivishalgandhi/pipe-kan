# gbj-20261018-024 vertical team sidebar

The job card is the plan. This note records what shipped.

## Change

Your teams is a vertical tree. Each team row has an icon, the scope name, a caret, and a hover menu. Children are full-width rows: Home, Triage (count), Issues (All stories, My issues, All epics), Cycles (Current and Upcoming, with a left guide, still disabled), Projects, and Views (Combined, Calendar, Presets). One sidebar row is `aria-current="page"`.

Favourites and the Epic list stay in the Board section. Presets render under the first team's Views so the save control is not duplicated.

## Smoke

`bun run smoke` includes `scripts/smoke-sidebar-vertical.ts`. Log: `smoke-logs/smoke.log`.

The vertical-list run checks the tree, indentation, cycle guide, every previous board mode, presets, and a single current row. The 0.35.0 linear-look smoke still passes.

## Performance

Same method as `docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan/perf.md`. Fresh server per sample. Synthetic Plane fixture, both scopes. Before is this branch at 0.35.0 (`4eb7c38`) before the sidebar edit.

| Sample | Cold DOM / mark | Project DOM / mark | Workspace DOM / mark |
|---|---:|---:|---:|
| Before 1 | 342 / 87 | 504 / 497 | 464 / 445 |
| Before 2 | 303 / 84 | 518 / 509 | 454 / 433 |
| Before 3 | 314 / 83 | 531 / 510 | 465 / 444 |
| Before median | 314 / 84 | 518 / 509 | 464 / 444 |
| After 1 | 288 / 119 | 539 / 522 | 483 / 447 |
| After 2 | 268 / 95 | 525 / 511 | 447 / 445 |
| After 3 | 279 / 93 | 498 / 522 | 445 / 443 |
| After median | 279 / 95 | 525 / 522 | 447 / 445 |

DOM medians stay inside the 0.34.2 budgets (cold ≤ 389, project ≤ 536, workspace ≤ 481). Cold and workspace DOM are faster than 0.35.0. Project DOM is +7ms, inside the earlier sample spread. Switches still wait on the existing scope debounce. No extra fetch was added on that path.

Bundle, production build: UI JS 837609 → 842394 bytes (vite gzip 251.12 → 252.41 kB). CSS 56357 → 56741 bytes (vite gzip 10.15 → 10.20 kB). `dist/pipe-kan.js` stays 458849 bytes.

## Gaps

- Cycles remain disabled.
- Presets hang off the first team only.
- A favourited Epic can still use the accent fill on both its favourite row and its Board list row. `aria-current` is only on the list row.
- Choosing an opener does not change the Calendar canvas tab. The sidebar row follows the opener. The Calendar row is current when that tab was chosen.
