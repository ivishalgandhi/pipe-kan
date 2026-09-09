import type { IncomingMessage, ServerResponse } from "node:http";

import { IssueStore, ME, validIssueKey } from "./store.ts";

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

function childrenJqlError(jql: string): string | undefined {
  const trimmed = jql.trim();
  // Empty IN clause is invalid JQL.
  if (/\bin\s*\(\s*\)/i.test(trimmed)) {
    return "The value '' does not exist for the field 'parent'.";
  }
  // Children queries use parent in (...) or "Epic Link" in (...).
  const childrenMatch = trimmed.match(/(?:parent|"Epic Link")\s+in\s+\(([^)]+)\)/i);
  if (childrenMatch) {
    const values = childrenMatch[1].split(",").map((value) => value.trim().replace(/^["']|["']$/g, ""));
    const invalid = values.filter((value) => !validIssueKey(value));
    if (invalid.length) {
      return `No issues have a parent epic with key or name '${invalid[0]}'.`;
    }
  }
  return undefined;
}

export function handleFakeJira(
  req: IncomingMessage,
  res: ServerResponse,
  store: IssueStore,
): boolean {
  const url = pathOf(req);
  const path = url.pathname;
  const method = (req.method ?? "GET").toUpperCase();

  if (path === "/rest/api/2/myself" || path === "/rest/api/3/myself") {
    json(res, 200, ME);
    return true;
  }

  if (
    (path === "/rest/api/3/search/jql" ||
      path === "/rest/api/2/search" ||
      path === "/rest/api/3/search") &&
    method === "GET"
  ) {
    const jql = url.searchParams.get("jql") ?? "";
    const error = childrenJqlError(jql);
    if (error) {
      json(res, 400, { errorMessages: [error] });
      return true;
    }
    const issues = store.list(jql);
    json(res, 200, { expand: "schema,names", isLast: true, issues });
    return true;
  }

  const transition = path.match(
    /^\/rest\/api\/[23]\/issue\/([^/]+)\/transitions$/,
  );
  if (transition) {
    const key = decodeURIComponent(transition[1]);
    if (method === "GET") {
      if (!store.get(key)) {
        json(res, 404, { errorMessages: [`Issue ${key} not found`] });
        return true;
      }
      json(res, 200, {
        expand: "transitions",
        transitions: store.transitions(key),
      });
      return true;
    }
    if (method === "POST") {
      void readBody(req).then((text) => {
        const body = text ? JSON.parse(text) : {};
        const target = body.transition?.name ?? body.transition?.id ?? "";
        const result = store.move(key, String(target));
        if (!result.ok) {
          json(res, 400, { errorMessages: [result.error] });
          return;
        }
        res.statusCode = 204;
        res.end();
      });
      return true;
    }
  }

  const issueGet = path.match(/^\/rest\/api\/[23]\/issue\/([^/]+)$/);
  if (issueGet && method === "GET") {
    const key = decodeURIComponent(issueGet[1]);
    const issue = store.get(key);
    if (!issue) {
      json(res, 404, { errorMessages: [`Issue ${key} not found`] });
      return true;
    }
    json(res, 200, issue);
    return true;
  }

  const browse = path.match(/^\/browse\/([^/]+)$/);
  if (browse && method === "GET") {
    const key = decodeURIComponent(browse[1]);
    const issue = store.get(key);
    res.statusCode = issue ? 200 : 404;
    res.setHeader("content-type", "text/html; charset=utf-8");
    const fields = issue?.fields;
    const type =
      (fields?.issuetype as { name?: string } | undefined)?.name ??
      (fields?.issueType as { name?: string } | undefined)?.name ??
      "Issue";
    res.end(
      issue
        ? `<!doctype html><html><head><meta charset="utf-8"><title>${issue.key}</title>
<style>
  :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
  body { margin: 0; padding: 1.25rem; }
  .key { font-size: 12px; letter-spacing: .02em; opacity: .7; }
  h1 { font-size: 1.25rem; margin: .35rem 0 1rem; }
  dl { display: grid; grid-template-columns: 7rem 1fr; gap: .4rem 1rem; font-size: 14px; }
  dt { opacity: .65; }
</style></head><body>
  <div class="key">${issue.key} · ${type}</div>
  <h1>${issue.fields.summary}</h1>
  <dl>
    <dt>Status</dt><dd>${issue.fields.status.name}</dd>
    <dt>Assignee</dt><dd>${issue.fields.assignee?.displayName ?? "Unassigned"}</dd>
    <dt>Priority</dt><dd>${(fields?.priority as { name?: string } | undefined)?.name ?? "—"}</dd>
  </dl>
</body></html>`
        : "not found",
    );
    return true;
  }

  return false;
}
