# pipe-kan

Local Kanban for [jira-cli](https://github.com/ankitpokhrel/jira-cli) or [Plane](https://plane.so). Jira write-back still goes through jira-cli. Plane write-back uses the Plane REST API.

## Run

```sh
bunx pipe-kan
# or
npx pipe-kan
```

Opens `http://127.0.0.1:5173`. No clone, no `bun install`. `bunx` / `npx` installs the published package into a cache and runs it.

If `--plane` is set, first paint is live Refresh. A failed live Refresh stays in Plane mode and keeps the last live Board, with the error on the Board. If live Refresh never succeeded, the Fixture is not shown. If `jira` is on PATH and `--plane` is off, first paint is the Fixture, then Refresh from your existing `jira init`. If `jira` is missing and `--plane` is off, first paint is the Fixture and Refresh, Move, Create, and Edit use the in-process store.

The published CLI is on npm. From a clone: `bun run build && bun dist/pipe-kan.js`.

- Left: All stories and All epics (Plane: modules in that left rail). Center: Cards (one Column per status; Plane also keeps empty workflow states). Right: Open URL; remote Jira is a link, not an iframe.
- Drop a Card on a Column to Move (`jira issue move`, or Plane `PATCH` work-item state).
- Column `+` or Cmd+K **Create issue** opens a composer. **Create with AI** seeds the Agent to draft and call `create_issue` after approval.
- Double-click a Card or Open-pane **Edit** to change summary, description, and labels (`jira issue edit`).
- Drag a Column to change status order. The order is stored locally and kept after Refresh.
- Same-Column drop does not write back to Jira.
- Collapse the left pane to hide Epics; the Board header expands it again.
- Theme is stored in `localStorage`.

LAN: `HOST=0.0.0.0 bunx pipe-kan`.

## Work Jira

Use your existing `jira init` config. Do not set `JIRA_CONFIG_FILE` to the Fixture file.

```sh
export JIRA_API_TOKEN=...   # only if jira-cli does not already have it
bunx pipe-kan
```

Scope flags start empty (jira-cli's one Project). Add `-a you@work.com` or `-s~Done` if you want a tighter list, then Refresh. More than one Project key: `--projects` below.

## Plane

Plane is an alternate backend. Jira stays the default. Auth is environment-only — do not put the key in flags, git, or the Scope field.

```sh
export PLANE_API_KEY=...
# optional; default is this self-hosted instance
export PLANE_HOST=https://plane.tail48fe8.ts.net
bunx pipe-kan --plane --projects APH,PULSE,PKAN,PUI,DEC
```

| Flag / env | Default | Role |
| --- | --- | --- |
| `--plane` | off | use Plane instead of jira-cli |
| `--workspace` | `personal` | Plane workspace slug (`--workspace team` or `PLANE_WORKSPACE`) |
| `--projects APH,PULSE` | all workspace projects | Plane project identifiers |
| `PLANE_API_KEY` | (required in Plane mode) | personal access token (`X-API-Key`) |
| `PLANE_HOST` | `https://plane.tail48fe8.ts.net` | Plane origin; API is `{host}/api/v1` |

Same `--projects` style as Jira: comma-separated, trimmed, uppercased. The header **Scope flags** field accepts the same string, then **Refresh**.

On Refresh:

- Work items become Cards. Workflow states become Columns (including empty states, so you can drop onto them).
- Modules fill the left rail like Epics. Selecting a module shows its work items.
- Label `needs-input` is a warning badge on the Card.
- Drop a Card on a Column PATCHes that work item's state. Same-Column drop is still a no-op.

Create and Edit use Plane REST when `--plane` is set. Pulse, Plane Pro, scraping, and SQL workspace moves are out of scope.

A Plane `429 RATE_LIMIT_EXCEEDED` does not fall back to Fake Jira. Plane waits the rate-limit window, then continues.

## Multiple projects

Default Scope is one Project — jira-cli's `jira init` project. To list more than one Project key:

```sh
bunx pipe-kan --projects KEY1,KEY2
```

`--projects` is a pipe-kan Scope flag. Comma-separated keys; trimmed and uppercased. The same string in the header **Scope flags** field, then **Refresh**, is the same Scope.

That Scope becomes JQL `project in ("KEY1", "KEY2")`. `-a`, `-s`, `-t`, and `-P` AND onto that clause. `-q` / `--jql` replaces the generated JQL; `--projects` still records the keys for Favourites and Presets.

With that Scope:

- **Refresh** re-runs `jira issue list` for All stories (`project in (...)` plus the other Scope clauses) and lists All epics as `project in (...) AND type="Epic"`. Epic children are listed for those Epics. Header chip shows the keys, or `DEMO` when Scope has none.
- **Favourites** stay local. When Scope has Project keys, Favourite writes stamp that set.
- **Presets** stay Filter, Sort, and Hide. Save stamps the current Project set. Apply copies that chrome; it does not change Scope. Apply is a no-op when the Preset's Project set does not match the current Scope.

A Pipe may already mix Project keys. Refresh replaces that Board with the current Scope.

## Preset

A Preset is a named, local snapshot of Filter, Sort, and Hide. It is not Scope.

1. Set Filter and Sort in the header. Hide a Column from **Columns** (uncheck its status).
2. Left pane **Presets** (after Favourites). Always shown, default open.
3. Group **…** → **Save Preset**: type a name, **Save** (or Enter). Done when the name is a row. Empty and duplicate names (case-insensitive) fail with "Preset names must be unique".
4. Click the row to Apply: last-used Filter, Sort, and Hide become that snapshot. Apply also restores the opener at Save (All stories, All epics, or Combined). Later Filter / Sort / Hide writes last-used only. Command (Cmd+K) **Apply {name}** is the same Apply.
5. Row **…**:
   - **Save over** — replace that Preset with current last-used chrome
   - **Rename** — prompt; same uniqueness rule as Save
   - **Delete** — drop that Preset

No built-in names. No applied highlight. Search and the selected Epic do not change the Preset list.

## Fake Jira

```sh
JIRA_CONFIG_FILE=/tmp/pipe-kan/jira.config.yml JIRA_API_TOKEN=fake bunx pipe-kan
```

Boot writes that Fake Jira config (path is also printed) and points it at this origin.

## Pipe

```sh
jira issue list --raw | bunx pipe-kan
```

Pipe is the first Board. Refresh and Move still go through `jira` when it is on PATH.

## Env

| Var | Default | Role |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | bind address |
| `PORT` | `5173` | bind port |
| `JIRA_BIN` | `jira` | binary name or path |
| `JIRA_CONFIG_FILE` | jira-cli default | set only for Fake Jira |
| `JIRA_API_TOKEN` | jira-cli default | Work Jira token if needed |
| `PLANE_API_KEY` | (none) | Plane token; required with `--plane` |
| `PLANE_HOST` | `https://plane.tail48fe8.ts.net` | Plane origin |
| `PLANE_WORKSPACE` | `personal` | default workspace if `--workspace` is omitted |

## Limits

- Jira write-back is `jira issue move`, `jira issue create`, and `jira issue edit`. Intra-column rank is not persisted.
- Never a direct Jira REST Write-back.
- Plane write-back is Plane REST (`PATCH` work item state / create / edit). The key stays in `PLANE_API_KEY`.
- Work Jira needs `jira` on PATH and a token. This repo does not ship one.

## Check

```sh
bun test
bun run typecheck
bun run build
```

Contributors still `bun install` and `bun run dev` (Vite). `bun run build` writes the published CLI to `dist/pipe-kan.js`.

## Version

Pushes to `main` run `bun audit --audit-level=high`, tests, then [semantic-release](https://semantic-release.gitbook.io). High or critical dependency CVEs fail the job before a tag or publish. Dependabot opens weekly PRs for `bun` and GitHub Actions. It reads conventional commits since the last `v*` tag:

| Commit | Bump |
| --- | --- |
| `fix:` | patch (`0.1.0` → `0.1.1`) |
| `feat:` | minor (`0.1.0` → `0.2.0`) |
| `feat!:` or `BREAKING CHANGE:` | major |
| `docs:`, `chore:`, `test:` | none |

It writes `package.json`, tags `vX.Y.Z`, opens a GitHub Release, and publishes to npm from this workflow via [trusted publishing](https://docs.npmjs.com/trusted-publishers/). No `NPM_TOKEN`. Provenance is attached automatically.

First Board is tagged `v0.1.0`. Later `fix:` / `feat:` commits on `main` bump from there. Without a `v*` tag the first release is `1.0.0`.
