import type { IncomingMessage, ServerResponse } from "node:http";

import type { App } from "./app.ts";
import { handleAppApi } from "./app-api.ts";
import type { Boot } from "./boot.ts";
import { handleAgentApi } from "./server/agent/api.ts";
import { handleFakeJira } from "./fake-jira.ts";
import type { IssueStore } from "./store.ts";

export function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: { app: App; store: IssueStore; kind: Boot["kind"] },
): boolean {
  return (
    handleAppApi(req, res, ctx.app, { kind: ctx.kind }) ||
    handleAgentApi(req, res, ctx.app) ||
    handleFakeJira(req, res, ctx.store)
  );
}
