# Pipe-Kan factory session layout

**Status:** live chassis 2026-09-13 (`gbj-20260913-005`)  
**Product:** pipe-kan  
**Session name:** `jira-kan`  
**Workspace cwd:** `/Users/vishal/code/pipe-kan`  
**Related:** `AGENTS.md`, `CONTEXT.md`, `docs/adr/`

This file records the Herdr coding-factory session for pipe-kan. It contains no
passwords, tokens, Jira site URLs, or custom field ids.

Pipe-kan product work is **Factory Intake** → desk `desk-pipe-kan` on
`grokbot-coordinator` → this session (`jira-kan`). Intake research and card
writing do **not** live on Factory Intake `w1:p1` (switchboard) and do **not**
use this session’s orch as the intake brain. See Factory Intake `DESKS.md`.
It is not Work Factory (`asf-work`), not Life Desk, not DBRE.

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

### Factory lanes

Durable: `w1:p1` (unnamed orch) and `w2:p1` (`pipe-kan-grok`). Do not dump
new jobs there. Do not close them after ship.

Job tabs (planner / maker / Referee / UI / `code-review`) are **ephemeral**.
Each job gets a **new** tab. After publish to `main`, Factory Intake closes
those idle tabs (Factory Intake `PANES.md`). Do not reuse a previous job’s
Referee or UI tab. Do not treat `ui-review` as a pinned lane.

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

**Git alignment:** pull `--ff-only` before makers; after a ship, wait the
`release` workflow then pull the `chore(release)` commit. Alarming git
(diverged, conflicts, failed CI, missing `v*` tag) is a human gate. See
`AGENTS.md` Git alignment.

**After ship:** close idle job tabs (planner / maker / Referee / UI). Keep
`w1:p1` and `w2:p1`. Factory Intake `PANES.md`.

**UI reviewer** is a separate checker (BuJo `ui-review` shape): OMP
`--model cursor/claude-4.5-sonnet` (Cursor Claude 4.5 Sonnet, Cursor
subscription) on the `ui-review` tab. Maker ≠ checker. Prompt:
`docs/factory/prompts/ui-review.md`. Start after Referee PASS. Not `--kind claude`.

**Code review** is a separate checker (Matt Pocock `code-review` on the host,
`~/.agents/skills/code-review/SKILL.md`). New tab + OMP agent after Referee
PASS unless the card says `parallel`. Two axes (Standards / Spec). Not the
builder, not `ui-review`, not architecture-review. Factory Intake
`CHECKERS.md`.

**Architecture review** is a separate planner-adjacent agent (skills
`improve-codebase-architecture` + `codebase-design`). Default before makers.
HTML in `$TMPDIR`; operator pick is a human gate. Not a PQC. Never on the
`code-review` pane. Factory Intake `CHECKERS.md`.

**Intake desk:** `desk-pipe-kan` on Herdr session `grokbot-coordinator`,
not a pane in `jira-kan`. Factory Intake `DESKS.md`.

**Specs/tickets:** product **planner** (not builder, not intake switchboard).
Matt Pocock `grill-with-docs` → `to-spec` → `to-tickets` in one window;
`implement` per ticket on a fresh builder. Grill always runs; take ➡️ if
the prompt/card says so. GitHub Issues. Factory Intake `SPECS.md`.
