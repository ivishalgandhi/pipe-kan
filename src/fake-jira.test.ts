import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

import { IssueStore } from "./store.ts";
import { handleFakeJira } from "./fake-jira.ts";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/issues.json"),
    "utf8",
  ),
);

const servers: { close(): void }[] = [];

afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

async function listen(store: IssueStore) {
  const server = createServer((req, res) => {
    if (!handleFakeJira(req, res, store)) {
      res.statusCode = 404;
      res.end("not fake jira");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return `http://127.0.0.1:${addr.port}`;
}

test("search returns Fixture Issues matching jira-cli default Scope JQL", async () => {
  const base = await listen(IssueStore.fromRaw(fixture));
  const jql = 'project="DEMO" AND assignee="user@test.com" AND status!="Done" ORDER BY created DESC';
  const res = await fetch(
    `${base}/rest/api/3/search/jql?${new URLSearchParams({ jql, maxResults: "100", fields: "*all" })}`,
  );
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.issues.map((issue: { key: string }) => issue.key)).toEqual([
    "DEMO-1",
    "DEMO-2",
    "DEMO-3",
    "DEMO-4",
  ]);
});

test("myself is the Fixture login", async () => {
  const base = await listen(IssueStore.fromRaw(fixture));
  const res = await fetch(`${base}/rest/api/2/myself`);
  expect(await res.json()).toEqual({
    displayName: "Person A",
    emailAddress: "user@test.com",
    name: "user@test.com",
  });
});

test("To Do cannot Move to Done", async () => {
  const store = IssueStore.fromRaw(fixture);
  const base = await listen(store);

  const available = await fetch(`${base}/rest/api/2/issue/DEMO-4/transitions`);
  const transitions = await available.json();
  const done = transitions.transitions.find((t: { name: string }) => t.name === "Done");
  expect(done.isAvailable).toBe(false);

  const move = await fetch(`${base}/rest/api/2/issue/DEMO-4/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transition: { id: "31", name: "Done" } }),
  });
  expect(move.status).toBe(400);
  expect(store.get("DEMO-4")?.fields.status.name).toBe("To Do");
});

test("In Progress can Move to Done", async () => {
  const store = IssueStore.fromRaw(fixture);
  const base = await listen(store);

  const move = await fetch(`${base}/rest/api/2/issue/DEMO-3/transitions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transition: { id: "31", name: "Done" } }),
  });
  expect(move.status).toBe(204);
  expect(store.get("DEMO-3")?.fields.status.name).toBe("Done");
});

test("search returns 400 for empty children IN clause", async () => {
  const base = await listen(IssueStore.fromRaw(fixture));
  const jql = 'project="DEMO" AND (parent in () OR "Epic Link" in ())';
  const res = await fetch(
    `${base}/rest/api/3/search/jql?${new URLSearchParams({ jql, maxResults: "100", fields: "*all" })}`,
  );
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.errorMessages[0]).toMatch(/does not exist for the field/);
});

test("search returns 400 for invalid parent key in children JQL", async () => {
  const base = await listen(IssueStore.fromRaw(fixture));
  const jql = 'project="DEMO" AND (parent in ("DEMO-1", "NOT-A-KEY") OR "Epic Link" in ("DEMO-1", "NOT-A-KEY"))';
  const res = await fetch(
    `${base}/rest/api/3/search/jql?${new URLSearchParams({ jql, maxResults: "100", fields: "*all" })}`,
  );
  expect(res.status).toBe(400);
  const body = await res.json();
  expect(body.errorMessages[0]).toMatch(/No issues have a parent epic/);
});

test("Fake Jira view returns the stored Issue", async () => {
  const store = IssueStore.fromRaw(fixture);
  const base = await listen(store);
  const res = await fetch(`${base}/rest/api/2/issue/DEMO-2`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.key).toBe("DEMO-2");
  expect(body.fields.summary).toBe("Parse jira-cli --raw JSON");
  expect(body.fields.description).toBe("Turn the payload into Columns.");
});
