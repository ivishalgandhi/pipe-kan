import { createServer } from "node:http";
import { afterEach, expect, test } from "vitest";

import type { App } from "../../app.ts";
import { handleAgentApi } from "./api.ts";

const mockApp = {
  flags: "",
  hydrate: () => ({ columns: [], epics: [] }),
  refresh: async () => ({ columns: [], epics: [] }),
  children: async () => ({ columns: [], epics: [] }),
  board: () => ({ columns: [], epics: [] }),
  move: async () => ({ ok: true, board: { columns: [], epics: [] } }),
  open: async () => ({ url: "", fields: [] }),
} satisfies App;

const servers: { close(): void }[] = [];

afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

async function listen() {
  const server = createServer((req, res) => {
    if (!handleAgentApi(req, res, mockApp)) {
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

test("/api/agent/config returns default agent, skill, and model options", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/config`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.defaultAgent).toBe("cursor");
  expect(body.defaultSkill).toBeNull();
  expect(body.agents).toContainEqual(
    expect.objectContaining({ id: "cursor", command: "cursor-agent acp", model: "claude-sonnet-4" }),
  );
  expect(body.agents).toContainEqual(
    expect.objectContaining({ id: "devin", command: "devin acp", model: "devin" }),
  );
});

test("/api/agent/skills lists bundled skills", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/skills`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toContainEqual(
    expect.objectContaining({ id: "triage" }),
  );
  expect(body).toContainEqual(
    expect.objectContaining({ id: "ask-matt" }),
  );
});

test("unknown /api/agent route returns false", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/nope`);
  expect(res.status).toBe(404);
});
