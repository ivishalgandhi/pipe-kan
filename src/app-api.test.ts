import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vitest";

import { createApp } from "./app.ts";
import { handleAppApi } from "./app-api.ts";
import type { RawIssue } from "./board.ts";
import { createStoreCli, type Cli } from "./cli.ts";
import { createPlaneCli } from "./plane.ts";
import { readTargetEndFieldMap } from "./field-map.ts";
import { IssueStore } from "./store.ts";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/issues.json"),
    "utf8",
  ),
) as RawIssue[];

const servers: { close(): void }[] = [];

afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

async function listen(
  store = IssueStore.fromRaw(fixture),
  cli?: Cli,
  opts: { kind?: "plane" | "jira" | "store"; flags?: string; env?: NodeJS.ProcessEnv } = {},
) {
  const app = createApp({ store, cli, flags: opts.flags });
  await app.refresh();
  const server = createServer((req, res) => {
    if (!handleAppApi(req, res, app, { kind: opts.kind ?? "store", env: opts.env })) {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return { base: `http://127.0.0.1:${addr.port}`, app };
}

async function listenWithApp(app: ReturnType<typeof createApp>) {
  const server = createServer((req, res) => {
    if (!handleAppApi(req, res, app)) {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return { base: `http://127.0.0.1:${addr.port}`, app };
}

test("default Board is the Project", async () => {
  const { base } = await listen();
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.columns.map((c: { title: string }) => c.title)).toEqual([
    "To Do",
    "In Progress",
    "Done",
  ]);
  expect(
    board.columns.flatMap((c: { cards: { key: string }[] }) =>
      c.cards.map((card) => card.key),
    ),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);
  expect(board.epics.map((epic: { key: string }) => epic.key)).toEqual([
    "DEMO-1",
    "DEMO-7",
    "DEMO-8",
  ]);
});

test("successful Move Refresh-es and keeps Done", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-3", status: "Done" }),
  });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(
    body.board.columns.flatMap((c: { cards: { key: string }[] }) =>
      c.cards.map((card) => card.key),
    ),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);
});

test("illegal Move snaps back with jira-cli stderr", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-4", status: "Done" }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("invalid transition state");
  expect(
    body.board.columns.find((c: { title: string }) => c.title === "To Do").cards
      .map((card: { key: string }) => card.key),
  ).toContain("DEMO-4");
});

test("same-Column drop is a no-op", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-2", status: "To Do" }),
  });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.noop).toBe(true);
});

test("raw Move succeeds without Refreshing", async () => {
  const { base, app } = await listen();
  const before = app.board();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-3", status: "Done", raw: true }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body).not.toHaveProperty("board");
  expect(app.board()).toEqual(before);
});

test("raw Move returns failure without Refreshing", async () => {
  const { base, app } = await listen();
  const before = app.board();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-4", status: "Done", raw: true }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("invalid transition state");
  expect(app.board()).toEqual(before);
});

test("raw Move noop for same status", async () => {
  const { base, app } = await listen();
  const before = app.board();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-2", status: "To Do", raw: true }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.noop).toBe(true);
  expect(app.board()).toEqual(before);
});

test("Refresh with Epic flag lists Epic children", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flags: "-P DEMO-1" }),
  });
  const body = await res.json();
  expect(body.columns.flatMap((c: { cards: { key: string }[] }) => c.cards.map((card) => card.key))).toEqual([
    "DEMO-2",
    "DEMO-4",
    "DEMO-3",
    "DEMO-5",
  ]);
});

function trackCli(store = IssueStore.fromRaw(fixture)) {
  const inner = createStoreCli(store);
  const calls: string[][] = [];
  const cli: Cli = {
    list: async (flags) => {
      calls.push(["list", flags]);
      return inner.list(flags);
    },
    listEpics: async (flags) => {
      calls.push(["listEpics"]);
      return inner.listEpics(flags);
    },
    listEpic: async (key, flags) => {
      calls.push(["listEpic", key]);
      return inner.listEpic(key, flags);
    },
    listChildren: async (keys) => {
      calls.push(["listChildren", ...keys]);
      return inner.listChildren(keys);
    },
    move: (key, status) => inner.move(key, status),
    create: (input) => inner.create(input),
    edit: (key, input) => inner.edit(key, input),
    open: (key) => inner.open(key),
    view: (key) => inner.view(key),
  };
  return { cli, calls };
}

