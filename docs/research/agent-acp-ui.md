# ACP + Agent Sidepanel Research for pipe-kan

Cited research for adding a Linear-style agent sidepanel to pipe-kan that can drive ACP agents (Cursor today, Devin when available) and invoke local skills.

## Executive summary

- **ACP is JSON-RPC over stdio**. A client spawns an agent binary, negotiates `initialize`, creates a `session`, sends `session/prompt`, then consumes `session/update` notifications for streaming text, tool calls, plans, and permission requests. The turn ends when the agent returns a `stopReason`.
- **Cursor ACP is already shippable**. Cursor CLI exposes `agent acp` over stdio; auth is `cursor_login` (after `agent login`) or `--api-key` / `CURSOR_API_KEY`; modes are `agent`, `plan`, `ask`; permissions can be auto-granted or presented to the user; Cursor also sends extension methods (`cursor/ask_question`, `cursor/create_plan`, `cursor/update_todos`, `cursor/task`, `cursor/generate_image`) that a rich UI can render.
- **Devin ACP is available in Devin Desktop but not as a CLI we can bundle today**. Devin exposes ACP agents through the Agent Command Center; the registry points at a `devin acp` CLI command, but that CLI requires Devin Desktop / Devin Local access and is Pro/Max/Teams-only. For pipe-kan, treat Devin as a future backend behind the same ACP abstraction.
- **Linear's agent UI pattern** (`linear.app/agents`) is a persistent, context-aware sidepanel: a chat-style composer at the bottom, streaming message history, chips that show attached issues/projects/skills as context, suggested follow-up actions, and agent/tool-call cards. The visual language is the same as the rest of Linear (hairlines, 8–12 px radius, Inter, muted secondary text, indigo accent).
- **pipe-kan already owns the UI primitives** for a Linear-style shell (`docs/research/linear-ui.md`) and already uses `react-resizable-panels`. A sidepanel agent can reuse the same tokens, resizable panel, card, badge, and collapsible components.
- **Skills** in the mattpocock/skills sense are Markdown documents with structured instructions (e.g. `skills/engineering/ask-matt/SKILL.md`). They are not an API; the agent consumes them as context. For pipe-kan, "skill invocation" means selecting a skill file, injecting its `SKILL.md` into the ACP prompt or system context, and letting the agent decide what to do. There is no runtime `.pi/agent/skills/` directory in pipe-kan today.
- **TypeScript client choice**: The official `@agentclientprotocol/sdk` is the preferred Bun-compatible client; `acpx/runtime` is a useful shortcut but pre-1.0. There is no Coder TypeScript SDK today—Coder only ships `coder/acp-go-sdk`.
- **Reference implementation**: `riffado-cli` already builds a headless ACP client in Go (`internal/acpclient/`) and wires it into `generate` and `sync` as a pluggable backend. Its patterns—`Transport` interface, `Turn` struct, `LimitTransport`, one-shot stdio sessions, denied fs/terminal permissions, and config-driven `agents` + `prompts`—are directly portable to a TypeScript ACP client for pipe-kan.

## Sources

| Kind | URL |
| --- | --- |
| ACP v1 schema | https://agentclientprotocol.com/protocol/v1/schema |
| ACP prompt-turn lifecycle | https://agentclientprotocol.com/protocol/v1/prompt-turn |
| ACP v1 session config options | https://agentclientprotocol.com/protocol/v1/session-config-options |
| ACP v2 draft (future direction) | https://agentclientprotocol.com/announcements/acp-v2-draft |
| ACP clients / ecosystem | https://agentclientprotocol.com/get-started/clients |
| ACP registry spec | https://agentclientprotocol.com/get-started/registry |
| Cursor ACP docs | https://cursor.com/docs/cli/acp |
| Devin ACP docs | https://docs.devin.ai/desktop/acp |
| Devin ACP custom agents | https://docs.devin.ai/desktop/acp-custom |
| Devin CLI docs (registry points here) | https://docs.devin.ai/cli |
| Linear Agents marketing / UI pattern | https://linear.app/agents |
| Linear UI visual language (pipe-kan reference) | https://github.com/ivishalgandhi/pipe-kan/blob/main/docs/research/linear-ui.md |
| riffado-cli ACP client (`internal/acpclient/`) | https://github.com/ivishalgandhi/riffado-cli/tree/main/internal/acpclient |
| riffado-cli ACP ADR | https://github.com/ivishalgandhi/riffado-cli/blob/main/docs/adr/002-acp-generation-backend.md |
| riffado-cli `cmd/generate.go` ACP wiring | https://github.com/ivishalgandhi/riffado-cli/blob/main/cmd/generate.go |
| riffado-cli `cmd/sync.go` ACP wiring | https://github.com/ivishalgandhi/riffado-cli/blob/main/cmd/sync.go |
| coder/acp-go-sdk | https://github.com/coder/acp-go-sdk |
| mattpocock/skills repo | https://github.com/mattpocock/skills |
| mattpocock skills README / install | https://github.com/mattpocock/skills/blob/main/README.md |
| ask-matt skill example | https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md |
| shadcn/ui Resizable | https://ui.shadcn.com/docs/components/resizable |
| react-resizable-panels | https://github.com/bvaughn/react-resizable-panels |
| Official ACP TypeScript SDK | https://github.com/agentclientprotocol/typescript-sdk |
| `@agentclientprotocol/sdk` npm | https://www.npmjs.com/package/@agentclientprotocol/sdk |
| acpx headless ACP CLI / runtime | https://github.com/openclaw/acpx |
| `acpx` npm | https://www.npmjs.com/package/acpx |
| acpx agents registry docs | https://github.com/openclaw/acpx/blob/main/docs/agents.md |
| acpx Cursor adapter notes | https://github.com/openclaw/acpx/blob/main/agents/Cursor.md |
| acpx Devin compatibility shim | https://github.com/openclaw/acpx/blob/main/agents/Devin.md |
| acpx custom agents docs | https://github.com/openclaw/acpx/blob/main/docs/custom-agents.md |
| coding-agent-runner | https://github.com/yinguangyao/coding-agent-runner |
| `coding-agent-runner` npm | https://www.npmjs.com/package/coding-agent-runner |
| coding-agent-runner adapters / cursor spawn | https://github.com/yinguangyao/coding-agent-runner/blob/main/src/adapters.ts |
| mosoo-agent-driver (Bun runtime bridge) | https://github.com/langgenius/mosoo-agent-driver |
| `@mosoo/agent-driver` npm | https://www.npmjs.com/package/@mosoo/agent-driver |
| antigravity-acp (Bun ACP server example) | https://github.com/shubzkothekar/antigravity-acp |

