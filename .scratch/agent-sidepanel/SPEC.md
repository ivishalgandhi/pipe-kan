# Agent Sidepanel Spec

## Goal

Add a Linear-style Agent sidepanel to pipe-kan that drives an external ACP agent (Cursor today, Devin when available). The agent can read board state and repo files, but every mutation needs explicit user approval. The agent never calls Jira directly.

Tracking issue: #24  
Child issues: #18, #19, #20, #21, #22

## Decisions (from ADR-0010)

- ACP is the agent protocol, not a direct LLM API.
- ACP client runs in the Bun server; React client renders streamed events.
- Cursor is the first supported agent. Devin drops in later as another `AgentBackend` config.
- Skills are Markdown instruction files injected as prompt context.
- Agent actions that mutate state require inline user approval.
- All Jira mutations route through the existing `app.move()` + `jira-cli` path.

## Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│ React client                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Agent sidepanel (right, resizable)                  │   │
│  │  - header: agent selector, model selector, close    │   │
│  │  - message stream: user / agent / tool / permission │   │
│  │  - composer: input + attach context + skill chips   │   │
│  └─────────────────────────────────────────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │ WebSocket / SSE
┌───────────────────────▼─────────────────────────────────────┐
│ Bun server                                                  │
│  ┌──────────────────┐   ┌──────────────────────────────┐    │
│  │ AgentBackend     │──▶│ acpx/runtime or @agentclient │    │
│  │ (spawn, session) │   │ protocol/sdk JSON-RPC loop   │    │
│  └──────────────────┘   └──────────────────────────────┘    │
│  ┌──────────────────┐   ┌──────────────────────────────┐    │
│  │ SkillRegistry    │   │ ToolRegistry                 │    │
│  │ (load SKILL.md)  │   │ (board actions + repo tools) │    │
│  └──────────────────┘   └──────────────────────────────┘    │
└───────────────────────┬─────────────────────────────────────┘
                        │ existing API
┌───────────────────────▼─────────────────────────────────────┐
│ App API: /api/board, /api/move, /api/refresh, /api/open, etc. │
└─────────────────────────────────────────────────────────────┘
```

## User-facing behavior

### Opening the sidepanel

- A button in the header opens/closes the right sidepanel.
- Default width: 320 px; min 240 px; max 50 % viewport.
- Keyboard shortcut: `Cmd/Ctrl + .` (or `a` when board has focus; TBD).

### Chatting with the agent

- User types in the composer and hits Enter.
- User message appears immediately on the right.
- Agent streams its response on the left, word-by-word.
- Composer is disabled while the agent is streaming.
- A "Stop" button cancels the current turn.

### Attaching context

- The user can attach:
  - The currently selected Issue key (from board selection or open issue).
  - The current board view (scope, filter, sort, hide) as a resource block.
  - A Skill from the skill dropdown.
- Attached context appears as chips above the composer.

### Agent actions and approval

When the agent wants to do something that mutates state, pipe-kan renders an inline permission card:

- **Read-only actions** (read repo file, inspect board state): auto-allowed by default (`--approve-reads`).
- **Mutating actions** (move card, refresh board, edit file, run command): show Allow once / Allow always / Reject.
- If rejected, the agent receives an error and continues or stops depending on the action.

### Skills

- A dropdown in the header or composer lets the user pick a Skill.
- Default bundled skills: `ask-matt`, `code-review`, `triage`, `research`.
- Selected skill's `SKILL.md` body is injected into the ACP prompt as a resource/system context block.
- The agent follows the skill's instructions; the skill does not execute code.

## Backend design

### AgentBackend interface

```ts
export type AgentBackend = {
  id: string;
  label: string;
  spawn(): Promise<AgentSession>;
};

