import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { App } from "../../app.ts";
import { createSkillRegistry, skillContextBlock } from "./skills.ts";
import type { AgentContextBlock, ToolCall } from "./types.ts";

export type ToolSchema = {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string }>;
  mutates: boolean;
};

export type ToolResult =
  | { ok: true; value: unknown }
  | { ok: false; error: string };

export type ToolExecutor = (args: Record<string, unknown>, app: App) => Promise<ToolResult> | ToolResult;

export type ToolRegistry = {
  definitions(): ToolSchema[];
  systemBlock(): AgentContextBlock;
  parse(text: string): ToolCall | undefined;
  isMutating(name: string): boolean;
  execute(name: string, args: Record<string, unknown>, app: App): Promise<ToolResult>;
};

const TOOLS: ToolSchema[] = [
  {
    name: "board_state",
    description: "Read the current board columns and cards without changing anything.",
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
    name: "run_skill",
    description: "Load a skill by id and return its instructions as context.",
    parameters: { skillId: { type: "string", description: "Skill id, e.g. triage" } },
    mutates: false,
  },
  {
    name: "read_repo_file",
    description: "Read a file under the repo root as plain text.",
    parameters: { path: { type: "string", description: "Relative repo path" } },
    mutates: false,
  },
  {
    name: "move_card",
    description: "Move a card to a new status. Requires user approval because it changes Jira via jira-cli.",
    parameters: {
      key: { type: "string", description: "Issue key" },
      status: { type: "string", description: "Target status name" }},
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

const skills = createSkillRegistry();

const EXECUTORS: Record<string, ToolExecutor> = {
  board_state(_, app) {
    const board = app.board();
    const columns = board.columns.map((c) => ({
      title: c.title,
      cards: c.cards.map((card) => ({ key: card.key, summary: card.summary, epic: card.epic })),
    }));
    return { ok: true, value: { columns } };
  },
  async issue_details(args, app) {
    const key = String(args.key ?? "");
    if (!key) return { ok: false, error: "Missing key parameter" };
    const result = await app.open(key);
    if (result.error) return { ok: false, error: result.error };
    return { ok: true, value: { url: result.url, fields: result.fields } };
  },
  run_skill(args) {
    const skillId = String(args.skillId ?? "");
    if (!skillId) return { ok: false, error: "Missing skillId" };
    const skill = skills.load(skillId);
    if (!skill) return { ok: false, error: `Skill not found: ${skillId}` };
    const block = skillContextBlock(skill);
    if (block.type !== "resource") return { ok: false, error: "Skill produced unexpected block" };
    return { ok: true, value: block.resource };
  },
  read_repo_file(args) {
    const relPath = String(args.path ?? "");
    if (!relPath) return { ok: false, error: "Missing path" };
    if (relPath.includes("..")) return { ok: false, error: "Path traversal not allowed" };
    const repoRoot = process.cwd();
    try {
      const text = readFileSync(join(repoRoot, relPath), "utf8");
      return { ok: true, value: { path: relPath, text } };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  },
  async move_card(args, app) {
    const key = String(args.key ?? "");
    const status = String(args.status ?? "");
    if (!key || !status) return { ok: false, error: "Missing key or status" };
    const result = await app.move(key, status);
    if (result.error) return { ok: false, error: result.error };
    return { ok: true, value: { moved: key, to: status } };
  },
  async refresh_board(args, app) {
    const flags = typeof args.flags === "string" ? args.flags : undefined;
    await app.refresh(flags);
    return { ok: true, value: "Board refreshed" };
  },
  apply_preset(args) {
    const name = String(args.name ?? "");
    if (!name) return { ok: false, error: "Missing preset name" };
    return { ok: true, value: { __ui_action: "apply_preset", preset: name } };
  },
  set_filter(args) {
    const filter = args.filter;
    if (!filter || typeof filter !== "object") return { ok: false, error: "Missing filter object" };
    return { ok: true, value: { __ui_action: "set_filter", filter } };
  },
};

const SYSTEM_TEXT = `Your working context is the attached Jira issues from the pipe. Answer from that payload. Do not search GitHub, git history, or local source files unless the user explicitly asks about the pipe-kan app itself.

You can call tools by emitting a single JSON code block matching this schema:

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
    isMutating(name) {
      return TOOLS.find((t) => t.name === name)?.mutates ?? true;
    },
    async execute(name, args, app) {
      const executor = EXECUTORS[name];
      if (!executor) return { ok: false, error: `Unknown tool: ${name}` };
      try {
        return await executor(args, app);
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  };
}
