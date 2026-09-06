# Agent sidepanel via ACP with user-approved actions

pipe-kan will add a Linear-style Agent sidepanel that drives an external coding agent over the Agent Client Protocol (ACP). The agent can read board state and repo files freely, but any mutation — moving a card, refreshing the board, editing files, or running commands — requires explicit user approval in the UI. The agent never calls Jira directly; all Jira write-back continues to go through jira-cli. We chose ACP over a direct LLM API because ACP lets the user reuse the Cursor/Devin agents they already authenticate, and because ACP's permission model matches the deliberate approval UI we want. We chose to host the ACP client in the existing Bun server and stream events to the React client over WebSocket/SSE, rather than running the agent from the browser, because ACP agents are local stdio processes that need a server runtime.

## Status

Accepted

## Considered options

- **Direct LLM API call** — rejected. It would require pipe-kan to manage API keys and model selection, and it would not give the agent any repo awareness or tool use without rebuilding an agent framework from scratch.
- **MCP instead of ACP** — rejected as the primary protocol. MCP is useful for exposing pipe-kan's own board actions as tools, but the agent we want to drive is an external coding agent (Cursor/Devin) that speaks ACP, not a headless MCP server. We may expose a small MCP layer later for internal tools, but the user-facing agent connection is ACP.
- **Browser-side ACP client** — rejected. ACP agents spawn local binaries over stdio; a browser page cannot do that securely. The server must spawn and manage the process.
- **Custom skill runtime** — rejected. "Skills" in this design are Markdown instruction files injected as prompt context, not a runtime API or plugin system. This matches the mattpocock/skills convention and avoids inventing a new skill execution engine.

## Consequences

- The Bun server gains a long-lived child-process manager for ACP sessions and must forward NDJSON ACP events to the React client.
- The React client gains a resizable right-side panel, a chat composer, context chips, tool/permission cards, and suggested-action chips.
- We depend on `acpx/runtime` (or `@agentclientprotocol/sdk`) for the ACP client, which is pre-1.0 and may require updates as ACP v2 lands.
- Cursor is the only supported agent at first; Devin support is a configuration change once the Devin CLI is locally available.
- All Jira mutations from the agent must route through the existing `/api/move` and `jira-cli` path to preserve the no-direct-Jira-API rule.
- We need bundled skills in `.agents/skills/` and a user-override directory such as `~/.pi/agent/skills/`.
