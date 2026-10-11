# Factory job: Linear-inspired Create + Edit Cards/Issues (pipe-kan)

You are the maker agent. Implement this feature end-to-end on the current branch `feat/create-edit-cards-ai-labels` in `/Users/vishal/code/pipe-kan`. Do not clone. Do not stop herdr sessions. Do not commit secrets. Prefer conventional commits. Do not bump package.json version (release bot owns that); record VERSION-IMPACT as **minor**.

## Product requirements (must ship)

1. Creating and editing Cards/Issues feels intuitive, Linear-like.
2. Create entry points:
   - Discoverable `+` at the bottom of a Column (or equivalent create affordance on the Board).
   - Cmd/Ctrl+K Command overlay: add **Create issue** and **Create with AI** actions. The old command-spec said "no Create" — that constraint is **lifted**. Extend `src/command.ts` carefully; update tests.
3. Create flow supports an AI assistant path that helps draft the Issue (wire into existing Agent sidepanel and/or a composer "Create with AI" mode that seeds Agent context).
4. While the user types title/description, automatically **suggest labels** from existing project labels + keyword/heuristic (Linear Triage Intelligence style). Show chips to accept/dismiss. Do **not** silent-apply unless the product already has that pattern (it does not — user accepts).
5. Same composer/modal works for **edit** and **create**.

## UX notes (mirror Linear patterns, not branding)

- Create: `+` on column + Cmd+K Create (+ AI). Optional Agent assist for drafting.
- Label suggestions MVP: heuristic/quick suggestions from typed text vs labels already present on Board Issues. Richer AI suggestions if Agent path is easy.
- Edit: open existing Card into the same composer.

## Technical constraints

- Vocabulary: CONTEXT.md (Issue, Card, Column, Command, Agent, Write-back, etc.).
- Write-back MUST go through jira-cli patterns like existing `move` (`src/cli.ts` `createJiraCli` / `createStoreCli`, `src/app.ts`, `src/app-api.ts`, ADR-0001). Do **not** invent direct Jira REST auth.
- Extend existing chrome: `src/command.ts`, `src/components/command-overlay.tsx`, `src/App.tsx`, `src/components/ui/kanban.tsx`, agent under `src/components/agent/`, tools in `src/server/agent/tools.ts`.
- Keep modal consistent with hairline/radius style already used (Command overlay / cards).
- Fake/store path must support create/edit for tests (extend `IssueStore` / `createStoreCli` / fake-jira as needed).
- Investigate `jira issue create` / `jira issue edit` CLI flags before inventing argv. Prefer `--no-input` / non-interactive flags. Mirror how `move` returns `{ ok, error? }`.

## Suggested design (investigate first; adapt if better seams exist)

### Domain / pure logic (testable seams)
- `src/label-suggest.ts` — `suggestLabels({ text, labels, selected? })` heuristic: substring/token match of title+description against existing label strings; case-insensitive; stable order; exclude already-selected; cap ~5.
- Extend `CommandJump` with `{ kind: "create" }` and `{ kind: "create-ai" }` (or one create with `ai?: boolean`). Empty-query Actions should include Create issue and Create with AI near Agent/Refresh. Update `command.test.ts`.
- Composer state type: mode create|edit, title, description, labels[], column/status?, epic?, key? for edit.

### CLI / App / HTTP
- Add `Cli.create(...)` and `Cli.edit(...)` (or equivalent) using jira-cli.
- App methods + `/api/issue/create` and `/api/issue/edit` (or single `/api/issue` with method) returning updated board or created key; on success refresh/merge like move does.
- Store path: create Issue in memory; edit summary/description/labels.

### UI
- Issue composer modal (create+edit): title, description, label chips + suggestions, save/cancel; Escape closes.
- Column `+` opens composer with that Column status preselected when possible.
- Card edit entry: context menu or obvious edit control / double-click / Open-pane edit — pick the most Linear-intuitive that fits existing UI density; document choice in PR.
- Cmd+K Create → composer; Create with AI → open Agent (or composer AI mode) with a draft prompt to help write the Issue, then land in composer or create via tool.

### Agent (optional but preferred)
- If feasible: tool `create_issue` / `edit_issue` (mutating, needs approval) mirroring move_card.
- Create with AI can open Agent Sidepanel with a system/user nudge to draft title/body/labels.

### Tests (required)
- Command catalog includes Create actions; pick yields create intents.
- Label suggestion heuristics (tables of text → suggested labels).
- Composer/create-edit pure behavior if extracted; CLI/store create+edit unit tests; API handler tests if pattern matches existing `app-api.test.ts`.
- Keep `bun test` and `bun run typecheck` green. Run `bun run build` if practical.

## Process
1. Read CONTEXT.md, ADR-0001, existing move path, command tests, App Command wiring, kanban column footer.
2. Plan briefly (todos), then implement.
3. Commit with conventional commits (feat/fix/test) as you go; do not force-push; do not amend others' commits.
4. Do **not** open the PR yourself unless asked — leave the branch pushed if credentials allow; otherwise leave commits local. Prefer `git push -u origin HEAD` if network works.
5. End with a PQC-style summary: what changed, files, commands run + exit codes, VERSION-IMPACT: minor, residual risks.

## Acceptance criteria checklist
- [ ] `+` on column opens create composer
- [ ] Cmd+K has Create issue and Create with AI
- [ ] Create with AI uses Agent (or documented AI draft path)
- [ ] Edit opens same composer with existing fields
- [ ] Label suggestions appear as accept/dismiss chips while typing
- [ ] Write-back via jira-cli / store only
- [ ] Tests for command create, label suggest, create/edit behavior
- [ ] typecheck + tests green
