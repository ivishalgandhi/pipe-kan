import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";

import type { App } from "../../app.ts";
import { closeAgentSessions, handleAgentApi } from "./api.ts";

const fakeAgentPath = join(dirname(fileURLToPath(import.meta.url)), "fake-agent.ts");

const mockApp = {
  flags: "",
  hydrate: () => ({ columns: [], epics: [] }),
  refresh: async () => ({ columns: [], epics: [] }),
  children: async () => ({ columns: [], epics: [] }),
  board: () => ({
    columns: [
      {
        id: "todo",
        title: "To Do",
        cards: [{ key: "PIPE-1", summary: "Piped story" }],
      },
    ],
    epics: [{ key: "PIPE-100", summary: "Piped epic", status: "To Do" }],
  }),
  move: async () => ({ ok: true, board: { columns: [], epics: [] } }),
  open: async () => ({ url: "", fields: [] }),
} satisfies App;

const servers: { close(): void }[] = [];
let previousConfigPath: string | undefined;

beforeEach(() => {
  previousConfigPath = process.env.PIPE_KAN_AGENT_CONFIG;
  process.env.PIPE_KAN_AGENT_CONFIG = join(mkdtempSync(join(tmpdir(), "pipe-kan-agent-")), "agent.json");
});

afterEach(async () => {
  await closeAgentSessions();
  while (servers.length) servers.pop()?.close();
  if (previousConfigPath === undefined) delete process.env.PIPE_KAN_AGENT_CONFIG;
  else process.env.PIPE_KAN_AGENT_CONFIG = previousConfigPath;
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
  expect(body.defaultAgent).toBe("devin");
  expect(body.defaultSkill).toBeNull();
  expect(body.agents).toContainEqual(
    expect.objectContaining({
      id: "cursor",
      command: "cursor-agent acp",
      model: "claude-sonnet-4",
      available: expect.any(Boolean),
    }),
  );
  expect(body.agents).toContainEqual(
    expect.objectContaining({
      id: "devin",
      command: "devin acp",
      model: "swe-1-6-slow",
      models: expect.arrayContaining([expect.objectContaining({ id: "swe-1-6-slow", name: "SWE-1.6 (slow)" })]),
    }),
  );
});

test("POST /api/agent/config saves default agent and model", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/config`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ defaultAgent: "devin", agents: { devin: { model: "swe-1-6" } } }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.defaultAgent).toBe("devin");
  expect(body.agents).toContainEqual(expect.objectContaining({ id: "devin", model: "swe-1-6" }));

  const roundTrip = await fetch(`${base}/api/agent/config`);
  const saved = await roundTrip.json();
  expect(saved.defaultAgent).toBe("devin");
});

test("/api/agent/skills lists bundled skills", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/skills`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body).toContainEqual(expect.objectContaining({ id: "triage" }));
  expect(body).toContainEqual(expect.objectContaining({ id: "ask-matt" }));
});

test("unknown /api/agent route returns false", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/nope`);
  expect(res.status).toBe(404);
});

test("POST /api/agent/session uses the requested agent and returns live models", async () => {
  writeFileSync(
    process.env.PIPE_KAN_AGENT_CONFIG!,
    JSON.stringify({
      defaultAgent: "fake",
      agents: {
        fake: { command: "bun", args: ["run", fakeAgentPath], model: "swe-1-6-slow" },
      },
    }),
  );
  const base = await listen();
  const res = await fetch(`${base}/api/agent/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "fake", model: "sonnet" }),
  });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.sessionId).toEqual(expect.any(String));
  expect(body.agentId).toBe("fake");
  expect(body.selectedModel).toBe("sonnet");
  expect(body.models).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: "swe-1-6-slow" }), expect.objectContaining({ id: "sonnet" })]),
  );

  const prompt = await fetch(`${base}/api/agent/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: body.sessionId, prompt: "hello" }),
  });
  expect(prompt.status).toBe(200);
});

test("POST /api/agent/session replaces an in-flight start instead of waiting for its timeout", async () => {
  writeFileSync(
    process.env.PIPE_KAN_AGENT_CONFIG!,
    JSON.stringify({
      defaultAgent: "fake",
      agents: {
        hang: { command: "sleep", args: ["30"] },
        fake: { command: "bun", args: ["run", fakeAgentPath], model: "swe-1-6-slow" },
      },
    }),
  );
  const base = await listen();
  const started = Date.now();
  const hang = fetch(`${base}/api/agent/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "hang" }),
  });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const fake = await fetch(`${base}/api/agent/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "fake", model: "sonnet" }),
  });
  expect(fake.status).toBe(200);
  const hangRes = await hang;
  expect(hangRes.status).toBe(500);
  expect(Date.now() - started).toBeLessThan(5_000);
  const body = await fake.json();
  expect(body.agentId).toBe("fake");
});

test("POST /api/agent/prompt without a session returns JSON 404", async () => {
  const base = await listen();
  const res = await fetch(`${base}/api/agent/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId: "missing", prompt: "hello" }),
  });
  expect(res.status).toBe(404);
  await expect(res.json()).resolves.toEqual({ error: "Session not found" });
});

