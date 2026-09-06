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