test("omitted Refresh scope is all", async () => {
  const store = IssueStore.fromRaw(fixture);
  const { cli, calls } = trackCli(store);
  const { base } = await listen(store, cli);
  calls.length = 0;
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.epics.map((epic: { key: string }) => epic.key)).toEqual([
    "DEMO-1",
    "DEMO-7",
    "DEMO-8",
  ]);
  expect(calls.filter((call) => call[0] === "list")).toHaveLength(1);
  expect(calls.filter((call) => call[0] === "listEpics")).toHaveLength(1);
  expect(calls.filter((call) => call[0] === "listChildren")).toEqual([
    ["listChildren", "DEMO-1", "DEMO-7", "DEMO-8"],
  ]);
});

test("scope all Refresh lists every Epic", async () => {
  const store = IssueStore.fromRaw(fixture);
  const { cli, calls } = trackCli(store);
  const { base } = await listen(store, cli);
  calls.length = 0;
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "all", flags: "" }),
  });
  expect(res.status).toBe(200);
  expect(calls.filter((call) => call[0] === "list")).toHaveLength(1);
  expect(calls.filter((call) => call[0] === "listChildren")).toEqual([
    ["listChildren", "DEMO-1", "DEMO-7", "DEMO-8"],
  ]);
});

test("selected Refresh without epicKeys is 400", async () => {
  const { base } = await listen();
  const empty = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "selected" }),
  });
  expect(empty.status).toBe(400);
  const none = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ scope: "selected", epicKeys: [] }),
  });
  expect(none.status).toBe(400);
});

test("selected Refresh merges that Epic's works without rewriting Scope", async () => {
  const store = IssueStore.fromRaw(fixture);
  const inner = createStoreCli(store);
  const calls: string[][] = [];
  let selected = false;
  const otherChild = {
    key: "DEMO-70",
    fields: {
      summary: "Other epic child",
      status: { name: "To Do" },
      issuetype: { name: "Story" },
      parent: { key: "DEMO-7" },
    },
  };
  const cli: Cli = {
    list: async (flags) => {
      calls.push(["list", flags]);
      return inner.list(flags);
    },
    listEpics: async (flags) => {
      calls.push(["listEpics"]);
      return inner.listEpics(flags);
    },
    listEpic: async (key, flags) => {
      calls.push(["listEpic", key]);
      return inner.listEpic(key, flags);
    },
    listChildren: async (keys) => {
      calls.push(["listChildren", ...keys]);
      if (selected) {
        return JSON.stringify([
          {
            key: "DEMO-2",
            fields: {
              summary: "Updated child",
              status: { name: "To Do" },
              issuetype: { name: "Story" },
              parent: { key: "DEMO-1" },
            },
          },
        ]);
      }
      const listed = JSON.parse(await inner.listChildren(keys)) as unknown[];
      return JSON.stringify([...listed, otherChild]);
    },
    move: (key, status) => inner.move(key, status),
    create: (input) => inner.create(input),
    edit: (key, input) => inner.edit(key, input),
    open: (key) => inner.open(key),
    view: (key) => inner.view(key),
  };
  const { base, app } = await listen(store, cli);
  expect(childKeys(app.board())).toEqual(["DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5", "DEMO-70"]);
  selected = true;
  calls.length = 0;
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      scope: "selected",
      epicKeys: ["DEMO-1"],
      flags: "-pDEMO",
    }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(calls.filter((call) => call[0] === "list")).toEqual([]);
  expect(calls.filter((call) => call[0] === "listEpics")).toEqual([]);
  expect(calls.filter((call) => call[0] === "listChildren")).toEqual([["listChildren", "DEMO-1"]]);
  expect(childKeys(body)).toEqual(["DEMO-2", "DEMO-70"]);
  expect(
    body.columns.flatMap((c: { cards: { key: string }[] }) => c.cards.map((card) => card.key)),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);
  expect(app.flags).toBe("");
});

test("Open returns the browse URL and flattened fields", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-2" }),
  });
  const body = await res.json();
  expect(body.url).toBe("/browse/DEMO-2");
  expect(body.fields[0]).toEqual({ label: "Key", value: "DEMO-2" });
  expect(body.fields.find((field: { label: string }) => field.label === "Summary")?.value).toBe(
    "Parse jira-cli --raw JSON",
  );
  expect(body.fields.find((field: { label: string }) => field.label === "Description")?.value).toBe(
    "Turn the payload into Columns.",
  );
  expect(body.fields.some((field: { label: string }) => /comment/i.test(field.label))).toBe(false);
});

