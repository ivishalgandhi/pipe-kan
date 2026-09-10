# pipe-kan

Local Kanban for [jira-cli](https://github.com/ankitpokhrel/jira-cli). The first release changes Jira only by running jira-cli.

## Run

```sh
bunx pipe-kan
# or
npx pipe-kan
```

Opens `http://127.0.0.1:5173`. No clone, no `bun install`. `bunx` / `npx` installs the published package into a cache and runs it.

First paint is the Fixture. If `jira` is on PATH, the process then Refresh-es from your existing `jira init`. If not, Refresh and Move use the in-process store.

The published CLI is on npm. From a clone: `bun run build && bun dist/pipe-kan.js`.

- Left: All stories and All epics. Center: Cards (one Column per status in the payload). Right: Open URL; remote Jira is a link, not an iframe.
- Drop a Card on a Column to Move (`jira issue move`).
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

Scope flags start empty. Add `-a you@work.com` or `-s~Done` if you want a tighter list, then Refresh.

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

## Limits

- Write-back is `jira issue move` only. Intra-column rank is not persisted.
- Never a direct Jira REST Write-back.
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
