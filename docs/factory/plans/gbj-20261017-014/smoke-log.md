# Smoke log — gbj-20261017-014 slice 1

Date: 2026-10-18. Branch `feat/pipecan-linear-ui-maker-20261018`.
`command -v jira` was empty, so boot kind is `store`. `JIRA_API_TOKEN` was the literal `fake`. No live Jira host was contacted.

## `bun test`

```
 463 pass
 0 fail
 1124 expect() calls
Ran 463 tests across 30 files. [3.97s]
```

Exit 0.

## `bun run typecheck`

```
$ tsc --noEmit
```

Exit 0.

## `bun run build`

```
$ vite build && bun build src/bin.ts --outfile dist/pipe-kan.js --target node --banner '#!/usr/bin/env node'
vite v8.2.2 building client environment for production...
✓ 1950 modules transformed.
dist/ui/index.html                   0.93 kB │ gzip:   0.49 kB
dist/ui/assets/index-BtuKBXwg.css   53.06 kB │ gzip:   9.48 kB
dist/ui/assets/index-DlebjkVt.js   740.13 kB │ gzip: 226.70 kB
✓ built in 218ms
Bundled 130 modules in 13ms
  pipe-kan.js  0.43 MB  (entry point)
```

Exit 0. The chunk-size warning is the existing client bundle, not a new failure.

## Fake data server

```bash
JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bun run dev
```

```
pipe-kan http://127.0.0.1:5173
cli store
Fake Jira http://127.0.0.1:5173/rest/api/2/search
Fake Jira config /var/folders/8x/tdhymwnj2ln90xh9g6ny54jw0000gn/T/pipe-kan/jira.config.yml
```

`JIRA_CONFIG_FILE` is the path a jira CLI would read. With no `jira` binary, the server writes Fake Jira config through `writeJiraConfig(join(tmpdir(), "pipe-kan"), origin)`. On this machine that is the macOS temp directory, not `/tmp/pipe-kan/jira.config.yml`. Written file (no token):

```
installation: Cloud
server: http://127.0.0.1:5173
login: user@test.com
auth_type: basic
project:
  key: DEMO
  type: classic
board: ""
```

`GET /api/board`:

- columns 3
- To Do (8): DEMO-2, DEMO-4, DEMO-6, DEMO-10, DEMO-13, DEMO-16, DEMO-18, DEMO-21
- In Progress (4): DEMO-3, DEMO-11, DEMO-14, DEMO-17
- Done (4): DEMO-5, DEMO-12, DEMO-15, DEMO-19
- epics (5): DEMO-1 In Progress, DEMO-7 To Do, DEMO-8 Done, DEMO-9 In Progress, DEMO-20 To Do

`fixtures/issues.json` has 21 issues. Statuses are To Do, In Progress, and Done. Priorities include Highest, High, Medium, and Low. Assignees include Alice, Bob, Carol, Person A, and Person B. Labels include needs-input, bug, feature, and design. Due dates include a past date (2026-09-30), a date within 3 days of 2026-10-18 (2026-10-20), and a future date (2026-11-20). Target end includes past and future dates. Epics are DEMO-1, DEMO-7, DEMO-8, DEMO-9, and DEMO-20. DEMO-9 carries needs-input and design.

## Headless browser

Computed styles from `docs/factory/plans/gbj-20261017-014/smoke/console.txt`.

Light: sidebar `#efeff0`, background `#f9f9fa`, border `#e2e2e2`, muted-foreground `#b0b5c0`, accent `#e4e4e6`, sidebar-accent `#e4e4e6`. Nav 242×28, radius 8px. Board pane 1165×797, radius 12px. Card 358×96, radius 9px.

Dark: sidebar `#09090a`, background `#121213`, border `#212224`, muted-foreground `#6b6f76`, accent `#ffffff08`, sidebar-accent `#ffffff08`. Same nav, pane, and card metrics.

Open pane width 320, status dot present. Sample fields for DEMO-10: Summary, Priority Highest, Assignee Alice, Due date 2026-09-30, Labels bug.

Command overlay: the first synchronous query returned false because React had not committed. The dialog was present for the screenshot. Escape closed it (`command closed true`).

Calendar wrapper radius 12px, toolbar title 13px, button height 28.

`POST /api/move` `{key: DEMO-11, status: Done}` returned ok. Done keys became DEMO-5, DEMO-11, DEMO-12, DEMO-15, DEMO-19. That change was process memory only. `fixtures/issues.json` was not rewritten.

Browser console: Vite connect lines and the React DevTools info line. No exceptions.

Screenshots:

- `docs/factory/plans/gbj-20261017-014/smoke/board-light.png`
- `docs/factory/plans/gbj-20261017-014/smoke/board-dark.png`
- `docs/factory/plans/gbj-20261017-014/smoke/open-pane.png`
- `docs/factory/plans/gbj-20261017-014/smoke/command.png`
- `docs/factory/plans/gbj-20261017-014/smoke/calendar.png`
- `docs/factory/plans/gbj-20261017-014/smoke/console.txt`

Not measured in the browser: epic row height (the selector missed the row; `EpicButton` is `h-10`). Pointer drag was not driven; the move was proven through `/api/move`.
