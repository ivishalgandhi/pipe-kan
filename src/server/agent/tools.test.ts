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
  open: async () => ({ url: "https://jira/1", fields: [{ label: "Summary", value: "Test" }] }),
} satisfies App;

test("tool registry exposes all definitions", () => {
  const registry = createToolRegistry();
  const names = registry.definitions().map((t) => t.name);
  expect(names).toContain("board_state");
  expect(names).toContain("move_card");
  expect(registry.definitions().find((t) => t.name === "move_card")?.mutates).toBe(true);
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
