import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";
import { handleAppApi, type SourceSwitchResult } from "./app-api.ts";
import type { Boot } from "./boot.ts";
import { handleAgentApi } from "./server/agent/api.ts";
import { handleFakeJira } from "./fake-jira.ts";
import type { IssueStore } from "./store.ts";

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: {
    app: App;
    store: IssueStore;
    kind?: Boot["kind"];
    env?: NodeJS.ProcessEnv;
    switchSource?: (source: string) => Promise<SourceSwitchResult>;
  },
): boolean {
  if (
    handleAppApi(req, res, ctx.app, { kind: ctx.kind, env: ctx.env, onSource: ctx.switchSource }) ||
    handleAgentApi(req, res, ctx.app)
  ) {
    return true;
  }
  if (ctx.kind !== "plane" && handleFakeJira(req, res, ctx.store)) return true;
  if ((req.url ?? "").split("?")[0].startsWith("/api/")) {
    res.statusCode = 404;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ error: "unknown API route" }));
    return true;
  }
  return false;
}
