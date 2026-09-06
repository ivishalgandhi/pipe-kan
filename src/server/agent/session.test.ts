import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";

import { createAcpBackend } from "./session.ts";

const fakeAgentPath = join(dirname(fileURLToPath(import.meta.url)), "fake-agent.ts");

test("ACP backend connects and echoes prompt", async () => {
  const backend = createAcpBackend("fake", "Fake");
  const session = await backend.spawn({
    command: "bun",
    args: ["run", fakeAgentPath],
  });

  const chunks: string[] = [];
  const reader = (async () => {
    for await (const event of session.events()) {
      if (event.type === "agent_message_chunk") chunks.push(event.text);
      if (event.type === "stop_reason") break;
    }
  })();

  await session.prompt("hello world");
  await reader;
  await session.close();

  expect(chunks.join("").trim()).toBe("hello world");
});

test("ACP backend emits permission request and resolves it", async () => {
  const backend = createAcpBackend("fake", "Fake");
  const session = await backend.spawn({
    command: "bun",
    args: ["run", fakeAgentPath],
  });

  const events: unknown[] = [];
  let permissionRequestId: string | null = null;
  const permissionSeen = Promise.withResolvers<void>();

  const reader = (async () => {
    for await (const event of session.events()) {
      events.push(event);
      if (event.type === "request_permission" && permissionRequestId == null) {
        permissionRequestId = event.requestId;
        permissionSeen.resolve();
      }
      if (event.type === "stop_reason") break;
    }
  })();

  await session.prompt("permission: run tool");
  await permissionSeen.promise;
  if (permissionRequestId) session.approve(permissionRequestId, "once");

  await reader;
  await session.close();

  expect(events.some((e) => (e as { type: string }).type === "request_permission")).toBe(true);
});

test("ACP backend detects tool call in streamed text", async () => {
  const backend = createAcpBackend("fake", "Fake");
  const session = await backend.spawn({
    command: "bun",
    args: ["run", fakeAgentPath],
  });
  session.setToolParser((text) => {
    const match = text.match(/```json\s*\n?\s*(\{[\s\S]*?\})\s*\n?```/);
    if (!match) return undefined;
    try {
      const parsed = JSON.parse(match[1]) as { tool?: string; args?: Record<string, unknown> };
      if (!parsed.tool) return undefined;
      return { requestId: "tc-1", name: parsed.tool, args: parsed.args ?? {} };
    } catch {
      return undefined;
    }
  });

  const events: unknown[] = [];
  let toolCallSeen = Promise.withResolvers<void>();

  const reader = (async () => {
    for await (const event of session.events()) {
      events.push(event);
      if (event.type === "tool_call") toolCallSeen.resolve();
      if (event.type === "stop_reason") break;
    }
  })();

  await session.prompt('Use the tool.\n```json\n{"tool":"board_state","args":{}}\n```');
  await toolCallSeen.promise;
  await reader;
  await session.close();

  expect(events.some((e) => (e as { type: string }).type === "tool_call")).toBe(true);
});

test("ACP backend auto-executes read-only tools and emits tool_result", async () => {
  const backend = createAcpBackend("fake", "Fake");
  const session = await backend.spawn({
    command: "bun",
    args: ["run", fakeAgentPath],
  });
  session.setToolParser((text) => {
    const match = text.match(/```json\s*\n?\s*(\{[\s\S]*?\})\s*\n?```/);
    if (!match) return undefined;
    try {
      const parsed = JSON.parse(match[1]) as { tool?: string; args?: Record<string, unknown> };
      if (!parsed.tool) return undefined;
      return { requestId: "tc-auto", name: parsed.tool, args: parsed.args ?? {} };
    } catch {
      return undefined;
    }
  });
  session.setToolExecutor(
    () => true,
    async (call) => ({ text: `Auto result for ${call.name}`, result: { auto: true } }),
  );

  const events: unknown[] = [];
  let toolResultSeen = Promise.withResolvers<void>();

  const reader = (async () => {
    for await (const event of session.events()) {
      events.push(event);
      if (event.type === "tool_result") {
        toolResultSeen.resolve();
        break;
      }
    }
  })();

  await session.prompt('Auto tool.\n```json\n{"tool":"board_state","args":{}}\n```');
  await toolResultSeen.promise;
  await reader;
  await session.close().catch(() => void 0);

  expect(events.some((e) => (e as { type: string }).type === "tool_result")).toBe(true);
  expect(events.some((e) => (e as { type: string }).type === "tool_call")).toBe(false);
});
