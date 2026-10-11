# HARD GATE — thorough create/edit tests before PR (non-negotiable)

Do NOT open a PR until ALL of the below have automated coverage and `bun test` + `bun run typecheck` are green.

Prefer pure/logic + API/cli/store/fake-jira seams (repo style). For UI entry points that are hard to component-test, extract small testable helpers (e.g. `openCreateFromColumn`, `openEditFromCard`, `buildCreatePayload`, `canSubmitComposer`) and test those — same family as commandCatalog.

## CREATE suite (must cover)
1. Open composer via column bottom `+` (status/column context preselected when applicable)
2. Open create via Cmd/Ctrl+K Command action **Create issue**
3. Open create via Cmd/Ctrl+K **Create with AI** (seed Agent / AI path)
4. Submit create with title (+ optional description/labels) writes via jira-cli path / store / fake-jira
5. Validation: empty title blocked (no write)
6. Label suggestions from typed title/body; accept chip; dismiss chip
7. AI-assisted create path if present (agent draft → composer / create_issue tool)
8. Parent/epic/column context when creating from a column (if product supports it)
9. Error path when jira create fails (409/error returned; board unchanged)

## EDIT suite (must cover)
1. Open edit from an existing Card into the **same** composer
2. Prefill title, description, labels from Issue
3. Save edit writes updates via jira path / store / fake-jira
4. Cancel/Escape discards without write
5. Label suggest works in edit mode too
6. Error path when update fails

## Keep green
- command.test, issue-composer, label-suggest, app-api, cli, fake-jira, store, agent tools tests

## Process
1. Finish App wiring if still incomplete
2. Expand tests to cover every bullet above (add `src/issue-write.test.ts` or extend existing files — your call)
3. `bun test` and `bun run typecheck` must pass
4. Then conventional commit(s), push, `gh pr create` with evidence listing which tests cover which bullets
5. Do not discard existing work; do not commit `.scratch/`, `1`, `EOF`