test("Open keeps the URL and an error when view fails", async () => {
  const store = IssueStore.fromRaw(fixture);
  const { base } = await listen(store, {
    list: async () => JSON.stringify(fixture),
    listEpics: async () => "[]",
    listEpic: async () => "[]",
    listChildren: async () => "[]",
    move: async () => ({ ok: true }),
    create: async () => ({ ok: false, error: "not implemented" }),
    edit: async () => ({ ok: false, error: "not implemented" }),
    open: async (key) => `/browse/${key}`,
    view: async () => {
      throw new Error("jira issue view failed");
    },
  });
  const res = await fetch(`${base}/api/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-2" }),
  });
  const body = await res.json();
  expect(body.url).toBe("/browse/DEMO-2");
  expect(body.fields).toEqual([]);
  expect(body.error).toBe("jira issue view failed");
});

test("Refresh maps Target End from jira-cli config when view-raw has no names", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-jira-cfg-"));
  const yamlPath = join(dir, ".config.yml");
  const mapPath = join(dir, "field-map.json");
  writeFileSync(
    yamlPath,
    `
issue:
    fields:
        custom:
            -
                name: Target Start
                key: customfield_10101
            -
                name: Target End Date
                key: customfield_10100
`,
  );
  const listed = [
    {
      key: "DEMO-2",
      fields: {
        summary: "Thin list",
        status: { name: "To Do" },
        created: "2026-09-01T10:00:00.000+0000",
      },
    },
  ];
  const viewRaw = {
    key: "DEMO-2",
    fields: {
      summary: "Thin list",
      status: { name: "To Do" },
      created: "2026-09-01T10:00:00.000+0000",
      customfield_10100: "2026-10-20",
      customfield_10101: "2026-01-15",
    },
  };
  const cli: Cli = {
    list: async () => JSON.stringify(listed),
    listEpics: async () => "[]",
    listEpic: async () => "[]",
    listChildren: async () => "[]",
    move: async () => ({ ok: true }),
    create: async () => ({ ok: false, error: "not implemented" }),
    edit: async () => ({ ok: false, error: "not implemented" }),
    open: async (key) => `/browse/${key}`,
    view: async () => JSON.stringify(viewRaw),
  };
  const app = createApp({
    store: IssueStore.fromRaw(listed),
    cli,
    jiraConfigPath: yamlPath,
    fieldMapPath: mapPath,
  });
  await app.refresh();
  expect(app.board().columns[0]?.cards[0]?.targetEnd).toBe("2026-10-20");
  expect(readTargetEndFieldMap(mapPath).targetEnd).toBe("customfield_10100");
});

test("Epic children keep the Epic key", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/epic`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1" }),
  });
  const body = await res.json();
  expect(
    body.columns.flatMap((c: { cards: { key: string; epic?: string }[] }) =>
      c.cards.map((card) => [card.key, card.epic]),
    ),
  ).toEqual([
    ["DEMO-2", "DEMO-1"],
    ["DEMO-4", "DEMO-1"],
    ["DEMO-3", "DEMO-1"],
    ["DEMO-5", "DEMO-1"],
  ]);
});

