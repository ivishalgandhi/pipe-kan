import { expect, test } from "vitest";

import type { App } from "../../app.ts";
import { createToolRegistry } from "./tools.ts";

const mockApp = {
  flags: "",
  hydrate: () => ({ columns: [], epics: [] }),
  refresh: async () => ({ columns: [], epics: [] }),
  children: async () => ({ columns: [], epics: [] }),
  board: () => ({
    columns: [
      {
        id: "todo",
        title: "Todo",
        cards: [{ key: "DEMO-1", summary: "One", epic: undefined, labels: [] }],
      },
    ],
    epics: [],
  }),
  move: async () => ({ ok: true, board: { columns: [], epics: [] } }),
  moveRaw: async () => ({ ok: true }),
  create: async () => ({ ok: true, key: "DEMO-9", board: { columns: [], epics: [] } }),
  edit: async () => ({ ok: true, board: { columns: [], epics: [] } }),
  open: async () => ({ url: "https://jira/1", fields: [{ label: "Summary", value: "Test" }] }),
} satisfies App;

test("tool registry exposes all definitions", () => {
  const registry = createToolRegistry();
  const names = registry.definitions().map((t) => t.name);
  expect(names).toContain("board_state");
  expect(names).toContain("move_card");
  expect(names).toContain("create_issue");
  expect(names).toContain("edit_issue");
  expect(registry.definitions().find((t) => t.name === "move_card")?.mutates).toBe(true);
  expect(registry.definitions().find((t) => t.name === "create_issue")?.mutates).toBe(true);
  expect(registry.definitions().find((t) => t.name === "edit_issue")?.mutates).toBe(true);
});

test("tool registry parses JSON tool call block", () => {
  const registry = createToolRegistry();
  const text = "I'll move the card.\n```json\n{\"tool\":\"move_card\",\"args\":{\"key\":\"DEMO-1\",\"status\":\"Done\"}}\n```";
  const call = registry.parse(text);
  expect(call).toBeDefined();
  expect(call?.name).toBe("move_card");
  expect(call?.args).toEqual({ key: "DEMO-1", status: "Done" });
});

test("tool registry ignores unknown tool names", () => {
  const registry = createToolRegistry();
  const call = registry.parse('```json\n{"tool":"unknown_tool"}\n```');
  expect(call).toBeUndefined();
});

test("tool system block lists available tools", () => {
  const registry = createToolRegistry();
  const block = registry.systemBlock();
  expect(block.type).toBe("text");
  if (block.type !== "text") throw new Error("expected text block");
  expect(block.text).toContain("move_card");
  expect(block.text).toContain("board_state");
});

test("board_state executes against app board", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("board_state", {}, mockApp);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect((result.value as { columns: unknown[] }).columns).toHaveLength(1);
});

test("move_card executes app.move", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("move_card", { key: "DEMO-1", status: "Done" }, mockApp);
  expect(result.ok).toBe(true);
});

test("execute returns error for unknown tool", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("unknown", {}, mockApp);
  expect(result.ok).toBe(false);
});

test("isMutating returns false for read-only tools and true for mutating tools", () => {
  const registry = createToolRegistry();
  expect(registry.isMutating("board_state")).toBe(false);
  expect(registry.isMutating("issue_details")).toBe(false);
  expect(registry.isMutating("run_skill")).toBe(false);
  expect(registry.isMutating("read_repo_file")).toBe(false);
  expect(registry.isMutating("move_card")).toBe(true);
  expect(registry.isMutating("refresh_board")).toBe(true);
  expect(registry.isMutating("create_issue")).toBe(true);
  expect(registry.isMutating("edit_issue")).toBe(true);
});

test("apply_preset returns a UI directive", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("apply_preset", { name: "my-preset" }, mockApp);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toEqual({ __ui_action: "apply_preset", preset: "my-preset" });
});

test("set_filter returns a UI directive", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("set_filter", { filter: { status: ["Done"] } }, mockApp);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toEqual({ __ui_action: "set_filter", filter: { status: ["Done"] } });
});

test("run_skill returns skill resource", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("run_skill", { skillId: "triage" }, mockApp);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect((result.value as { uri: string }).uri).toBe("skill://triage");
});

test("read_repo_file rejects traversal and reads existing file", async () => {
  const registry = createToolRegistry();
  const bad = await registry.execute("read_repo_file", { path: "../package.json" }, mockApp);
  expect(bad.ok).toBe(false);
  const good = await registry.execute("read_repo_file", { path: "package.json" }, mockApp);
  expect(good.ok).toBe(true);
});

test("create_issue executes app.create", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute(
    "create_issue",
    { summary: "New card", labels: "kanban, parser" },
    mockApp,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toEqual({ key: "DEMO-9", __ui_action: "refresh_board" });
});

test("create_issue requires a summary", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("create_issue", {}, mockApp);
  expect(result.ok).toBe(false);
});

test("edit_issue executes app.edit", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute(
    "edit_issue",
    { key: "DEMO-1", summary: "Edited", labels: "kanban" },
    mockApp,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value).toEqual({ key: "DEMO-1", __ui_action: "refresh_board" });
});

test("create_issue parses from agent JSON and stays mutating", () => {
  const registry = createToolRegistry();
  const call = registry.parse(
    '```json\n{"tool":"create_issue","args":{"summary":"New card","parent":"DEMO-1"}}\n```',
  );
  expect(call?.name).toBe("create_issue");
  expect(call?.args).toEqual({ summary: "New card", parent: "DEMO-1" });
  expect(registry.isMutating("create_issue")).toBe(true);
});

test("edit_issue requires a key", async () => {
  const registry = createToolRegistry();
  const result = await registry.execute("edit_issue", { summary: "Edited" }, mockApp);
  expect(result.ok).toBe(false);
});
