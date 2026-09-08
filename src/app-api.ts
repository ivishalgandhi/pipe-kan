import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";

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

export function handleAppApi(
  req: IncomingMessage,
  res: ServerResponse,
  app: App,
): boolean {
  const url = pathOf(req);
  const method = (req.method ?? "GET").toUpperCase();

  if (url.pathname === "/api/board" && method === "GET") {
    json(res, 200, { ...app.board(), flags: app.flags });
    return true;
  }

  if (url.pathname === "/api/refresh" && method === "POST") {
    reply(req, res, async (text) => {
      const body = text ? JSON.parse(text) : {};
      json(res, 200, await app.refresh(body.flags));
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

  return false;
}
