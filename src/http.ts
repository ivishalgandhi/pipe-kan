import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";
import { handleAppApi } from "./app-api.ts";
import { handleAgentApi } from "./server/agent/api.ts";
import { handleFakeJira } from "./fake-jira.ts";
import type { IssueStore } from "./store.ts";

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { app: App; store: IssueStore },
): boolean {
  return handleAppApi(req, res, ctx.app) || handleAgentApi(req, res) || handleFakeJira(req, res, ctx.store);
}