## 1. ACP protocol overview

### 1.1 What ACP is

The Agent Client Protocol (ACP) is "an open protocol that standardizes communication between code editors and coding agents — similar to how the Language Server Protocol (LSP) standardized language server integration" [Devin docs](https://docs.devin.ai/desktop/acp). The official schema is published at [agentclientprotocol.com](https://agentclientprotocol.com/protocol/v1/schema).

It is **not** an LLM API. It is a framing layer between a *client* (the application that owns the UI) and an *agent* (the process that owns model access, tool definitions, and execution). The client does not pick the model or call tools; it spawns the agent, sends user prompts, and renders what the agent streams back.

### 1.2 Transport

ACP v1 uses **stdio** as the canonical transport:

- Client writes JSON-RPC requests/notifications to the agent's `stdin`.
- Agent writes JSON-RPC responses/notifications to its `stdout`.
- Logs go to `stderr`.
- Framing is newline-delimited JSON, one message per line [Cursor ACP docs](https://cursor.com/docs/cli/acp).

v2 adds streamable HTTP/SSE, but v1 stdio is what Cursor and the current Devin registry examples use.

### 1.3 Message shape

Every message is JSON-RPC 2.0. The core lifecycle methods are:

| Method | Direction | Purpose |
| --- | --- | --- |
| `initialize` | Client → Agent | Negotiate protocol version, capabilities, agent info |
| `authenticate` | Client → Agent | Pick one of the advertised `authMethods` |
| `session/new` | Client → Agent | Create a session with `cwd` and optional `mcpServers` |
| `session/load` | Client → Agent | Resume an existing session |
| `session/prompt` | Client → Agent | Send a user message |
| `session/update` | Agent → Client | Streaming notification: text chunk, plan, tool call, usage |
| `session/request_permission` | Agent → Client | Ask user to allow/reject a tool invocation |
| `session/cancel` | Client → Agent | Abort the current turn |

The `initialize` request advertises `clientCapabilities` (fs, terminal, auth) and receives `agentCapabilities`, `agentInfo`, and `authMethods` [ACP schema](https://agentclientprotocol.com/protocol/v1/schema).

### 1.4 Permission model

Permissions are per-tool-call requests. The agent sends `session/request_permission`; the client replies with one of:

- `allow-once`
- `allow-always`
- `reject-once` / `cancelled`

If the client never answers, tool execution can block [Cursor ACP docs](https://cursor.com/docs/cli/acp). For a coding assistant inside a Jira sidepanel, the safest posture is **deny-by-default with explicit allow/always/reject buttons**, matching Linear's deliberate interaction style.

### 1.5 One-shot vs. session

A **one-shot** ACP turn creates a session, sends one prompt, waits for the stop reason, and tears down the process. This is what `riffado-cli` does for title/summary generation: `StdioTransport.Run` spawns the agent into a temp cwd, initializes, creates a session, prompts once, kills the process [riffado-cli `internal/acpclient/stdio.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/acpclient/stdio.go).

A **session-based** turn keeps the process alive across multiple prompts so the agent retains context. A Linear-style sidepanel needs sessions: the user can ask follow-up questions, reference previously attached issues, and see a persistent history.

### 1.6 Capabilities / tooling

ACP does not define the tool set. The agent advertises what it can do (through extension methods and tool calls), and the client decides what to surface. Common client capabilities:

- `fs.readTextFile` / `fs.writeTextFile`
- `terminal`
- `auth.terminal`
- `session.configOptions.boolean` (v1) / full config options (v2)

For pipe-kan, the most relevant capability is **read-only file access to the repo** so the agent can inspect code, plus the ability to deny write/terminal access until the user explicitly allows it.

### 1.7 v2 direction

ACP v2 (draft, July 2026) moves beyond the strict turn model: `session/update` notifications can arrive at any time, messages patch by stable IDs, tool calls stream, and permissions become more flexible [ACP v2 draft](https://agentclientprotocol.com/announcements/acp-v2-draft). Pipe-kan should implement v1 first but design the state machine so v2 updates can be added later without replacing the UI layer.

## 2. Cursor ACP

### 2.1 Command / spawn

Cursor CLI exposes:

```bash
agent acp
```

The client spawns it as a child process and talks stdio. Pre-authenticate with:

```bash
agent login
# or
agent --api-key "$CURSOR_API_KEY" acp
agent --auth-token "$CURSOR_AUTH_TOKEN" acp
```

[Cursor ACP docs](https://cursor.com/docs/cli/acp).

### 2.2 Modes

Cursor ACP supports the same modes as the CLI:

- `agent` — full tool access
- `plan` — read-only planning
- `ask` — Q&A / read-only

These are exposed as session config options or the older `modes` field. The riffado-cli client searches session modes for an "ask" mode and selects it for headless summaries [riffado-cli `internal/acpclient/stdio.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/acpclient/stdio.go).

### 2.3 Auth

The advertised auth method is `cursor_login`. In practice you can also pass `--api-key` or `CURSOR_API_KEY` at spawn time, which is the easiest integration path for a non-interactive client [Cursor ACP docs](https://cursor.com/docs/cli/acp).

### 2.4 Extension methods

Cursor sends proprietary extension methods that a rich sidepanel should render:

| Method | Type | Use |
| --- | --- | --- |
| `cursor/ask_question` | Blocking | Multiple-choice questions |
| `cursor/create_plan` | Blocking | Plan approval with todos/phases |
| `cursor/update_todos` | Notification | Todo list updates |
| `cursor/task` | Notification | Subagent task completion |
| `cursor/generate_image` | Notification | Generated image output |

These are not part of the base ACP spec, but they are stable Cursor surface. A sidepanel can treat unknown blocking extension methods as "request user input" and unknown notifications as "display as an event card."

### 2.5 MCP servers

Cursor ACP can load MCP servers from `.cursor/mcp.json`. Team-level MCP servers configured through the Cursor dashboard are **not** supported in ACP mode [Cursor ACP docs](https://cursor.com/docs/cli/acp). For pipe-kan, this means any Jira-specific tooling should be exposed through pipe-kan itself (as file context or custom tools), not through Cursor MCP.

## 3. Devin ACP

### 3.1 Availability

Devin Desktop supports ACP agents in the Agent Command Center for Pro, Max, and Teams users. Enterprise admins must contact their account team [Devin ACP docs](https://docs.devin.ai/desktop/acp). It is **not** a freely downloadable CLI that pipe-kan can bundle today.

### 3.2 How Devin exposes ACP

Devin Desktop reads an ACP registry file:

- `~/.windsurf/acp/registry.json`
- `~/.windsurf-next/acp/registry.json`

Each entry follows the [ACP registry spec](https://agentclientprotocol.com/get-started/registry). The registry points at a binary per platform. For Devin Local, the sample registry uses:

```json
{
  "agents": [{
    "id": "devin-cli",
    "name": "Devin Local",
    "distribution": {
      "binary": {
        "darwin-aarch64": { "cmd": "devin", "args": ["acp"] }
      }
    }
  }]
}
```

[Devin ACP docs](https://docs.devin.ai/desktop/acp). Devin Desktop does **not** download the binary from the registry; the binary must already be installed [Devin ACP docs](https://docs.devin.ai/desktop/acp).

### 3.3 Model access

Devin owns the model access and commands. The client does not select the model directly; it selects the agent from Devin's selector. Browser previews and restricted-mode caveats apply [Devin ACP docs](https://docs.devin.ai/desktop/acp).

### 3.4 Implications for pipe-kan

- **Today**: target Cursor ACP because it is a CLI pipe-kan can spawn itself.
- **Later**: hide Devin behind the same `AgentBackend` interface. When Devin CLI is available, pipe-kan reads the registry config (or a user-provided spawn command) and runs `devin acp` the same way it runs `agent acp`.

## 4. Linear's agent UI pattern

### 4.1 What `linear.app/agents` shows

Linear's Agents page and in-app sidepanel marketing show a persistent chat-like panel with these repeating elements (observed from https://linear.app/agents):

- **Composer** at the bottom: a single-line input with placeholder "Reply…", plus chips for attached context (issue keys, projects, skills).
- **Message history**: alternating user and agent messages. Agent messages use the Linear wordmark/avatar and can contain formatted text, lists, and inline issue references.
- **Context chips**: small pills such as "Mobile Triage added to context", "ENG-2844 added to context", "Skills" with a caret, showing that the agent has picked up context from the workspace.
- **Suggested actions**: after an agent response, the composer area may show one-tap follow-up prompts (e.g., "What could delay the API launch?").
- **Tool/agent cards**: third-party agents (Cursor, ChatPRD, custom) appear as named rows with avatars in a selector or as message authors.

### 4.2 Visual language to reuse

pipe-kan already documented Linear's visual language in `docs/research/linear-ui.md`. The sidepanel should reuse:

- **Layout**: resizable right-side panel, hairline left border, ~320 px default width, 8 px gutter logic.
- **Surfaces**: dark `sidebar #09090a`, `surface #121213`, `border #212224`; light `sidebar #efeff0`, `surface #f9f9fa`, `border #e2e2e2`.
- **Radius**: 8 px for rows/cards, 12 px for the main pane, 9999 px for pills.
- **Type**: Inter Variable, body 13 px / 450, UI medium 500, titles 550.
- **Accent**: `#7180ff` focus/selection, `#5e6ad2` brand fill.
- **Row hover**: `#ffffff08` inset wash, 8 px radius.

### 4.3 Interaction model

- The sidepanel is **always available** but not always visible; a keyboard shortcut or header button toggles it.
- User messages appear on the right; agent messages on the left, with the agent avatar + name.
- Streaming text fills in character-by-character via `session/update` `agent_message_chunk`.
- Tool calls render as compact cards with status: pending → in_progress → completed/cancelled.
- Permission requests interrupt the stream with an inline allow/always/reject bar.
- Suggested actions appear as chips above the composer after a response completes.

## 5. UI component choices for pipe-kan

### 5.1 Existing stack

pipe-kan already uses:

- React 19, Tailwind CSS 4, Radix primitives (`Collapsible`, `DropdownMenu`, `Slot`)
- `class-variance-authority`, `tailwind-merge`, `lucide-react`
- `react-resizable-panels` for split layouts
- Custom `components/ui/{resizable,button,card,badge,input,collapsible,dropdown-menu,kanban,avatar}`

[pipe-kan `package.json`](https://github.com/ivishalgandhi/pipe-kan/blob/main/package.json).

### 5.2 Recommended components

| UI need | Existing / recommended | Notes |
| --- | --- | --- |
| Resizable sidepanel | `components/ui/resizable.tsx` (react-resizable-panels) | Already present; use for right panel [shadcn Resizable](https://ui.shadcn.com/docs/components/resizable) |
| Agent message card | Extend `Card` | 9 px radius, hairline, no shadow, per `linear-ui.md` §5.2 |
| Composer input | Extend `Input` | 28–32 px muted pill style, not a large outlined field |
| Suggested actions | Pill buttons | 24–28 px height, hairline, rounded-full |
| Tool call cards | Custom `AgentToolCall` | Show title, status dot, expand for details |
| Permission bar | Inline `Alert` | Allow once / allow always / reject |
| Avatar | `Avatar` + agent icon | Linear uses 16–20 px avatars for agent identity |
| Context chips | `Badge` | Issue keys, projects, skills as small pills |
| Scrollbar | App-style 12 px or hidden | Match `linear-ui.md` §6.4 |
| Empty state | Centered muted text | No invented illustration |

### 5.3 Headless libraries beyond shadcn

- **shadcn/ui** is the base. Most needed primitives are already installed.
- **react-resizable-panels** is already a dependency; use it for the sidepanel split.
- For chat-specific primitives (streaming markdown, code blocks, diff rendering), consider small focused libraries only when the built-in components cannot keep up; default to plain React + Tailwind to avoid dependency bloat.

## 6. TypeScript/Bun ACP client options

Pipe-kan is a **Bun + React** application, so the ACP client must run in a Node/Bun-compatible runtime and be callable from the React UI (via the Bun dev server or an Electron/main-process bridge). This section compares the available TypeScript/JavaScript ACP libraries and example repos, then narrows the choice for pipe-kan's stack.

### 6.1 Official TypeScript SDK

The ACP project publishes **`@agentclientprotocol/sdk`** (`npm:@agentclientprotocol/sdk`, v1.4.0) — the official TypeScript implementation of ACP v1 and the experimental v2 draft.

- Repo: https://github.com/agentclientprotocol/typescript-sdk
- npm: https://www.npmjs.com/package/@agentclientprotocol/sdk
- License: Apache-2.0

API surface (from the published package and `src/examples/client.ts`):

- `acp.ndJsonStream(input, output)` turns stdio byte streams into a typed ACP `Stream`.
- `acp.client({ name })` builds a client app; chain `.onRequest(method, handler)` and `.connectWith(stream, async ctx => { ... })`.
- `ctx.request(acp.methods.agent.initialize, { protocolVersion, clientCapabilities })` negotiates the connection.
- `ctx.buildSession(cwd).withSession(async session => { session.prompt(...); ... })` creates and drives a session.
- Handlers for `acp.methods.client.session.requestPermission`, `acp.methods.client.fs.readTextFile`, etc., let the client render permission/file UI.
- Session update notifications arrive on `session.nextUpdate()` and cover `agent_message_chunk`, `tool_call`, `tool_call_update`, `plan`, `usage_update`, and stop reasons.

The SDK is runtime-agnostic at the stream level; the examples use `node:child_process` + Web `ReadableStream`/`WritableStream` adapters. Bun implements the same web streams and `Bun.spawn`/`child_process`, so it plugs in directly.

### 6.2 acpx — headless CLI + embeddable runtime

**`acpx`** (`npm:acpx`, v0.13.2) is a headless ACP CLI built on top of `@agentclientprotocol/sdk`. It is useful both as a command-line harness and as a library for apps that do not want to speak raw JSON-RPC.

- Repo: https://github.com/openclaw/acpx
- npm: https://www.npmjs.com/package/acpx
- License: MIT

What it offers pipe-kan:

- Built-in launch profiles for Cursor, Claude Code, Codex, Gemini, OpenCode, Pi, Devin (via `--agent 'devin acp'`), and ~20 other agents [acpx `docs/agents.md`](https://github.com/openclaw/acpx/blob/main/docs/agents.md).
- Cursor default: `cursor-agent acp` (override to `agent acp` if that is what the local Cursor CLI exposes) [acpx `agents/Cursor.md`](https://github.com/openclaw/acpx/blob/main/agents/Cursor.md).
- Devin compatibility shim: advertises a Windsurf identity when launching `devin acp` and handles Devin vendor extensions [acpx `agents/Devin.md`](https://github.com/openclaw/acpx/blob/main/agents/Devin.md).
- Programmatic API via `acpx/runtime` (`createAgentRegistry`, `AcpxRuntime`, `startTurn`, `runTurn`, async event iterators) and `acpx/flows` for multi-step workflows [acpx `src/runtime.ts`](https://github.com/openclaw/acpx/blob/main/src/runtime.ts).
- Session state lives under `~/.acpx/`; supports named sessions, resume, cancellation, and JSON/NDJSON output.
- Custom agents via `~/.acpx/config.json` or raw `--agent '<command>'` [acpx `docs/custom-agents.md`](https://github.com/openclaw/acpx/blob/main/docs/custom-agents.md).

For pipe-kan, `acpx/runtime` is the fastest way to get a session-based Cursor/Devin backend without writing the JSON-RPC loop by hand. The trade-off is coupling to a pre-1.0 package and a Node 22.13+ engine requirement.

### 6.3 coding-agent-runner — normalized multi-provider SDK

**`coding-agent-runner`** (`npm:coding-agent-runner`) is a smaller, provider-oriented wrapper for local coding-agent CLIs. It supports Codex, Claude Code, Cursor, OpenCode, and Pi.

- Repo: https://github.com/yinguangyao/coding-agent-runner
- npm: https://www.npmjs.com/package/coding-agent-runner
- License: MIT

Key API:

- `runCliAgent({ provider: 'cursor-cli', cwd, prompt, skills, mcpServers })` — one-shot, returns final output.
- `streamCliAgent(...)` — async iterable of normalized events (`message_delta`, `tool_start`, `tool_end`, `result`).
- `createCodingAgentRunner({ provider: 'cursor-cli', cwd })` — keeps a session alive across multiple `runner.stream({ prompt })` calls.
- `detectCliAgents()` — scans `PATH` for installed CLIs.

Cursor adapter in `src/adapters.ts` spawns `cursor-agent acp` in ACP mode. The package normalizes the disparate native transports (Codex app-server, Claude native JSON-RPC, ACP) into one event shape, which is attractive if pipe-kan later wants to support non-ACP agents. The project is newer and lower-starred than `acpx`, so treat it as a useful reference rather than the primary dependency.

### 6.4 Other TypeScript/Bun examples

| Repo | Package / tech | Why it matters |
| --- | --- | --- |
| [langgenius/mosoo-agent-driver](https://github.com/langgenius/mosoo-agent-driver) | `@mosoo/agent-driver` (Bun) | Production-grade runtime-neutral driver with an ACP-fallback backend; good reference for permission brokers and sandbox boot contracts |
| [shubzkothekar/antigravity-acp](https://github.com/shubzkothekar/antigravity-acp) | Bun ACP server for `agy` CLI | Small example of building an ACP server on Bun |
| [yinguangyao/coding-agent-runner](https://github.com/yinguangyao/coding-agent-runner) | `coding-agent-runner` | Normalized multi-provider runner (see §6.3) |
| [agentclientprotocol/typescript-sdk examples](https://github.com/agentclientprotocol/typescript-sdk/tree/main/src/examples) | `@agentclientprotocol/sdk` | Official client/agent/http/ws examples |

### 6.5 Coder TypeScript SDK

Coder publishes **`coder/acp-go-sdk`** — a Go SDK, not a TypeScript one.

- Repo: https://github.com/coder/acp-go-sdk
- There is no `coder/acp-ts-sdk` repository today.

For a TypeScript/Bun stack, the relevant Coder-adjacent option is `mux` (Coder's agent), which `acpx` exposes as a built-in via `mux acp` [acpx `docs/agents.md`](https://github.com/openclaw/acpx/blob/main/docs/agents.md). `mux` is a separate product; it is not required for pipe-kan to consume Cursor ACP.

### 6.6 ACP vs MCP for pipe-kan actions

Two protocols are often compared for giving an LLM tools:

- **ACP** is a *client-to-agent* protocol. The client (pipe-kan) spawns an agent (Cursor/Devin) that already has its own model, tools, and sandbox. The agent asks the client for permission to use tools it owns (fs, terminal). Pipe-kan does not define tools; it defines what capabilities the agent is allowed to use.
- **MCP** is a *host-to-server* tool protocol. The host advertises a list of named tools with JSON schemas, and the LLM calls them through the host. It is ideal for exposing a small, well-known set of local tools (e.g., `jira-cli` wrappers, board actions) to any model that speaks MCP.

For pipe-kan's sidepanel, the two are complementary, not competing:

1. Use **ACP** as the transport to the coding agent (Cursor today, Devin later). This gives the agent its own reasoning, multi-file editing, and terminal/file access under pipe-kan's permission UI.
2. Use **MCP** only if we want to expose pipe-kan-owned actions (move a Jira issue, create a ticket, run `jira-cli`) to the agent as explicit tools. The agent can request an MCP server at `session/new` via `mcpServers` (Cursor ACP already supports `.cursor/mcp.json`, and `acpx`/`coding-agent-runner` pass stdio MCP servers). This keeps Jira write-back inside the existing `jira-cli` rule instead of giving the agent raw Jira API access.
3. Avoid inventing a custom JSON-RPC tool protocol unless ACP and MCP together cannot express a required interaction. A custom protocol adds integration cost for every agent backend.

### 6.7 Linear-style skill attachment pattern

`linear.app/agents` (observed 2026-09-05) exposes skills and context through the composer, not a separate settings panel:

- **Skills button**: a chip labeled "Skills" with a caret sits in the composer area; clicking it opens a dropdown/panel of available skills (e.g., triage, planning, PR review).
- **Context chips**: above messages, small pills announce context that has been attached — "Mobile Triage added to context", "API launch added to context", "Notification Grouping added to context".
- **Suggested actions**: after the agent responds, the composer area shows one-tap follow-ups like "What could delay the API launch?".
- **Agent identity**: each agent message is authored by "Linear" with the Linear avatar; third-party agents (Cursor, Devin, etc.) would appear as named authors with their own avatars.

For pipe-kan, this maps to:

- A "Skills" button in the composer that opens a popover listing bundled/local `SKILL.md` files.
- Selected skills rendered as removable `Badge` chips in the composer.
- Attached Jira issues rendered as chips (e.g., "PIPE-123 added to context").
- Suggested follow-up chips surfaced after a completed turn.

### 6.8 Recommended client library for pipe-kan

Given pipe-kan's Bun runtime and the goal of shipping Cursor ACP quickly:

1. **Primary library: `@agentclientprotocol/sdk`**. Use it directly in a Bun `child_process`/`Bun.spawn` stdio client. This avoids an intermediate abstraction, gives full control over session lifecycle/permissions, and is the official SDK.
2. **Shortcut option: `acpx/runtime`**. If we want to stand up Cursor + Devin sessions in days rather than weeks, wrap `acpx/runtime` and let it handle the JSON-RPC loop, session store, and agent registry. The cost is coupling to a pre-1.0 package and a Node 22+ engine constraint.
3. **Reference only: `coding-agent-runner`**, `mosoo-agent-driver`. Study them for normalized event shapes, permission brokers, and Bun packaging, but do not take a dependency yet.

The rest of this doc is updated assuming option 1 (direct SDK) as the default, with option 2 noted where it can accelerate delivery.

## 7. Skill invocation architecture

### 7.1 What "skills" are in this repo

pipe-kan does not currently contain a `.pi/agent/skills/` directory. The closest thing is `AGENTS.md` and `docs/agents/*.md`, which tell engineering agents how to consume the repo's domain docs and issue tracker [pipe-kan `AGENTS.md`](https://github.com/ivishalgandhi/pipe-kan/blob/main/AGENTS.md).

The mattpocock/skills format is a repo of Markdown files, each with a front-matter block and a `SKILL.md` body. For example, `ask-matt` is a router skill that tells the agent which other skill to use [ask-matt SKILL.md](https://github.com/mattpocock/skills/blob/main/skills/engineering/ask-matt/SKILL.md). They are installed via `npx skills add mattpocock/skills` or the Claude Code plugin [mattpocock skills README](https://github.com/mattpocock/skills/blob/main/README.md).

### 7.2 How an ACP agent would "invoke" a skill

There is no runtime API call. A skill invocation means:

1. The user picks a skill from a dropdown in the sidepanel (e.g., `/ask-matt`, `/triage`, `/code-review`).
2. pipe-kan reads the corresponding `SKILL.md` file from a configured skills directory (e.g., `.agents/skills/<skill>/SKILL.md`, `~/.pi/agent/skills/<skill>/SKILL.md`, or a `mattpocock/skills` clone).
3. pipe-kan injects the skill body into the ACP prompt context as a system/resource message.
4. The agent follows the instructions in the skill, producing plans, questions, code changes, or issue tracker actions.
5. The sidepanel renders the agent's outputs (text, tool calls, plans, questions) and lets the user approve write/terminal operations.

### 7.3 Interface needed

A minimal skill runner in pipe-kan needs:

- `Skill` type: `{ id, name, description, path, body: string }`
- `SkillRegistry`: load from a configurable directory; fall back to bundled defaults.
- `AgentBackend` interface: `{ spawn(): AgentSession; sendPrompt(prompt, contextBlocks): void; cancel(): void; ... }`
- `AgentSession` event stream: `agent_message_chunk`, `tool_call`, `request_permission`, `plan`, `usage_update`, `stop_reason`.
- `PromptBuilder`: combine user text + attached Jira context (issue keys, summaries, status) + selected skill body into ACP `ContentBlock[]`.

### 7.4 Context and permissions

The agent needs read access to:

- The current pipe-kan repo files (via `fs.readTextFile`, if enabled).
- The selected issue(s) from the Board (pipe-kan can pass these as text resources in the prompt).

It should **not** get write access or terminal access by default. The sidepanel must ask the user per action. This matches both ACP's permission model and Linear's deliberate UX.

### 7.5 No `.pi/agent/skills/` today

Because pipe-kan has no skills directory yet, the first step is not to invent a new format but to adopt the mattpocock convention: a directory of `SKILL.md` files. The sidepanel can ship with a small bundled set (`ask-matt`, `code-review`, `triage`, `research`) and allow users to point at additional directories in settings.

## 8. Reference patterns from riffado-cli

riffado-cli treats ACP as a pluggable **generation backend**, not a separate command. Relevant patterns:

### 8.1 Transport abstraction

```go
type Transport interface {
    Run(ctx context.Context, turn Turn) (assistantText string, err error)
}

type Turn struct {
    Command []string
    Env     map[string]string
    Prompt  string
}
```

[riffado-cli `internal/acpclient/transport.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/acpclient/transport.go).

For pipe-kan, the equivalent is an `AgentBackend` interface with session support rather than one-shot only.

### 8.2 Stdio implementation

`StdioTransport.Run`:

1. Creates a temp cwd with no MCP servers.
2. Spawns the agent command.
3. Initializes with `fs.readTextFile=false`, `fs.writeTextFile=false`, `terminal=false`.
4. Authenticates if needed, picking a non-interactive method.
5. Creates a session, optionally sets an `ask` mode.
6. Sends `session/prompt` and collects `agent_message_chunk` into a string.
7. Returns the final text or errors if none.

[riffado-cli `internal/acpclient/stdio.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/acpclient/stdio.go).

Pipe-kan should keep the same **deny-by-default** capability posture for untrusted agents and only opt into fs/terminal when the user allows.

### 8.3 Concurrency limit

`LimitTransport` wraps a transport in a semaphore so ACP turns share a single worker cap, independent of HTTP workers. The default cap is 1 [riffado-cli `internal/acpclient/limit.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/acpclient/limit.go). A sidepanel needs a different concurrency model (one session per user, not batched workers), but the idea of capping agent resource usage is still relevant.

### 8.4 Config-driven agents and prompts

riffado-cli uses a `generate.toml` with:

```toml
default = "cursor"
fallback = "devin"
acp_workers = 1
[[agents]]
name = "cursor"
command = ["agent", "acp"]
env = { FOO = "bar" }
[[prompts]]
name = "summary"
body = "Summarize...\n{{transcript}}"
```

[riffado-cli `internal/config/generate.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/config/generate.go).

Pipe-kan can adopt the same shape under a different filename (e.g., `~/.config/pipe-kan/agent.toml`) so users can name agents, set spawn commands, and pick active prompts/skills.

### 8.5 Backend selection / fallback

`GeneratorFor` decides whether to use the Riffado HTTP backend or an ACP backend based on `generate.toml`. It only falls back to ACP on an explicit `api.ErrQuotaExhausted` signal, not on generic errors [riffado-cli `internal/server/generate.go`](https://github.com/ivishalgandhi/riffado-cli/blob/main/internal/server/generate.go).

For pipe-kan, the equivalent is: the user chooses a default agent; if that agent fails because it is not installed, pipe-kan can warn rather than silently falling back, preserving user control.

## 9. Concrete recommendations for pipe-kan

### 9.1 Start with Cursor ACP only

Implement a single agent backend that spawns `agent acp` (or the user-configured Cursor binary). Do not build Devin-specific code paths yet; keep the abstraction ready so Devin drops in later as another `AgentBackend`.

### 9.2 Build a session-based ACP client in TypeScript/Bun

- **Primary path**: depend on `@agentclientprotocol/sdk` and wire it to `Bun.spawn` (or `node:child_process`) stdio streams. The SDK's `acp.ndJsonStream` + `acp.client(...).connectWith(...)` handles the JSON-RPC lifecycle, request/response routing, and session helpers [SDK `src/examples/client.ts`](https://github.com/agentclientprotocol/typescript-sdk/blob/main/src/examples/client.ts).
- Spawn the configured agent binary (default `agent acp`; if Cursor ships `cursor-agent acp`, use that).
- Keep an `AbortSignal` for the stdio process and call `session.cancel()` / process kill on panel close.
- Expose typed events to React: `agent_message_chunk`, `tool_call`, `tool_call_update`, `request_permission`, `plan`, `usage_update`, `config_option_update`, `stop_reason`, `error`.
- **Shortcut path**: if the team wants Cursor/Devin sessions faster, embed `acpx/runtime` (`AcpxRuntime`, `startTurn`, `runTurn`). It already manages the JSON-RPC loop, session store, and agent registry. Treat this as a temporary accelerator with a clear migration plan to the direct SDK once the API stabilizes.

### 9.3 Sidepanel layout

- Right-side resizable panel, default ~320 px, min ~240 px, max ~50 % of viewport.
- Header: agent selector (Cursor / later Devin / custom), mode/model selector from `configOptions`, close button.
- Message area: scrollable, bottom-aligned, with user messages right and agent messages left.
- Composer: bottom-fixed pill input with attach-context button (selected issue, project, skill) and send.
- Suggested actions: chips above the composer after a response.
- Tool/permission cards: inline in the message stream.

### 9.4 Capability posture

- Initialize with `fs` and `terminal` disabled.
- When the agent requests permission, show allow-once / allow-always / reject inline.
- If the user allows file read, expose a small virtual file system that only serves files inside the repo and respects `.gitignore`.
- Never grant terminal or write access without explicit per-action approval in the UI.

### 9.5 Skills integration

- Ship a local skills directory. The mattpocock convention uses `<category>/<skill>/SKILL.md`; `acpx` itself stores skills under `.agents/skills/` [acpx repo](https://github.com/openclaw/acpx). For pipe-kan, support two locations:
  - Bundled defaults: `.agents/skills/` or `docs/skills/` inside the repo.
  - User overrides: `~/.pi/agent/skills/` (Claude Code / mattpocock style) so users can drop in skills from `npx skills add`.
- The skill popover reads each `SKILL.md`, shows `name` + `description` from front matter, and injects the body as a resource/system block in the ACP prompt.
- Start with: `/ask-matt` (router), `/code-review` (review current change), `/research` (background investigation), `/triage` (incoming issue triage).

### 9.6 Context from pipe-kan

When the user attaches an issue to the chat, pipe-kan sends an ACP `resource` content block:

```json
{
  "type": "resource",
  "resource": {
    "uri": "jira://PIPE-123",
    "mimeType": "application/json",
    "text": "{ \"key\": \"PIPE-123\", \"summary\": \"...\", \"status\": \"...\" }"
  }
}
```

This mirrors how ACP passes file resources and gives the agent structured context without needing Jira API access.

### 9.7 Configuration file

Introduce `~/.config/pipe-kan/agent.json` (or `agent.toml`) so the TypeScript/Bun server can read it without a TOML parser dependency:

```json
{
  "defaultAgent": "cursor",
  "activePrompt": "default",
  "skillsDir": "~/.pi/agent/skills",
  "agents": [
    { "name": "cursor", "command": ["agent", "acp"], "env": { "CURSOR_API_KEY": "..." } },
    { "name": "devin", "command": ["devin", "acp"] }
  ],
  "prompts": [
    { "name": "default", "body": "You are helping inside pipe-kan, a local Kanban view for Jira..." }
  ],
  "skills": [
    { "name": "ask-matt", "path": ".agents/skills/engineering/ask-matt/SKILL.md" }
  ]
}
```

This mirrors riffado-cli's `GenerateConfig` shape but uses JSON for easy parsing in Bun. Keep the same concepts: named agents, spawn commands, env overrides, prompts, and skill paths.

### 9.8 Use ACP for the agent, MCP only for pipe-kan-owned board actions

- Use **ACP** as the main sidepanel transport to Cursor/Devin. Do not try to replace the agent's own model/tool loop.
- If the agent needs to move a Jira issue or create a ticket, expose those actions through a small **MCP server** owned by pipe-kan (e.g., `move_issue`, `create_issue`, `run_jira_cli`). Pass the stdio MCP server in `session/new` `mcpServers` when the agent supports it. This keeps the `jira-cli` rule intact without giving the agent raw Jira API credentials.
- Avoid a custom JSON-RPC tool protocol; ACP + MCP already cover both layers.

### 9.9 Bun / Node runtime notes

- Bun is the primary runtime for `pipe-kan dev` and `pipe-kan start`; use `Bun.spawn` for stdio. The `@agentclientprotocol/sdk` works because Bun supports Web Streams and `node:child_process`.
- If a dependency (e.g., `acpx/runtime`) requires Node 22.13+, document that clearly or pin Bun to a compatible Node ABI.
- Keep the agent client in a server-side module so credentials and stdio processes never run in the browser bundle.

### 9.10 Error handling

- If the configured agent binary is missing, show a setup hint (e.g., "Install Cursor CLI and run `agent login`").
- If the agent returns an error, render it as a red system message with a retry button.
- If a permission is rejected, the agent's turn continues; do not crash the session.

## 10. Open questions and risks

### 10.1 Devin availability

- **Risk**: Devin CLI is not publicly installable today; it requires Devin Desktop / Devin Local and a paid plan.
- **Question**: Do we gate Devin support behind a "Devin detected" check, or do we expose a generic registry loader and let users supply the binary path?

### 10.2 Cursor extension methods

- **Risk**: Cursor's `cursor/*` extension methods are undocumented outside the Cursor docs and may change.
- **Question**: Should we implement first-class rendering for `cursor/create_plan` and `cursor/ask_question`, or treat all blocking extensions generically as "the agent needs input" forms?

### 10.3 Permission granularity

- **Risk**: ACP v1 permissions are per tool call with only allow-once / allow-always / reject. There is no concept of "allow for this session" or "allow only reads under this path."
- **Question**: Do we build our own policy layer on top (e.g., "always allow readFile under repo root"), and if so, how do we keep it from diverging from the agent's actual permission request?

### 10.4 Skills format

- **Risk**: There is no single standard skill format beyond the mattpocock convention.
- **Question**: Do we adopt `SKILL.md` front matter (`name`, `description`, `disable-model-invocation`) as the only format, or do we also support Claude Code's plugin manifest format?

### 10.5 State management

- **Risk**: A session can live for a long time. Browser refreshes, Electron reloads, or pipe-kan restarts will kill the stdio process and lose context.
- **Question**: Do we persist message history locally so the UI can restore, even if the agent session cannot be resumed? v2 makes session resumption more explicit, but v1 agents may not support `session/load` reliably.

### 10.6 Model selection

- **Risk**: ACP agents expose models through `configOptions`, but each agent names them differently.
- **Question**: Do we render the agent's `configOptions` faithfully in the header, or do we normalize to a small set (Fast / Balanced / Powerful)?

### 10.7 Testing

- **Risk**: ACP integration is hard to test in CI because it requires a real agent binary and credentials.
- **Question**: Do we build a fake ACP server (like riffado-cli's `FakeTransport`) for unit tests and a small local test agent for smoke tests?

### 10.8 Cost / quota

- **Risk**: Coding agents can consume significant model tokens. A session-based sidepanel makes it easy to rack up usage.
- **Question**: Do we show a running usage/cost estimate from `usage_update` and cap turns by token or time?

### 10.9 Jira write-back

- **Risk**: pipe-kan's architecture requires all Jira mutations to go through `jira-cli` [pipe-kan `CONTEXT.md`](https://github.com/ivishalgandhi/pipe-kan/blob/main/CONTEXT.md). An agent that wants to update Jira cannot call the Jira API directly.
- **Question**: Do we expose a small set of pipe-kan-owned tools to the agent (e.g., `run_jira_cli`) so write-back stays within the existing rule, or do we keep the agent read-only and let the user apply changes manually?

### 10.10 TypeScript/Bun client risks

- **Risk**: `@agentclientprotocol/sdk` is the official SDK but ACP v2 is still a draft; the stable v1 API is solid, yet some session helpers may evolve.
- **Risk**: `acpx/runtime` is pre-1.0 and requires Node 22.13+. Bun may satisfy this today, but runtime edge cases (stdio back-pressure, `node:stream` Web adapter behavior) need smoke testing against a real Cursor CLI.
- **Risk**: There is no `coder/acp-ts-sdk`; Coder's only public ACP SDK is Go. If we later want Coder `mux` integration, we would consume it through `acpx mux` or the raw `mux acp` CLI, not a Coder TS SDK.
- **Question**: Do we start with the direct SDK for control, or take the `acpx/runtime` shortcut to ship Cursor sessions faster?
- **Question**: Should the skill directory default to `.agents/skills/` (acpx-style, repo-local) or `~/.pi/agent/skills/` (Claude Code / mattpocock style)?

---

*Research compiled from primary sources and the riffado-cli reference implementation. All claims are tied to the URLs in the Sources table above.*
