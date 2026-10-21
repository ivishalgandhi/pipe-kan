# Finish feat/create-edit-cards-ai-labels — ship PR

You are pipe-kan-grok in `/Users/vishal/code/pipe-kan` on branch **`feat/create-edit-cards-ai-labels`**. Substantial uncommitted work is already on disk from a prior maker pass — **do not discard or reset**. Continue from current working tree.

## Already implemented (keep / fix / wire)
- `src/command.ts` + tests: Create issue / Create with AI actions (`kind: "create" | "create-ai"`)
- `src/label-suggest.ts` + tests: heuristic label suggestions
- `src/issue-composer.ts` + tests: draft helpers (accept/dismiss/remove)
- `src/components/issue-composer.tsx`: shared create/edit modal UI
- CLI/App/API/store/fake-jira create+edit write-back via jira-cli patterns (`/api/issue/create`, `/api/issue/edit`)
- Agent tools `create_issue` (+ tests); AgentPanel `seedPrompt` / `onSeedConsumed`
- Various related tests updated

## Still missing / verify (primary remaining work)
1. **Wire UI in `src/App.tsx`** (currently NOT importing IssueComposer):
   - Column `+` affordance opens create composer with that Column status preselected
   - Cmd+K `create` → open create composer; `create-ai` → open Agent with seed prompt to draft an Issue (use existing `seedPrompt` prop), then land in composer or create via tool
   - Edit entry: Open-pane Edit and/or double-click Card → same IssueComposer in edit mode prefilled from Card/open fields
   - On save: POST `/api/issue/create` or `/api/issue/edit`; refresh board on success; toast errors
   - Collect label catalog from Board Cards/Epics for suggestions
2. Ensure create-with-AI path is usable end-to-end (Agent seed + optional create_issue tool).
3. Run `bun test`, `bun run typecheck`, and `bun run build` — fix failures.
4. Conventional commits on this branch (feat/test/fix as appropriate). Do **not** bump package.json version. VERSION-IMPACT: **minor**.
5. `git push -u origin HEAD` and `gh pr create` against **main** with acceptance evidence (create from +, Cmd+K create + AI, edit, label chips, tests/typecheck, VERSION-IMPACT).
6. Do not stop other Herdr sessions. Do not force-push. Do not commit `.scratch/` junk, `1`, or `EOF`.

## Acceptance
- Users can create from column `+` and Cmd+K (incl. AI path)
- Users can edit via intuitive entry into same composer
- Label suggestions as accept/dismiss chips while typing
- Write-back only via jira-cli / store patterns
- Tests + typecheck green (document residual honestly)
- PR URL reported at end

Start by `git status` / reading the new files, then finish App wiring, tests, commit, push, PR.
