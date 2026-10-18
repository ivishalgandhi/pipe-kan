import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";
import type { Boot } from "./boot.ts";
import { resolveJiraBin } from "./cli.ts";
import { readLedger } from "./factory-ledger.ts";
import { sourceOptions } from "./parity.ts";
import { planeWorkspace } from "./plane.ts";

export type SourceSwitchResult = {
  ok: boolean;
  kind: Boot["kind"];
  source: string;
  reason?: string;
  error?: string;
  refreshing?: boolean;
};

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk as Buffer));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function pathOf(req: IncomingMessage): URL {
  return new URL(req.url ?? "/", "http://127.0.0.1");
}

function reply(
  req: IncomingMessage,
  res: ServerResponse,
  work: (text: string) => Promise<void>,
) {
  void readBody(req)
    .then(work)
    .catch((err) => {
      const message = err instanceof Error ? err.message : "request failed";
      console.error(message);
      if (!res.headersSent) json(res, 500, { error: message });
    });
}

async function boardEnvelope(
  body: object,
  kind: Boot["kind"],
  flags: string,
  env: NodeJS.ProcessEnv,
  app: App,
) {
  if (kind !== "plane") return { ...body, kind };
  const envelope = { ...body, kind, workspace: planeWorkspace(flags, env) };
  try {
    const workspaces = await app.listWorkspaces?.();
    if (workspaces && workspaces.length) return { ...envelope, workspaces };
  } catch {
    /* omit list; never fail Board */
  }
  return envelope;
}

