## Factory session

Herdr session `jira-kan`. Lanes: coordinator (historical orch), planner, builder, referee.
See `docs/factory/session-layout.md`. Product work is not Work Factory (`asf-work`).
Factory Intake talks to this session through desk `desk-pipe-kan` on
`grokbot-coordinator`, not by reviewing on the intake switchboard.

## Specs and tickets

The **planner** owns specs and GitHub issues. Host skills (do not copy into
git): `grill-with-docs` → `to-spec` → `to-tickets` in **one** transcript, then
`implement` per ticket on a **fresh** builder. Grill always runs. If the
operator prompt or card says take recommendations, accept ➡️ and continue;
otherwise interview as usual. Incoming issues the factory did not create:
`/triage`. Do not invent tickets on the builder. Tracker:
`docs/agents/issue-tracker.md`. Factory Intake `SPECS.md`.

## Versioning

This product uses **semantic-release** on `main` (`.releaserc.json`, Angular
types). Factory Intake `VERSION-IMPACT` is a maker/Referee gate, not a header
only. **This repo decides the version number.** Intake must not write `0.x.y`.

| VERSION-IMPACT | Commit type | Version number |
|---|---|---|
| `minor` | `feat:` | semantic-release on `main` |
| `patch` | `fix:` | semantic-release on `main` |
| `major` | `feat!:` or footer `BREAKING CHANGE:` | semantic-release on `main` |
| `none` | `docs:` / `chore:` | no release |

Makers apply the commit type. Do not bump `package.json`. Do not run
`semantic-release` locally. `chore:` / `docs:` for a `minor` job is a Referee
FAIL. A green suite that used the wrong type is a FAIL; an unchanged
`package.json` is not.

## Git alignment

Before a feature or bug: `git fetch` and `git pull --ff-only` so work starts
on published `main`. After CI ships (`chore(release)` + `v*` tag): pull again
so the clone matches origin. Diverged trees, conflicts, failed CI, or a
missing tag when a release was expected: **stop for a human**. Do not force.
Do not stash product work to make a pull succeed.

## After ship (panes)

Job tabs are ephemeral. After publish to `main`, Factory Intake closes idle
planner / maker / Referee / UI tabs. Keep this session’s orch (`w1:p1`) and
`pipe-kan-grok` (`w2:p1`). Factory Intake `PANES.md`.

## UI reviewer

Independent of the builder. Herdr `--kind omp` with `--model cursor/claude-4.5-sonnet`
(Cursor Claude 4.5 Sonnet, Cursor subscription) on tab `ui-review`. Prompt:
`docs/factory/prompts/ui-review.md`. Maker ≠ checker. Not `--kind claude`.

## Code review

Independent of the builder **and** of UI review. Host skill
`~/.agents/skills/code-review/SKILL.md` (not the thin `.agents/skills/code-review`
sidepanel digest). Two axes: Standards vs Spec, parallel sub-agents. After
Referee PASS unless the card says `parallel` or `referee-uses: code-review`.
Fixed point on the card (default merge-base with `origin/main`). Do not share
a pane with architecture-review.

## Architecture review

Independent of the builder, Referee, UI review, and `code-review`. Host skills
`improve-codebase-architecture` + `codebase-design`. Default **before makers**.
HTML report in `$TMPDIR`; operator picks a candidate. Not a PQC PASS/FAIL.
Do not copy skills into git.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `ivishalgandhi/pipe-kan`. See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
