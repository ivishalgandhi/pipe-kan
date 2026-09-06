import type { AgentContextBlock } from "./types.ts";

export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  mutates: boolean;
};

export type ToolCall = {
  requestId: string;
  name: string;
  args: Record<string, unknown>;
};

export type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export type ToolExecutor = (args: Record<string, unknown>) => Promise<ToolResult> | ToolResult;

export type ToolRegistry = {
  definitions(): ToolSchema[];
  systemBlock(): AgentContextBlock;
  parse(text: string): ToolCall | undefined;
};

const TOOLS: ToolSchema[] = [
  {
    name: "board_state",
    description: "Read the current pipe-kan board state, columns, and cards.",
    parameters: {},
    mutates: false,
  },
  {
    name: "issue_details",
    description: "Read details of a specific Jira issue by key.",
    parameters: { key: { type: "string", description: "Issue key, e.g. DEMO-123" } },
    mutates: false,
  },
  {
    name: "move_card",
    description: "Move a card to a new status. Requires user approval because it changes Jira via jira-cli.",
    parameters: {
      key: { type: "string", description: "Issue key" },
      status: { type: "string", description: "Target status name" },
    },
    mutates: true,
  },
  {
    name: "refresh_board",
    description: "Refresh the board from Jira. Requires user approval.",
    parameters: { flags: { type: "string", description: "Optional jira-cli flags" } },
    mutates: true,
  },
  {
    name: "apply_preset",
    description: "Apply a named board preset (filter, sort, hide). Requires user approval.",
    parameters: { name: { type: "string", description: "Preset name" } },
    mutates: true,
  },
  {
    name: "set_filter",
    description: "Update the current board filter. Requires user approval.",
    parameters: { filter: { type: "object", description: "BoardFilter object" } },
    mutates: true,
  },
];

const SYSTEM_TEXT = `You can call tools by emitting a single JSON code block matching this schema:

{"tool": "<name>", "args": {...}}

Available tools:
${TOOLS.map((t) => `- ${t.name}: ${t.description} (params: ${Object.keys(t.parameters).join(", ") || "none"})`).join("\n")}

Mutating tools require the user's explicit approval before they run. Do not call more than one tool at a time.`;

export function createToolRegistry(): ToolRegistry {
  return {
    definitions() {
      return TOOLS;
    },
    systemBlock(): AgentContextBlock {
      return { type: "text", text: SYSTEM_TEXT };
    },
    parse(text) {
      const match = text.match(/```json\s*\n?\s*(\{[\s\S]*?\})\s*\n?```/);
      if (!match) return undefined;
      try {
        const parsed = JSON.parse(match[1]) as { tool?: string; args?: Record<string, unknown> };
        if (!parsed.tool || typeof parsed.tool !== "string") return undefined;
        const schema = TOOLS.find((t) => t.name === parsed.tool);
        if (!schema) return undefined;
        return {
          requestId: crypto.randomUUID(),
          name: schema.name,
          args: parsed.args ?? {},
        };
      } catch {
        return undefined;
      }
    },
  };
}