export function handleAppApi(
  req: IncomingMessage,
  res: ServerResponse,
  app: App,
  opts: {
    kind?: Boot["kind"];
    env?: NodeJS.ProcessEnv;
    onSource?: (source: string) => Promise<SourceSwitchResult>;
  } = {},
): boolean {
  const kind = opts.kind ?? "store";
  const env = opts.env ?? process.env;
  const url = pathOf(req);
  const method = (req.method ?? "GET").toUpperCase();

  if (url.pathname === "/api/board" && method === "GET") {
    reply(req, res, async () => {
      if (app.board().partial) void app.pumpCatalog?.();
      json(res, 200, await boardEnvelope({ ...app.board(), flags: app.flags }, kind, app.flags, env, app));
    });
    return true;
  }

  if (url.pathname === "/api/cycles" && method === "GET") {
    reply(req, res, async () => {
      try {
        json(res, 200, { cycles: (await app.cycles?.()) ?? [] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "cycles failed";
        json(res, 200, { cycles: [], error: message });
      }
    });
    return true;
  }

  if (url.pathname === "/api/projects" && method === "GET") {
    reply(req, res, async () => {
      if (kind !== "plane") {
        json(res, 404, { error: "not plane" });
        return;
      }
      const workspace = (url.searchParams.get("workspace") ?? "").trim();
      if (!workspace) {
        json(res, 400, { error: "workspace required" });
        return;
      }
      try {
        const projects = await app.listProjectIdentifiers?.(workspace) ?? [];
        const details = await app.listProjects?.(workspace) ?? [];
        json(res, 200, { projects, ...(details.length ? { details } : {}) });
      } catch (err) {
        const message = err instanceof Error ? err.message : "catalog failed";
        json(res, 409, { error: message });
      }
    });
    return true;
  }

  if (url.pathname === "/api/parity" && method === "GET") {
    reply(req, res, async () => {
      json(res, 200, (await app.parity?.()) ?? { initiatives: [], projects: [], workspaces: [] });
    });
    return true;
  }

  if (url.pathname === "/api/sources" && method === "GET") {
    reply(req, res, async () => {
      const taskwarrior = Boolean(env.TASKWARRIOR_FIXTURE?.trim());
      const current = taskwarrior ? "taskwarrior" : kind === "plane" ? "plane" : "jira";
      json(res, 200, {
        source: current,
        kind,
        sources: sourceOptions({
          planeKey: Boolean(env.PLANE_API_KEY?.trim() || env.PLANE_FIXTURE?.trim()),
          jiraBin: Boolean(resolveJiraBin(env.JIRA_BIN ?? "jira", env.PATH ?? "")),
          taskwarrior,
        }),
      });
    });
    return true;
  }

  if (url.pathname === "/api/source" && method === "POST") {
    reply(req, res, async (text) => {
      if (!opts.onSource) {
        json(res, 404, { error: "source switch unavailable" });
        return;
      }
      const body = text ? JSON.parse(text) : {};
      const result = await opts.onSource(String(body.source ?? ""));
      json(res, result.ok ? 200 : 409, result);
    });
    return true;
  }

  if (url.pathname === "/api/refresh" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      if (body.scope === "selected") {
        const epicKeys = Array.isArray(body.epicKeys)
          ? body.epicKeys.filter((item: unknown) => typeof item === "string" && item.trim() !== "")
          : [];
        if (!epicKeys.length) {
          json(res, 400, { error: "selected Refresh requires epicKeys" });
          return;
        }
        json(
          res,
          200,
          await boardEnvelope(await app.refresh(undefined, { scope: "selected", epicKeys }), kind, app.flags, env, app),
        );
        return;
      }
      json(res, 200, await boardEnvelope(await app.refresh(body.flags), kind, app.flags, env, app));
    });
    return true;
  }

  if (url.pathname === "/api/move" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      const key = String(body.key ?? "");
      const status = String(body.status ?? "");
      if (body.raw === true) {
        const result = await app.moveRaw(key, status);
        json(res, result.ok ? 200 : 409, result);
        return;
      }
      const result = await app.move(key, status);
      json(res, result.ok ? 200 : 409, result);
    });
    return true;
  }

  if (url.pathname === "/api/epic" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      json(res, 200, await app.children(String(body.key ?? "")));
    });
    return true;
  }

  if (url.pathname === "/api/open" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      json(res, 200, await app.open(String(body.key ?? "")));
    });
    return true;
  }

  if (url.pathname === "/api/issue/create" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      const labels = Array.isArray(body.labels)
        ? body.labels.filter((item: unknown) => typeof item === "string")
        : [];
      const result = await app.create({
        summary: String(body.summary ?? ""),
        ...(body.description !== undefined ? { description: String(body.description) } : {}),
        labels,
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.parent !== undefined ? { parent: String(body.parent) } : {}),
        ...(body.type !== undefined ? { type: String(body.type) } : {}),
      });
      json(res, result.ok ? 200 : 409, result);
    });
    return true;
  }

  if (url.pathname === "/api/issue/edit" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      const input: { summary?: string; description?: string; labels?: string[]; assignee?: string; priority?: string } = {};
      if (body.summary !== undefined) input.summary = String(body.summary);
      if (body.description !== undefined) input.description = String(body.description);
      if (body.assignee !== undefined) input.assignee = String(body.assignee);
      if (body.priority !== undefined) input.priority = String(body.priority);
      if (Array.isArray(body.labels)) {
        input.labels = body.labels.filter((item: unknown) => typeof item === "string");
      }
      const result = await app.edit(String(body.key ?? ""), input);
      json(res, result.ok ? 200 : 409, result);
    });
    return true;
  }

  if (url.pathname === "/api/factory/jobs" && method === "GET") {
    reply(req, res, async () => {
      const result = readLedger();
      json(res, result.error && result.jobs.length === 0 ? 503 : 200, result);
    });
    return true;
  }

  if (/^\/api\/factory\/jobs\/[^/]+$/.test(url.pathname) && method === "GET") {
    reply(req, res, async () => {
      const id = url.pathname.slice("/api/factory/jobs/".length);
      const result = readLedger();
      const job = result.jobs.find((j) => j.id === id);
      if (!job) {
        json(res, 404, { error: `Job not found: ${id}`, ledgerError: result.error });
        return;
      }
      json(res, 200, { job });
    });
    return true;
  }

  return false;
}