test("Board.epics come from the Epic list, not only Scope", async () => {
  const cli: Cli = {
    async list() {
      return JSON.stringify([
        {
          key: "SQLJIRA-2",
          fields: {
            summary: "Story",
            status: { name: "Proposed" },
            issuetype: { name: "Story" },
          },
        },
      ]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "SQLJIRA-1",
          fields: {
            summary: "One",
            status: { name: "In Development" },
            issuetype: { name: "Epic" },
          },
        },
        {
          key: "SQLJIRA-9",
          fields: {
            summary: "Nine",
            status: { name: "Proposed" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      return "[]";
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.epics.map((epic: { key: string }) => epic.key)).toEqual([
    "SQLJIRA-1",
    "SQLJIRA-9",
  ]);
});

function childKeys(board: { children?: Record<string, { key: string }[]> }) {
  return Object.values(board.children ?? {})
    .flat()
    .map((card) => card.key)
    .sort();
}

test("store hydrate fills the children cache", () => {
  const raw = [
    {
      key: "DEMO-1",
      fields: {
        summary: "Epic",
        status: { name: "To Do" },
        issuetype: { name: "Epic" },
      },
    },
    {
      key: "DEMO-2",
      fields: {
        summary: "In scope",
        status: { name: "To Do" },
        issuetype: { name: "Story" },
        parent: { key: "DEMO-1" },
      },
    },
    {
      key: "DEMO-3",
      fields: {
        summary: "Outside scope",
        status: { name: "Done" },
        issuetype: { name: "Story" },
        parent: { key: "DEMO-1" },
      },
    },
  ];
  const app = createApp({ store: IssueStore.fromRaw(raw) });
  const board = app.hydrate([raw[1]], { fromStore: true });
  expect(board.columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual(["DEMO-2"]);
  expect(childKeys(board)).toEqual(["DEMO-2", "DEMO-3"]);
});

test("Pipe hydrate has no children cache", () => {
  const app = createApp({ store: IssueStore.fromRaw(fixture) });
  const board = app.hydrate(fixture);
  expect(board.children).toBeUndefined();
});

test("Refresh fills the children cache from one batched list", async () => {
  const calls: string[][] = [];
  const cli: Cli = {
    async list() {
      calls.push(["list"]);
      return JSON.stringify([
        {
          key: "DEMO-2",
          fields: {
            summary: "In scope",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async listEpics() {
      calls.push(["listEpics"]);
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      calls.push(["listEpic"]);
      return "[]";
    },
    async listChildren(keys) {
      calls.push(["listChildren", ...keys]);
      return JSON.stringify([
        {
          key: "DEMO-2",
          fields: {
            summary: "In scope",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
        {
          key: "DEMO-3",
          fields: {
            summary: "Outside scope",
            status: { name: "Done" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.columns.flatMap((c: { cards: { key: string }[] }) => c.cards.map((card) => card.key))).toEqual([
    "DEMO-2",
  ]);
  expect(childKeys(board)).toEqual(["DEMO-2", "DEMO-3"]);
  expect(calls.filter((call) => call[0] === "listChildren")).toEqual([["listChildren", "DEMO-1"]]);
  expect(calls.filter((call) => call[0] === "listEpic")).toEqual([]);
});

test("a failed children call keeps the Board and falls counts back", async () => {
  const cli: Cli = {
    async list() {
      return JSON.stringify([
        {
          key: "DEMO-2",
          fields: {
            summary: "In scope",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      throw new Error("children list failed");
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.columns.flatMap((c: { cards: { key: string }[] }) => c.cards.map((card) => card.key))).toEqual([
    "DEMO-2",
  ]);
  expect(board.children).toBeUndefined();
  expect(board.error).toBe("children list failed");
});

test("Refresh keeps the last Board until children land", async () => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const cli: Cli = {
    async list() {
      return JSON.stringify([
        {
          key: "WORK-2",
          fields: {
            summary: "Work story",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "WORK-1" },
          },
        },
      ]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "WORK-1",
          fields: {
            summary: "Work epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      await gate;
      return JSON.stringify([
        {
          key: "WORK-2",
          fields: {
            summary: "Work story",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "WORK-1" },
          },
        },
      ]);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli });
  app.hydrate(fixture, { fromStore: true });
  const pending = app.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  const mid = app.board();
  expect(mid.epics.map((epic) => epic.key)).toEqual(["DEMO-1", "DEMO-7", "DEMO-8"]);
  expect(childKeys(mid)).toEqual(["DEMO-2", "DEMO-3", "DEMO-4", "DEMO-5"]);
  release();
  const done = await pending;
  expect(done.epics.map((epic) => epic.key)).toEqual(["WORK-1"]);
  expect(childKeys(done)).toEqual(["WORK-2"]);
});

test("a failed children refresh keeps previously cached children", async () => {
  let childrenCalls = 0;
  const child = {
    key: "WORK-2",
    fields: {
      summary: "Work story",
      status: { name: "To Do" },
      issuetype: { name: "Story" },
      parent: { key: "WORK-1" },
    },
  };
  const cli: Cli = {
    async list() {
      return JSON.stringify([child]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "WORK-1",
          fields: {
            summary: "Work epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      childrenCalls += 1;
      if (childrenCalls > 1) throw new Error("children 400");
      return JSON.stringify([child]);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli });
  const first = await app.refresh();
  expect(childKeys(first)).toEqual(["WORK-2"]);
  expect(first.error).toBeUndefined();
  const second = await app.refresh();
  expect(childKeys(second)).toEqual(["WORK-2"]);
  expect(second.error).toBe("children 400");
});

test("Refresh of 220 Epics does not list each Epic when Epic Link is missing", async () => {
  const calls: string[] = [];
  const epics = Array.from({ length: 220 }, (_, n) => ({
    key: `DEMO-${n + 1}`,
    fields: {
      summary: `Epic ${n + 1}`,
      status: { name: "To Do" },
      issuetype: { name: "Epic" },
    },
  }));
  const unmapped = epics.map((_, n) => ({
    key: `STORY-${n + 1}`,
    fields: {
      summary: `Story ${n + 1}`,
      status: { name: "To Do" },
      issuetype: { name: "Story" },
    },
  }));
  const cli: Cli = {
    async list() {
      return "[]";
    },
    async listEpics() {
      return JSON.stringify(epics);
    },
    async listEpic(key) {
      calls.push(`listEpic:${key}`);
      return "[]";
    },
    async listChildren() {
      calls.push("listChildren");
      return JSON.stringify(unmapped);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli });
  const started = Date.now();
  const board = await app.refresh();
  expect(board.epics).toHaveLength(220);
  expect(calls.filter((call) => call === "listChildren")).toEqual(["listChildren"]);
  expect(calls.filter((call) => call.startsWith("listEpic"))).toEqual([]);
  expect(Date.now() - started).toBeLessThan(1000);
});

test("a failed Issues list keeps the last Board", async () => {
  let lists = 0;
  const cli: Cli = {
    async list() {
      lists += 1;
      if (lists > 1) throw new Error("Unexpected response '429' from jira");
      return JSON.stringify([
        {
          key: "DEMO-2",
          fields: {
            summary: "In scope",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      return "[]";
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli });
  await app.refresh();
  const board = await app.refresh();
  expect(board.error).toMatch(/429/);
  expect(app.board().error).toMatch(/429/);
  expect(board.columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual(["DEMO-2"]);
  expect(board.epics.map((epic) => epic.key)).toEqual(["DEMO-1"]);
  const persisted = await (await fetch((await listenWithApp(app)).base + "/api/board")).json();
  expect(persisted.error).toMatch(/429/);
  expect(
    persisted.columns.flatMap((column: { cards: { key: string }[] }) =>
      column.cards.map((card) => card.key),
    ),
  ).toEqual(["DEMO-2"]);
});

test("a failed first Refresh does not keep the Fixture as the live Board", async () => {
  const cli: Cli = {
    ...createStoreCli(IssueStore.fromRaw(fixture)),
    async list() {
      throw new Error("Plane 429: RATE_LIMIT_EXCEEDED");
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli });
  app.hydrate(fixture, { fromStore: true });
  expect(
    app.board().columns.flatMap((column) => column.cards.map((card) => card.key)),
  ).toContain("DEMO-2");
  const board = await app.refresh();
  expect(board.error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(board.columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
  expect(app.board().error).toMatch(/429/);
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
});

test("select falls back to listEpic when cached children lost their Epic key", async () => {
  const calls: string[] = [];
  const unmapped = [
    {
      key: "DEMO-9",
      fields: {
        summary: "Linked only in Jira",
        status: { name: "To Do" },
        issuetype: { name: "Story" },
      },
    },
  ];
  const cli: Cli = {
    async list() {
      return JSON.stringify([]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic(key) {
      calls.push(`listEpic:${key}`);
      return JSON.stringify(unmapped);
    },
    async listChildren() {
      calls.push("listChildren");
      return JSON.stringify(unmapped);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(childKeys(board)).toEqual([]);
  const res = await fetch(`${base}/api/epic`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1" }),
  });
  const body = await res.json();
  expect(
    body.columns.flatMap((c: { cards: { key: string; epic?: string }[] }) =>
      c.cards.map((card) => [card.key, card.epic]),
    ),
  ).toEqual([["DEMO-9", "DEMO-1"]]);
  expect(calls.filter((call) => call.startsWith("listEpic"))).toEqual(["listEpic:DEMO-1"]);
});

test("select returns empty columns for an epic not in the current list", async () => {
  const calls: string[] = [];
  const cli: Cli = {
    async list() {
      return JSON.stringify([]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic(key) {
      calls.push(`listEpic:${key}`);
      return "[]";
    },
    async listChildren() {
      return "[]";
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const res = await fetch(`${base}/api/epic`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-99" }),
  });
  const body = await res.json();
  expect(body.columns).toEqual([]);
  expect(body.epics).toEqual([]);
  expect(calls).toEqual([]);
});

test("Refresh without epics still shows story columns", async () => {
  const cli: Cli = {
    async list() {
      return JSON.stringify([
        {
          key: "SQL-1",
          fields: {
            summary: "SQL story",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
          },
        },
      ]);
    },
    async listEpics() {
      return "[]";
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      return "[]";
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw([]), cli);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.columns.map((c: { title: string }) => c.title)).toEqual(["To Do"]);
  expect(board.columns[0].cards.map((card: { key: string }) => card.key)).toEqual(["SQL-1"]);
  expect(board.epics).toEqual([]);
});

test("select lists Epic children when the cache has none for that key", async () => {
  const calls: string[] = [];
  const cli: Cli = {
    async list() {
      return JSON.stringify([]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic(key) {
      calls.push(`listEpic:${key}`);
      return JSON.stringify([
        {
          key: "DEMO-9",
          fields: {
            summary: "Outside the first page",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async listChildren() {
      return JSON.stringify([]);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const res = await fetch(`${base}/api/epic`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1" }),
  });
  const body = await res.json();
  expect(
    body.columns.flatMap((c: { cards: { key: string; epic?: string }[] }) =>
      c.cards.map((card) => [card.key, card.epic]),
    ),
  ).toEqual([["DEMO-9", "DEMO-1"]]);
  expect(calls).toEqual(["listEpic:DEMO-1"]);
});

test("select stamps cached children without a second list", async () => {
  const calls: string[] = [];
  const cli: Cli = {
    async list() {
      return JSON.stringify([]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "To Do" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      calls.push("listEpic");
      return "[]";
    },
    async listChildren() {
      return JSON.stringify([
        {
          key: "DEMO-9",
          fields: {
            summary: "Cached",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async move() {
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const res = await fetch(`${base}/api/epic`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1" }),
  });
  const body = await res.json();
  expect(
    body.columns.flatMap((c: { cards: { key: string; epic?: string }[] }) =>
      c.cards.map((card) => [card.key, card.epic]),
    ),
  ).toEqual([["DEMO-9", "DEMO-1"]]);
  expect(calls).toEqual([]);
});

test("same-status Epic Move is a no-op", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1", status: "In Progress" }),
  });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.noop).toBe(true);
});

test("Epic Move Refreshes and leaves children on the Board", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1", status: "Done" }),
  });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.board.epics.find((epic: { key: string }) => epic.key === "DEMO-1")?.status).toBe("Done");
  expect(
    body.board.columns.flatMap((c: { cards: { key: string }[] }) => c.cards.map((card) => card.key)),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);
});

test("Fixture lists Epics in To Do, In Progress, and Done", async () => {
  const { base } = await listen();
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(
    board.epics.map((epic: { key: string; status?: string }) => [epic.key, epic.status]),
  ).toEqual([
    ["DEMO-1", "In Progress"],
    ["DEMO-7", "To Do"],
    ["DEMO-8", "Done"],
  ]);
});

test("Open returns the browse URL and fields for an Epic", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/open`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1" }),
  });
  const body = await res.json();
  expect(body.url).toBe("/browse/DEMO-1");
  expect(body.fields[0]).toEqual({ label: "Key", value: "DEMO-1" });
  expect(body.fields.find((field: { label: string }) => field.label === "Summary")?.value).toBe(
    "Ship a local kanban",
  );
});

test("same-status Epic Move noops when the Epic is only listed", async () => {
  let moved = 0;
  const cli: Cli = {
    async list() {
      return JSON.stringify([
        {
          key: "DEMO-2",
          fields: {
            summary: "Story",
            status: { name: "To Do" },
            issuetype: { name: "Story" },
            parent: { key: "DEMO-1" },
          },
        },
      ]);
    },
    async listEpics() {
      return JSON.stringify([
        {
          key: "DEMO-1",
          fields: {
            summary: "Epic",
            status: { name: "In Progress" },
            issuetype: { name: "Epic" },
          },
        },
      ]);
    },
    async listEpic() {
      return "[]";
    },
    async listChildren() {
      return "[]";
    },
    async move() {
      moved += 1;
      return { ok: true };
    },
    async create() {
      return { ok: false, error: "not implemented" };
    },
    async edit() {
      return { ok: false, error: "not implemented" };
    },
    async open() {
      return "/browse/X";
    },
    async view() {
      return JSON.stringify({ key: "X", fields: {} });
    },
  };
  const { base } = await listen(IssueStore.fromRaw(fixture), cli);
  const res = await fetch(`${base}/api/move`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-1", status: "In Progress" }),
  });
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.noop).toBe(true);
  expect(moved).toBe(0);
});

test("successful create Refresh-es and returns the new key", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/issue/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: "New card",
      labels: ["kanban"],
      status: "To Do",
    }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.key).toBe("DEMO-9");
  expect(
    body.board.columns
      .find((c: { title: string }) => c.title === "To Do")
      .cards.map((card: { key: string }) => card.key),
  ).toContain("DEMO-9");
});

test("empty summary create is a 409", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/issue/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "" }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("summary is required");
});

test("edit updates summary description and labels", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/issue/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key: "DEMO-2",
      summary: "Edited",
      description: "New body",
      labels: ["parser"],
    }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  const open = await (
    await fetch(`${base}/api/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "DEMO-2" }),
    })
  ).json();
  expect(open.fields.find((field: { label: string }) => field.label === "Summary")?.value).toBe(
    "Edited",
  );
  expect(open.fields.find((field: { label: string }) => field.label === "Description")?.value).toBe(
    "New body",
  );
  expect(open.fields.find((field: { label: string }) => field.label === "Labels")?.pills).toEqual([
    "parser",
  ]);
});

test("edit missing key is a 409", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/issue/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-404", summary: "Nope" }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("not found");
});

function keysOf(board: { columns: { cards: { key: string }[] }[] }) {
  return board.columns.flatMap((column) => column.cards.map((card) => card.key));
}

test("create with parent and status lands on the Board under that Epic", async () => {
  const { base } = await listen();
  const res = await fetch(`${base}/api/issue/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: "Child of epic",
      description: "Body",
      labels: ["kanban"],
      status: "To Do",
      parent: "DEMO-1",
    }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.ok).toBe(true);
  expect(body.key).toBe("DEMO-9");
  const created = body.board.columns
    .find((c: { title: string }) => c.title === "To Do")
    .cards.find((card: { key: string }) => card.key === "DEMO-9");
  expect(created.epic).toBe("DEMO-1");
});

test("failed create is a 409 and leaves the Board unchanged", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async create() {
      return { ok: false, error: "jira refused" };
    },
  };
  const { base } = await listen(store, cli);
  const before = keysOf(await (await fetch(`${base}/api/board`)).json());
  const res = await fetch(`${base}/api/issue/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "Nope", labels: ["kanban"] }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("jira refused");
  expect(keysOf(body.board)).toEqual(before);
  expect(keysOf(await (await fetch(`${base}/api/board`)).json())).toEqual(before);
});

test("failed edit is a 409 and leaves the Issue unchanged", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async edit() {
      return { ok: false, error: "jira edit refused" };
    },
  };
  const { base } = await listen(store, cli);
  const res = await fetch(`${base}/api/issue/edit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key: "DEMO-2", summary: "Edited" }),
  });
  const body = await res.json();
  expect(res.status).toBe(409);
  expect(body.ok).toBe(false);
  expect(body.error).toContain("jira edit refused");
  const open = await (
    await fetch(`${base}/api/open`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "DEMO-2" }),
    })
  ).json();
  expect(open.fields.find((field: { label: string }) => field.label === "Summary")?.value).toBe(
    "Parse jira-cli --raw JSON",
  );
});

test("POST /api/refresh 429 persists on GET /api/board without Fixture cards", async () => {
  const cli: Cli = {
    ...createStoreCli(IssueStore.fromRaw(fixture)),
    async list() {
      throw new Error("Plane 429: RATE_LIMIT_EXCEEDED");
    },
  };
  const app = createApp({ store: IssueStore.fromRaw(fixture), cli, liveBackend: true });
  app.hydrate(fixture, { fromStore: true });
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
  const { base } = await listenWithApp(app);
  const refresh = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flags: "--plane" }),
  });
  const refreshed = await refresh.json();
  expect(refresh.status).toBe(200);
  expect(refreshed.error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(refreshed.columns.flatMap((column: { cards: { key: string }[] }) => column.cards.map((card) => card.key))).toEqual([]);
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(board.columns.flatMap((column: { cards: { key: string }[] }) => column.cards.map((card) => card.key))).toEqual([]);
});

test("store Board JSON reports kind store and omits workspace", async () => {
  const { base } = await listen();
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("store");
  expect(board).not.toHaveProperty("workspace");
  expect(board).not.toHaveProperty("workspaces");
});

test("Jira Board JSON reports kind jira and omits workspace", async () => {
  const { base } = await listen(undefined, undefined, { kind: "jira" });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("jira");
  expect(board).not.toHaveProperty("workspace");
  expect(board).not.toHaveProperty("workspaces");
});

test("Board kind is boot kind not --plane in Scope flags", async () => {
  const { base } = await listen(undefined, undefined, {
    kind: "store",
    flags: "--plane --workspace team",
    env: {},
  });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("store");
  expect(board).not.toHaveProperty("workspace");
  expect(board).not.toHaveProperty("workspaces");
});

test("Plane Board JSON reports workspace from flags", async () => {
  const { base } = await listen(undefined, undefined, {
    kind: "plane",
    flags: "--workspace team",
    env: { PLANE_WORKSPACE: "from-env" },
  });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("plane");
  expect(board.workspace).toBe("team");
  expect(board).not.toHaveProperty("workspaces");
});

test("Plane Board JSON reports workspace from env when flags omit it", async () => {
  const { base } = await listen(undefined, undefined, {
    kind: "plane",
    flags: "--plane",
    env: { PLANE_WORKSPACE: "team" },
  });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("plane");
  expect(board.workspace).toBe("team");
  expect(board).not.toHaveProperty("workspaces");
});

test("Plane Board JSON reports personal when flags and env omit workspace", async () => {
  const { base } = await listen(undefined, undefined, {
    kind: "plane",
    flags: "--plane",
    env: {},
  });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("plane");
  expect(board.workspace).toBe("personal");
  expect(board).not.toHaveProperty("workspaces");
});

test("Plane Refresh-all JSON reports workspace after flags change", async () => {
  const { base } = await listen(undefined, undefined, {
    kind: "plane",
    flags: "--plane",
    env: {},
  });
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flags: "--plane --workspace other" }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.kind).toBe("plane");
  expect(body.workspace).toBe("other");
  expect(body).not.toHaveProperty("workspaces");
});

test("Plane Board JSON includes workspaces when the probe returns a list", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async listWorkspaces() {
      return [{ id: "ws-team", name: "Team", slug: "team" }];
    },
  };
  const { base } = await listen(store, cli, { kind: "plane", flags: "--plane", env: {} });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("plane");
  expect(board.workspaces).toEqual([{ id: "ws-team", name: "Team", slug: "team" }]);
});

test("Plane Refresh JSON includes workspaces when the probe returns a list", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async listWorkspaces() {
      return [{ id: "ws-other", name: "Other", slug: "other" }];
    },
  };
  const { base } = await listen(store, cli, { kind: "plane", flags: "--plane", env: {} });
  const res = await fetch(`${base}/api/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ flags: "--plane --workspace other" }),
  });
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.workspaces).toEqual([{ id: "ws-other", name: "Other", slug: "other" }]);
});

test("Plane Board JSON omits workspaces when the probe list is empty", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async listWorkspaces() {
      return [];
    },
  };
  const { base } = await listen(store, cli, { kind: "plane", flags: "--plane", env: {} });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("plane");
  expect(board).not.toHaveProperty("workspaces");
});

test("a failing list-workspaces probe still loads the Board", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async listWorkspaces() {
      throw new Error("probe down");
    },
  };
  const { base } = await listen(store, cli, { kind: "plane", flags: "--plane", env: {} });
  const res = await fetch(`${base}/api/board`);
  const board = await res.json();
  expect(res.status).toBe(200);
  expect(board.kind).toBe("plane");
  expect(board).not.toHaveProperty("workspaces");
});

test("Jira Board omits workspaces even when a list helper exists", async () => {
  const store = IssueStore.fromRaw(fixture);
  const cli: Cli = {
    ...createStoreCli(store),
    async listWorkspaces() {
      return [{ id: "ws-team", name: "Team", slug: "team" }];
    },
  };
  const { base } = await listen(store, cli, { kind: "jira" });
  const board = await (await fetch(`${base}/api/board`)).json();
  expect(board.kind).toBe("jira");
  expect(board).not.toHaveProperty("workspaces");
});

test("project identifier read for other hits that Workspace catalog unscoped", async () => {
  const calls: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const path = url.pathname.replace(/\/+$/, "") || "/";
    calls.push(path);
    const parts = path.split("/").filter(Boolean);
    if (parts[2] === "users" && parts[4] === "workspaces") return new Response("missing", { status: 404 });
    if (parts[2] === "workspaces" && !parts[3]) return new Response("missing", { status: 404 });
    if (/\/workspaces\/[^/]+\/projects$/.test(path)) {
      const slug = parts[3];
      const rows =
        slug === "other"
          ? [
              { id: "proj-other", identifier: "DEC", name: "Decisions" },
              { id: "proj-aph", identifier: "APH", name: "Aphrodite" },
            ]
          : [{ id: "proj-aph", identifier: "APH", name: "Aphrodite" }];
      return new Response(JSON.stringify({ results: rows, next_page_results: false }), {
        headers: { "content-type": "application/json" },
      });
    }
    if (["states", "labels", "modules", "work-items"].includes(parts[6] ?? "")) {
      return new Response(JSON.stringify({ results: [], next_page_results: false }), {
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(`unhandled ${path}`, { status: 404 });
  };
  const cli = createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    flags: "--plane --projects APH",
    fetch: fetchFn,
    retryDelayMs: 0,
  });
  const store = IssueStore.fromRaw(fixture);
  const { base, app } = await listen(store, cli, {
    kind: "plane",
    flags: "--plane --projects APH",
    env: {},
  });
  const before = app.board();
  const res = await fetch(`${base}/api/projects?workspace=other`);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.projects).toEqual(["DEC", "APH"]);
  expect(app.board()).toEqual(before);
  expect(calls.some((url) => url.includes("/workspaces/other/projects"))).toBe(true);
});
