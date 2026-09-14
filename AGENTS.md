## Factory session

Herdr session `jira-kan`. Lanes: coordinator (historical orch), planner, builder, referee.
See `docs/factory/session-layout.md`. Product work is not Work Factory (`asf-work`).

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

## UI reviewer

Independent of the builder. Herdr `--kind claude` with `--model sonnet` on
tab `ui-review`. Prompt: `docs/factory/prompts/ui-review.md`. Maker ≠ checker.

## Agent skills

### Issue tracker

Issues live in GitHub Issues for `ivishalgandhi/pipe-kan`. See `docs/agents/issue-tracker.md`.

### Triage labels

Defaults: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` at the repo root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.
