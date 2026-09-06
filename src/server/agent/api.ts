import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "../../app.ts";
import { loadAgentConfig } from "./config.ts";
import { createAcpBackend } from "./session.ts";
import { createSkillRegistry, skillContextBlock } from "./skills.ts";
import type { SkillRegistry } from "./skills.ts";
import { createToolRegistry } from "./tools.ts";
import type { AgentContextBlock, AgentEvent, AgentSession } from "./types.ts";

const sessions = new Map<string, AgentSession>();
const skills = createSkillRegistry();
const tools = createToolRegistry();

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  const { promise, resolve, reject } = Promise.withResolvers<string>();
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(chunk as Buffer));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
  return promise;
}

function pathOf(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://127.0.0.1");
}

export function handleAgentApi(req: IncomingMessage, res: ServerResponse, app: App): boolean {
  const url = pathOf(req);
  const method = (req.method ?? "GET").toUpperCase();

  if (url.pathname === "/api/agent/config" && method === "GET") {
    const cfg = loadAgentConfig();
    json(res, 200, {
      defaultAgent: cfg.defaultAgent,
      defaultSkill: cfg.defaultSkill,
      agents: Object.entries(cfg.agents).map(([id, c]) => ({
        id,
        command: [c.command, ...(c.args ?? [])].join(" "),
        model: c.model,
        options: c.options,
      })),
    });
    return true;
  }

  if (url.pathname === "/api/agent/skills" && method === "GET") {
    json(
      res,
      200,
      skills.list().map((s) => ({ id: s.id, name: s.name, description: s.description })),
    );
    return true;
  }

  if (url.pathname === "/api/agent/session" && method === "POST") {
    const cfg = loadAgentConfig();
    const backendConfig = cfg.agents[cfg.defaultAgent];
    if (!backendConfig) {
      json(res, 500, { error: `No agent config for ${cfg.defaultAgent}` });
      return true;
    }
    const backend = createAcpBackend(cfg.defaultAgent, cfg.defaultAgent);
    backend
      .spawn(backendConfig)
      .then((session) => {
        session.setToolParser((text) => {
          const call = tools.parse(text);
          return call ? { requestId: call.requestId, name: call.name, args: call.args } : undefined;
        });
        session.setToolExecutor(
          (name) => !tools.isMutating(name),
          async (call) => {
            const result = await tools.execute(call.name, call.args, app);
            return {
              text: result.ok ? `Result: ${JSON.stringify(result.value)}` : `Error: ${result.error}`,
              result: result.ok ? result.value : undefined,
            };
          },
        );
        sessions.set(session.id, session);
        json(res, 200, { sessionId: session.id });
      })
      .catch((err) => json(res, 500, { error: String(err) }));
    return true;
  }

  if (url.pathname === "/api/agent/prompt" && method === "POST") {
    readBody(req)
      .then((text) => {
        const body = JSON.parse(text) as {
          sessionId?: string;
          prompt?: string;
          context?: AgentContextBlock[];
          skillId?: string;
        };
        const session = sessions.get(body.sessionId ?? "");
        if (!session) {
          json(res, 404, { error: "Session not found" });
          return;
        }
        const context: AgentContextBlock[] = [tools.systemBlock(), ...(body.context ?? [])];
        if (body.skillId) {
          const skill = skills.load(body.skillId);
          if (skill) context.push(skillContextBlock(skill));
        }
        return session.prompt(String(body.prompt ?? ""), context).then(() => {
          json(res, 200, { ok: true });
        });
      })
      .catch((err) => json(res, 500, { error: String(err) }));
    return true;
  }

  if (url.pathname === "/api/agent/cancel" && method === "POST") {
    readBody(req)
      .then((text) => {
        const body = JSON.parse(text) as { sessionId?: string };
        const session = sessions.get(body.sessionId ?? "");
        if (!session) {
          json(res, 404, { error: "Session not found" });
          return;
        }
        session.cancel();
        json(res, 200, { ok: true });
      })
      .catch((err) => json(res, 500, { error: String(err) }));
    return true;
  }

  if (url.pathname === "/api/agent/approve" && method === "POST") {
    readBody(req)
      .then(async (text) => {
        const body = JSON.parse(text) as {
          sessionId?: string;
          requestId?: string;
          decision?: "once" | "always" | "reject";
        };
        const session = sessions.get(body.sessionId ?? "");
        if (!session) {
          json(res, 404, { error: "Session not found" });
          return;
        }
        const requestId = String(body.requestId ?? "");
        const decision = body.decision ?? "reject";
        const toolCall = session.pendingToolCalls().get(requestId);
        if (toolCall) {
          if (decision === "reject") {
            session.resolveToolCall(requestId, "Tool call was rejected by the user.");
          } else {
            const result = await tools.execute(toolCall.name, toolCall.args, app);
            const resultText = result.ok
              ? `Result: ${JSON.stringify(result.value)}`
              : `Error: ${result.error}`;
            session.resolveToolCall(requestId, resultText, result.ok ? result.value : undefined);
          }
          json(res, 200, { ok: true });
          return;
        }
        session.approve(requestId, decision);
        json(res, 200, { ok: true });
      })
      .catch((err) => json(res, 500, { error: String(err) }));
    return true;
  }

  if (url.pathname === "/api/agent/events" && method === "GET") {
    const sessionId = url.searchParams.get("sessionId");
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session) {
      json(res, 404, { error: "Session not found" });
      return true;
    }

    res.statusCode = 200;
    res.setHeader("content-type", "text/event-stream");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("connection", "keep-alive");
    res.write("\n");

    const writeEvent = (event: AgentEvent) => {
      if (res.writableEnded) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    (async () => {
      for await (const event of session.events()) {
        writeEvent(event);
        if (event.type === "disconnected") {
          break;
        }
      }
      if (!res.writableEnded) res.end();
    })().catch((err) => {
      writeEvent({ type: "error", message: String(err) });
      if (!res.writableEnded) res.end();
    });

    req.on("close", () => {
      if (!res.writableEnded) res.end();
    });
    return true;
  }

  return false;
}
