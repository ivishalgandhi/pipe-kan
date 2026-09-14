# Pipe-Kan factory session layout

**Status:** live chassis 2026-09-13 (`gbj-20260913-005`)  
**Product:** pipe-kan  
**Session name:** `jira-kan`  
**Workspace cwd:** `/Users/vishal/code/pipe-kan`  
**Related:** `AGENTS.md`, `CONTEXT.md`, `docs/adr/`

This file records the Herdr coding-factory session for pipe-kan. It contains no
passwords, tokens, Jira site URLs, or custom field ids.

Pipe-kan product work is **Factory Intake** → this session. It is not Work
Factory (`asf-work`), not Life Desk, not DBRE.

CONTEXT.md **Agent** means the in-app ACP sidepanel. These lanes are **Herdr
session agents**, not that sidepanel.

## Live (design host, 2026-09-13)

`herdr session list` includes `jira-kan` (running). API socket:
`~/.config/herdr/sessions/jira-kan/herdr.sock`.

Do not `herdr session attach jira-kan` from Factory Intake or Work Factory.
Operator TUI attach, from an outer terminal: `herdr --session jira-kan`.

| Field | Value |
|---|---|
| Workspace | `w1` (label `pipe-kan`); historical `w2` (`Pipe-Kan-Grok`) |
| cwd | `/Users/vishal/code/pipe-kan` |

### Historical panes (do not dump new jobs here)

| Pane | Agent | Notes |
|---|---|---|
| `w1:p1` | unnamed omp | Fat transcript; other work (“Actions command overlay”). |
| `w1:p5` | shell | Repo shell. |
| `w2:p1` | `pipe-kan-grok` | Fat transcript; other work (“omitted filter”). |

Factory Intake / DELEGATION: if orch ≥ 60% context, busy, or unreadable → **new
tab + `agent start`**. Those two omp panes are treated as busy/fat.

### Factory lanes (2026-09-13)

| Lane | Tab id | Pane id | Tab label | Agent name | Kind |
|---|---|---|---|---|---|
| Coordinator | `w1:t1` / `w2:t1` | `w1:p1` / `w2:p1` | historical | unnamed / `pipe-kan-grok` | omp (do not prompt for new jobs) |
| Planner | `w1:t2` | `w1:p6` | `planner` | — | shell |
| Builder (005) | `w1:t3` | `w1:p7` | `builder` | `job-20260913-005` | omp — **do not reuse** (file truncation) |
| Referee (005) | `w1:t4` | `w1:p8` | `referee` | `ref-20260913-005` | omp |
| Builder (002) | `w1:t5` | `w1:p9` | `builder-002` | `job-20260914-002` | omp |
| UI reviewer | `w1:t6` | `w1:pA` | `ui-review` | `ui-review` | claude `--model sonnet` after PQC |

Agent names match `[a-z][a-z0-9_-]{0,31}`.

No Actuator pane. Jira mutations stay jira-cli from the **app**, not from these
agents writing REST.

## Server

```
cd ~/code/pipe-kan
env -u HERDR_ENV -u HERDR_SOCKET -u HERDR_SOCKET_PATH \
    -u HERDR_PANE_ID -u HERDR_WORKSPACE_ID -u HERDR_TAB_ID -u HERDR_SESSION \
  herdr --session jira-kan server
```

Attach (outer terminal only):

```
herdr --session jira-kan
```

## New job handoff

```
env -u HERDR_ENV -u HERDR_SOCKET -u HERDR_SOCKET_PATH \
    -u HERDR_PANE_ID -u HERDR_WORKSPACE_ID -u HERDR_TAB_ID -u HERDR_SESSION \
  herdr --session jira-kan tab create --workspace w1 --cwd ~/code/pipe-kan \
    --label <job-id> --no-focus

herdr --session jira-kan agent start <agent-name> --kind omp --pane <new-pane> \
  --timeout 60000
```

## Checks (product)

```
bun test
bun run typecheck
bun run build
```

**VERSION-IMPACT** is a factory gate. This repo’s scheme is `conventional-commits`
(semantic-release). A `minor` job commits `feat:`. The version number is this
repo’s (release bot on `main`), not a factory-supplied `0.x.y`. Referee FAILs
a green suite whose commit type is `chore`/`docs` only. See `AGENTS.md`
Versioning.

**UI reviewer** is a separate checker (BuJo `ui-review` shape): Claude Code
`--model sonnet` on the `ui-review` tab. Maker ≠ checker. Prompt:
`docs/factory/prompts/ui-review.md`. Start only after product PQC is green.
