# Performance guard

Budgets are against pipe-kan 0.34.2, measured the same way before this UI change.

## Method

- App: `bun src/start.ts` with the synthetic Plane fixture, `--plane --workspaces work,personal --scopes work/PULSE,personal/PULSE`.
- Browser: headless Chrome, CDP. Each sample uses a fresh server so a switch cannot leak into the next cold load.
- Cold load: `performance.now()` when the first kanban column is in the document. The in-app mark is `pipe-kan:cold-load` (script start to first column).
- Project switch: click Aphrodite in the workspace switcher. Time until the card keys change. Includes the existing 400ms scope debounce.
- Workspace switch: click the `personal/PULSE` team row (`data-smoke="team-scope"`). Time until the card keys change. Same debounce.
- Script: `scripts/measure-linear-look.ts`.

The 0.34.2 run had no in-app marks, so the budget uses the DOM times.

## Baseline (0.34.2)

| Sample | Cold | Project switch | Workspace switch |
|---|---:|---:|---:|
| 1 | 365ms | 507ms | 451ms |
| 2 | 321ms | 504ms | 451ms |
| 3 | 339ms | 506ms | 458ms |
| Median | 339ms | 506ms | 451ms |

## After this change

| Sample | Cold (DOM / mark) | Project (DOM / mark) | Workspace (DOM / mark) |
|---|---:|---:|---:|
| 1 | 357 / 102 | 522 / 515 | 443 / 433 |
| 2 | 314 / 87 | 512 / 495 | 450 / 442 |
| 3 | 317 / 85 | 523 / 506 | 457 / 437 |
| Median DOM | 317ms | 522ms | 450ms |

## Budgets

| Check | Budget | Median | Result |
|---|---:|---:|---|
| Cold load | ≤ 389ms | 317ms | pass |
| Project switch | ≤ 536ms | 522ms | pass (+16ms) |
| Workspace switch | ≤ 481ms | 450ms | pass |

Switch times are dominated by the existing 400ms debounce plus one refresh. This change does not add a fetch on that path.
