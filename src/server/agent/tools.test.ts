import { expect, test } from "vitest";

import { createToolRegistry } from "./tools.ts";

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
