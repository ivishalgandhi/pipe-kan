import { createServer } from "node:http";
import { afterEach, expect, test } from "vitest";

import { handleAgentApi } from "./api.ts";

const servers: { close(): void }[] = [];

afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

async function listen() {
  const server = createServer((req, res) => {
    if (!handleAgentApi(req, res)) {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return `http://127.0.0.1:${addr.port}`;
}

test("/api/agent/config returns default agent", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/config`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.defaultAgent).toBe("cursor");
  expect(body.agents).toContainEqual({ id: "cursor", command: "cursor-agent acp" });
  expect(body.agents).toContainEqual({ id: "devin", command: "devin acp" });
});

test("unknown /api/agent route returns false", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/nope`);
  expect(res.status).toBe(404);
});