export type AgentSession = {
  send(prompt: string, context: AgentContextBlock[]): Promise<void>;
  cancel(): void;
  events(): AsyncIterable<AgentEvent>;
  close(): Promise<void>;
};
```

### First implementation: acpx/runtime

Use `acpx/runtime` to:
- Load an agent registry from `~/.config/pipe-kan/agent.json`.
- Spawn `cursor-agent acp` (or user override).
- Start a named session scoped to the pipe-kan repo.
- Stream NDJSON ACP events through a `ReadableStream` we parse in Bun.

### Fallback: raw @agentclientprotocol/sdk

If `acpx/runtime` limits us (no Devin support, missing v2 features, permission model mismatch), we replace the wrapper with direct SDK usage without changing the React UI.

### ToolRegistry

Define a small set of pipe-kan-owned tools exposed to the agent as extension methods or prompt-instructed JSON function calls:

| Tool | Input | Effect | Approval |
|---|---|---|---|
| `board_state` | none | Returns current board JSON | auto |
| `issue_details` | `{ key }` | Returns issue fields from `app.open()` | auto |
| `move_card` | `{ key, status }` | Calls `app.move()` | explicit |
| `refresh_board` | `{ flags? }` | Calls `app.refresh()` | explicit |
| `apply_preset` | `{ name }` | Updates board chrome locally | explicit |
| `set_filter` | `{ filter }` | Updates board chrome locally | explicit |
| `run_skill` | `{ skillId, prompt }` | Loads skill body and returns as context | auto |
| `read_repo_file` | `{ path }` | Reads file under repo root | auto |

For v1, implement tools as prompt-instructed JSON function calls because ACP v1 does not have a stable tool-definition shape across agents. Parse the agent's response; if it emits a JSON code block matching a tool name, execute it and return the result as the next user/system message.

### SkillRegistry

```ts
export type Skill = {
  id: string;
  name: string;
  description: string;
  body: string;
};

export type SkillRegistry = {
  list(): Skill[];
  load(id: string): Skill | undefined;
};
```

Load from:
1. `.agents/skills/<id>/SKILL.md` (bundled).
2. `~/.pi/agent/skills/<id>/SKILL.md` (user override, if directory exists).

### Configuration file

`~/.config/pipe-kan/agent.json`:

```json
{
  "defaultAgent": "cursor",
  "defaultSkill": null,
  "agents": {
    "cursor": {
      "command": "cursor-agent",
      "args": ["acp"],
      "env": {}
    },
    "devin": {
      "command": "devin",
      "args": ["acp"],
      "env": {}
    }
  }
}
```

### Server API for the agent

New endpoints under `/api/agent/*`:

- `GET /api/agent/config` — active agent config, available agents, skills, current model/options.
- `POST /api/agent/session` — create or resume a session; returns `sessionId`.
- `POST /api/agent/prompt` — `{ sessionId, prompt, context: [...], skillId? }`.
- `POST /api/agent/cancel` — `{ sessionId }`.
- `GET /api/agent/events` — SSE or WebSocket stream of ACP events.
- `POST /api/agent/approve` — `{ requestId, decision: 'once' | 'always' | 'reject' }`.

## UI design

Reuse existing components:

- `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` for the sidepanel split.
- `Card` for agent message bubbles and tool cards.
- `Badge` for context chips and skill labels.
- `Button` for actions.
- `Input` / custom composer for the message input.
- `DropdownMenu` for agent and skill selectors.

New components (all in `src/components/agent/`):

- `AgentPanel` — the sidepanel shell.
- `AgentHeader` — agent selector, skill selector, close button.
- `AgentMessageList` — scrollable message stream.
- `AgentMessage` — user or agent bubble.
- `AgentToolCard` — pending/completed tool call.
- `AgentPermissionCard` — allow/reject bar.
- `AgentComposer` — input + attach buttons + suggested actions.
- `AgentContextChips` — attached issue / board / skill chips.

## Testing strategy

- **Fake ACP server**: a small Bun script that speaks enough ACP v1 JSON-RPC to initialize, accept a prompt, and return scripted agent message chunks and tool calls. Use it in unit tests for the backend.
- **Component tests**: render `AgentPanel` with fake messages, tool cards, and permission cards.
- **Integration test**: start the full server with the fake ACP agent, open the UI in a headless browser, send a message, and verify a response appears.
- **No real Cursor/Devin in CI** — tests use the fake agent; real agent compatibility is verified manually.

## Open questions to resolve during implementation

1. Which exact `acpx` runtime API do we use? (`createAgentRegistry`, `startTurn`, `AcpxRuntime`, etc.) Validate against installed version.
2. How do we map Cursor/Devin model options to a UI selector?
3. Do we implement tools via ACP extension methods or prompt-instructed JSON calls?
4. How do we cleanly cancel an in-flight prompt when the user closes the panel?
5. How do we handle the agent returning raw Markdown that references issue keys?

## Out of scope

- Multiple concurrent agent sessions.
- Agent-initiated conversations without user prompt.
- Voice or image input.
- Remote/cloud agent backends.
- Bundling Cursor/Devin binaries with pipe-kan.

## Success criteria

- A user can open the sidepanel, pick Cursor, and ask a question about the board.
- The agent can read the current board state and answer accurately.
- The user can attach a skill; the agent follows the skill's instructions.
- The agent can propose moving a card; the user approves; the card moves and the board refreshes.
- All agent-driven Jira mutations go through `jira-cli`.
- Tests pass without a real agent binary.
