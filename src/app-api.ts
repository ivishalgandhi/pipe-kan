import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";
import type { Boot } from "./boot.ts";
import { planeWorkspace } from "./plane.ts";

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

function boardEnvelope(
  body: object,
  kind: Boot["kind"],
  flags: string,
  env: NodeJS.ProcessEnv,
) {
  if (kind !== "plane") return { ...body, kind };
  return { ...body, kind, workspace: planeWorkspace(flags, env) };
}

export function handleAppApi(
  req: IncomingMessage,
  res: ServerResponse,
  app: App,
  opts: { kind?: Boot["kind"]; env?: NodeJS.ProcessEnv } = {},
): boolean {
  const kind = opts.kind ?? "store";
  const env = opts.env ?? process.env;
  const url = pathOf(req);
  const method = (req.method ?? "GET").toUpperCase();

  if (url.pathname === "/api/board" && method === "GET") {
    json(res, 200, boardEnvelope({ ...app.board(), flags: app.flags }, kind, app.flags, env));
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
          boardEnvelope(await app.refresh(undefined, { scope: "selected", epicKeys }), kind, app.flags, env),
        );
        return;
      }
      json(res, 200, boardEnvelope(await app.refresh(body.flags), kind, app.flags, env));
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
      const input: { summary?: string; description?: string; labels?: string[] } = {};
      if (body.summary !== undefined) input.summary = String(body.summary);
      if (body.description !== undefined) input.description = String(body.description);
      if (Array.isArray(body.labels)) {
        input.labels = body.labels.filter((item: unknown) => typeof item === "string");
      }
      const result = await app.edit(String(body.key ?? ""), input);
      json(res, result.ok ? 200 : 409, result);
    });
    return true;
  }

  return false;
}