test("POST /api/agent/prompt forwards attached board context to the agent", async () => {
  writeFileSync(
    process.env.PIPE_KAN_AGENT_CONFIG!,
    JSON.stringify({
      defaultAgent: "fake",
      agents: {
        fake: { command: "bun", args: ["run", fakeAgentPath] },
      },
    }),
  );
  const base = await listen();
  const started = await fetch(`${base}/api/agent/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "fake" }),
  });
  expect(started.status).toBe(200);
  const { sessionId } = (await started.json()) as { sessionId: string };

  const eventsRes = await fetch(`${base}/api/agent/events?sessionId=${encodeURIComponent(sessionId)}`);
  expect(eventsRes.ok).toBe(true);
  const reader = eventsRes.body?.getReader();
  if (!reader) throw new Error("no sse body");
  const decoder = new TextDecoder();
  let buf = "";
  const echoed = Promise.withResolvers<string>();
  const collect = (async () => {
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((row) => row.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as { type?: string; text?: string };
        if (event.type === "agent_message_chunk") text += event.text ?? "";
        if (event.type === "stop_reason") {
          echoed.resolve(text);
          return;
        }
      }
    }
    echoed.resolve(text);
  })();

  const prompt = await fetch(`${base}/api/agent/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      sessionId,
      prompt: "list epics",
      context: [
        { type: "text", text: "The user attached the current Jira Kanban board.\n- DEMO-100 Ship agent panel" },
      ],
    }),
  });
  expect(prompt.status).toBe(200);
  const seen = await Promise.race([
    echoed.promise,
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error("sse timeout")), 5_000)),
  ]);
  await collect.catch(() => undefined);
  expect(seen).toContain("DEMO-100");
  expect(seen).toContain("list epics");
});

test("POST /api/agent/prompt uses the piped board when no board view is attached", async () => {
  writeFileSync(
    process.env.PIPE_KAN_AGENT_CONFIG!,
    JSON.stringify({
      defaultAgent: "fake",
      agents: {
        fake: { command: "bun", args: ["run", fakeAgentPath] },
      },
    }),
  );
  const base = await listen();
  const started = await fetch(`${base}/api/agent/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId: "fake" }),
  });
  expect(started.status).toBe(200);
  const { sessionId } = (await started.json()) as { sessionId: string };

  const eventsRes = await fetch(`${base}/api/agent/events?sessionId=${encodeURIComponent(sessionId)}`);
  expect(eventsRes.ok).toBe(true);
  const reader = eventsRes.body?.getReader();
  if (!reader) throw new Error("no sse body");
  const decoder = new TextDecoder();
  let buf = "";
  const echoed = Promise.withResolvers<string>();
  const collect = (async () => {
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.split("\n").find((row) => row.startsWith("data: "));
        if (!line) continue;
        const event = JSON.parse(line.slice(6)) as { type?: string; text?: string };
        if (event.type === "agent_message_chunk") text += event.text ?? "";
        if (event.type === "stop_reason") {
          echoed.resolve(text);
          return;
        }
      }
    }
    echoed.resolve(text);
  })();

  const prompt = await fetch(`${base}/api/agent/prompt`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, prompt: "list epics" }),
  });
  expect(prompt.status).toBe(200);
  const seen = await Promise.race([
    echoed.promise,
    new Promise<string>((_, reject) => setTimeout(() => reject(new Error("sse timeout")), 5_000)),
  ]);
  await collect.catch(() => undefined);
  expect(seen).toContain("PIPE-1");
  expect(seen).toContain("PIPE-100");
  expect(seen).toContain("list epics");
});
