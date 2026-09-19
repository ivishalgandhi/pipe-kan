import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import type { RawIssue } from "./board.ts";
import { issuesToBoard } from "./board.ts";
import { createBoardApp, refreshFromJira } from "./boot.ts";
import { handleRequest } from "./http.ts";
import {
  createPlaneCli,
  moduleToIssue,
  orderStateNames,
  planeApiBase,
  planeHost,
  planeModuleKey,
  planeWorkItemKey,
  planeWorkspace,
  titleCasePriority,
  workItemToIssue,
} from "./plane.ts";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/issues.json"),
    "utf8",
  ),
) as RawIssue[];

const AUTH = "aaaaaaaa-bbbb-cccc-dddd-00000000abcd";
const APH = "proj-aph";
const PULSE = "proj-pulse";
const OTHER = "proj-other";
const ST_BACKLOG = "st-backlog";
const ST_TODO = "st-todo";
const ST_PROGRESS = "st-progress";
const ST_DONE = "st-done";
const LBL_NEEDS = "lbl-needs";
const WI_LOGIN = "wi-login";
const WI_EMPTY = "wi-empty";
const WI_PULSE = "wi-pulse";
const WI_OTHER = "wi-other";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function page(results: unknown[]) {
  return { results, next_page_results: false, next_cursor: "" };
}

const MOD_TWO = "mod-two";

function fakePlane(opts: { issuesOnly?: boolean; join?: boolean } = {}) {
  const calls: { method: string; url: string; body?: unknown; key?: string | null }[] = [];
  let loginState = ST_PROGRESS;
  let createdSeq = 40;

  const projects = [
    { id: APH, identifier: "APH", name: "Aphrodite" },
    { id: PULSE, identifier: "PULSE", name: "Pulse" },
    { id: OTHER, identifier: "DEC", name: "Decisions" },
  ];
  const states = [
    { id: ST_BACKLOG, name: "Backlog", group: "backlog", sequence: 1 },
    { id: ST_TODO, name: "Todo", group: "unstarted", sequence: 2 },
    { id: ST_PROGRESS, name: "In Progress", group: "started", sequence: 3 },
    { id: ST_DONE, name: "Done", group: "completed", sequence: 4 },
  ];
  const labels = [{ id: LBL_NEEDS, name: "needs-input" }];
  const modules = [
    { id: AUTH, name: "Auth", status: "in_progress", created_at: "2026-09-01T00:00:00Z" },
    ...(opts.join
      ? [{ id: MOD_TWO, name: "Two", status: "planned", created_at: "2026-09-01T00:00:00Z" }]
      : []),
  ];

  function workItems(projectId: string) {
    const rows = [
      {
        id: WI_LOGIN,
        name: "Login form",
        sequence_id: 12,
        priority: "high",
        state: { id: loginState, name: states.find((state) => state.id === loginState)?.name },
        labels: [LBL_NEEDS],
        label_details: [{ id: LBL_NEEDS, name: "needs-input" }],
        ...(opts.join ? {} : { module_ids: [AUTH] }),
        assignees: [{ display_name: "Ada" }],
        created_at: "2026-09-02T00:00:00Z",
        target_date: "2026-09-20",
        project: APH,
      },
      {
        id: WI_EMPTY,
        name: "Unscoped chore",
        sequence_id: 13,
        state: { id: ST_TODO, name: "Todo" },
        labels: [],
        ...(opts.join ? {} : { module_ids: [] }),
        project: APH,
      },
      {
        id: WI_PULSE,
        name: "Pulse card",
        sequence_id: 1,
        state: { id: ST_PROGRESS, name: "In Progress" },
        labels: [],
        ...(opts.join ? {} : { module_ids: [] }),
        project: PULSE,
      },
      {
        id: WI_OTHER,
        name: "Out of scope",
        sequence_id: 9,
        state: { id: ST_TODO, name: "Todo" },
        labels: [],
        ...(opts.join ? {} : { module_ids: [] }),
        project: OTHER,
      },
    ];
    return rows.filter((row) => row.project === projectId);
  }

  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const key = new Headers(init?.headers).get("X-API-Key");
    let body: unknown;
    if (init?.body) {
      body = JSON.parse(String(init.body));
    }
    calls.push({ method, url: url.pathname, body, key });
    if (key !== "test-key") {
      return jsonResponse({ detail: "authentication failed" }, 401);
    }

    const path = url.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);
    // /api/v1/workspaces/personal/projects/...
    const resource = opts.issuesOnly ? "issues" : "work-items";

    if (method === "GET" && /\/workspaces\/[^/]+\/projects$/.test(path)) {
      return jsonResponse(page(projects));
    }

    const projectId = parts[5];
    const collection = parts[6];
    const itemId = parts[7];

    if (method === "GET" && collection === "states") return jsonResponse(page(states));
    if (method === "GET" && collection === "labels") return jsonResponse(page(labels));
    if (method === "GET" && collection === "modules" && !itemId) {
      return jsonResponse(page(projectId === APH ? modules : []));
    }
    if (method === "GET" && collection === "modules" && parts[8] === "module-issues") {
      return jsonResponse(page([{ issue: WI_LOGIN, module: AUTH }]));
    }
    if (method === "GET" && collection === resource && !itemId) {
      return jsonResponse(page(workItems(projectId)));
    }
    if (method === "GET" && collection === "work-items" && opts.issuesOnly) {
      return new Response("gone", { status: 404 });
    }
    if (method === "GET" && parts[4] === resource && parts[5] && !parts[6]) {
      const ident = parts[5];
      const [prefix, seq] = ident.split("-");
      const project = projects.find((row) => row.identifier === prefix);
      const item = project
        ? workItems(project.id).find((row) => String(row.sequence_id) === seq)
        : undefined;
      return item ? jsonResponse(item) : new Response("missing", { status: 404 });
    }
    if (method === "PATCH" && collection === resource && itemId) {
      if (itemId === WI_LOGIN && body && typeof body === "object" && "state" in body) {
        loginState = String((body as { state: string }).state);
      }
      return jsonResponse({ id: itemId, ...(typeof body === "object" ? body : {}) });
    }
    if (method === "PATCH" && collection === "modules" && itemId) {
      return jsonResponse({ id: itemId, ...(typeof body === "object" ? body : {}) });
    }
    if (method === "POST" && collection === resource && !itemId) {
      createdSeq += 1;
      return jsonResponse({
        id: `wi-new-${createdSeq}`,
        sequence_id: createdSeq,
        name: (body as { name?: string } | undefined)?.name,
      }, 201);
    }
    if (method === "POST" && parts[8] === "module-issues") {
      return jsonResponse([{ module: AUTH, issue: "wi-new" }], 201);
    }
    return new Response(`unhandled ${method} ${path}`, { status: 404 });
  };

  return {
    fetch: fetchImpl,
    calls() {
      return calls;
    },
    moduleKey: planeModuleKey("APH", AUTH),
  };
}

function planeCli(flags = "--plane --projects APH,PULSE", fetch = fakePlane().fetch) {
  return createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    workspace: "personal",
    flags,
    fetch,
    retryDelayMs: 0,
  });
}

function withInFlight(base: typeof fetch) {
  let current = 0;
  let max = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    current += 1;
    max = Math.max(max, current);
    try {
      await Promise.resolve();
      return await base(input, init);
    } finally {
      current -= 1;
    }
  };
  return {
    fetch: fetchImpl,
    maxInFlight() {
      return max;
    },
    resetMax() {
      max = 0;
    },
  };
}

test("plane host and workspace defaults", () => {
  expect(planeHost({})).toBe("https://plane.tail48fe8.ts.net");
  expect(planeHost({ PLANE_HOST: "https://plane.example/" })).toBe("https://plane.example");
  expect(planeApiBase("https://plane.test")).toBe("https://plane.test/api/v1");
  expect(planeWorkspace("")).toBe("personal");
  expect(planeWorkspace("--plane --workspace team")).toBe("team");
  expect(planeWorkspace("--plane", { PLANE_WORKSPACE: "from-env" })).toBe("from-env");
});

test("work item and module mapping keep Plane identifiers", () => {
  const states = new Map([
    [ST_PROGRESS, { id: ST_PROGRESS, name: "In Progress", group: "started", sequence: 3 }],
  ]);
  const labels = new Map([[LBL_NEEDS, { id: LBL_NEEDS, name: "needs-input" }]]);
  const issue = workItemToIssue(
    {
      id: WI_LOGIN,
      name: "Login form",
      sequence_id: 12,
      priority: "high",
      state: ST_PROGRESS,
      labels: [LBL_NEEDS],
      module_ids: [AUTH],
      assignees: [{ display_name: "Ada" }],
      created_at: "2026-09-02T00:00:00Z",
      target_date: "2026-09-20",
    },
    { id: APH, identifier: "APH", name: "Aphrodite" },
    { states, labels, moduleKey: planeModuleKey("APH", AUTH) },
  );
  expect(issue).toMatchObject({
    key: "APH-12",
    fields: {
      summary: "Login form",
      status: { name: "In Progress" },
      priority: { name: "High" },
      assignee: { displayName: "Ada" },
      labels: ["needs-input"],
      parent: { key: planeModuleKey("APH", AUTH) },
    },
  });
  expect(moduleToIssue({ id: AUTH, name: "Auth", status: "in_progress" }, { id: APH, identifier: "APH", name: "Aphrodite" })).toMatchObject({
    key: planeModuleKey("APH", AUTH),
    fields: { summary: "Auth", status: { name: "In Progress" }, issuetype: { name: "Epic" } },
  });
  expect(planeWorkItemKey("aph", 12)).toBe("APH-12");
  expect(titleCasePriority("none")).toBeUndefined();
  expect(orderStateNames([
    { id: "2", name: "Done", group: "completed", sequence: 1 },
    { id: "1", name: "Todo", group: "unstarted", sequence: 1 },
  ])).toEqual(["Todo", "Done"]);
});

test("createPlaneCli lists scoped work items and modules as Epics", async () => {
  const plane = fakePlane();
  const cli = planeCli("--plane --projects APH,PULSE", plane.fetch);
  const issues = JSON.parse(await cli.list("--plane --projects APH,PULSE")) as RawIssue[];
  expect(issues.map((issue) => issue.key)).toEqual(["APH-12", "APH-13", "PULSE-1"]);
  expect(issues[0]?.fields?.labels).toEqual(["needs-input"]);
  expect(issues[0]?.fields?.parent).toEqual({ key: plane.moduleKey });

  const epics = JSON.parse(await cli.listEpics()) as RawIssue[];
  expect(epics).toEqual([
    expect.objectContaining({
      key: plane.moduleKey,
      fields: expect.objectContaining({ summary: "Auth", issuetype: { name: "Epic" } }),
    }),
  ]);
  expect(JSON.parse(await cli.listChildren([plane.moduleKey]))).toEqual([
    expect.objectContaining({ key: "APH-12" }),
  ]);
  expect(JSON.parse(await cli.listEpic(plane.moduleKey))).toEqual([
    expect.objectContaining({ key: "APH-12" }),
  ]);
  expect(await cli.states?.()).toEqual(["Backlog", "Todo", "In Progress", "Done"]);
  expect(await cli.open("APH-12")).toBe("https://plane.test/personal/browse/APH-12");
  expect(plane.calls().every((call) => call.key === "test-key")).toBe(true);
  expect(plane.calls().some((call) => call.url.includes("/DEC") || call.url.includes(OTHER))).toBe(false);
});

test("createPlaneCli move PATCHes the Plane state", async () => {
  const plane = fakePlane();
  const cli = planeCli("--plane --projects APH", plane.fetch);
  await cli.list("--plane --projects APH");
  expect(await cli.move("APH-12", "Done")).toEqual({ ok: true });
  const patch = plane.calls().find((call) => call.method === "PATCH" && String(call.url).includes(WI_LOGIN));
  expect(patch?.body).toEqual({ state: ST_DONE });
});

test("createPlaneCli create and edit go through Plane REST", async () => {
  const plane = fakePlane();
  const cli = planeCli("--plane --projects APH", plane.fetch);
  await cli.list("--plane --projects APH");
  const created = await cli.create({
    summary: "New card",
    description: "Body",
    labels: ["needs-input"],
    status: "Todo",
    parent: plane.moduleKey,
  });
  expect(created).toEqual({ ok: true, key: "APH-41" });
  expect(await cli.edit("APH-12", { summary: "Login form v2" })).toEqual({ ok: true });
  expect(plane.calls().some((call) => call.method === "POST" && String(call.url).includes("module-issues"))).toBe(true);
});

test("createPlaneCli falls back from work-items to issues", async () => {
  const plane = fakePlane({ issuesOnly: true });
  const cli = planeCli("--plane --projects APH", plane.fetch);
  const issues = JSON.parse(await cli.list("--plane --projects APH")) as RawIssue[];
  expect(issues.map((issue) => issue.key)).toContain("APH-12");
  expect(plane.calls().some((call) => call.url.includes("/issues"))).toBe(true);
});

test("createPlaneCli refuses a missing API key", () => {
  expect(() =>
    createPlaneCli({
      host: "https://plane.test",
      apiKey: "  ",
      flags: "--plane",
    }),
  ).toThrow(/PLANE_API_KEY/);
});

test("Refresh from Plane fills columns including empty workflow states", async () => {
  const plane = fakePlane();
  const cli = planeCli("--plane --projects APH,PULSE", plane.fetch);
  const raw = JSON.parse(await cli.list("--plane --projects APH,PULSE"));
  const board = issuesToBoard(raw, { statuses: await cli.states?.() });
  expect(board.columns.map((column) => column.title)).toEqual([
    "Backlog",
    "Todo",
    "In Progress",
    "Done",
  ]);
  expect(board.columns[0]?.cards).toEqual([]);
  expect(board.columns[1]?.cards.map((card) => card.key)).toEqual(["APH-13"]);
  expect(board.columns[2]?.cards.map((card) => card.key)).toEqual(["APH-12", "PULSE-1"]);
  expect(board.columns[2]?.cards[0]?.labels).toEqual(["needs-input"]);
  expect(board.epics.map((epic) => epic.key)).toEqual([plane.moduleKey]);
});

function dummyJiraBin() {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-jira-"));
  const bin = join(dir, "jira");
  writeFileSync(bin, "#!/bin/sh\nexit 1\n");
  chmodSync(bin, 0o755);
  return { dir, bin };
}

test("boot --plane uses Plane even when jira is on PATH", async () => {
  const plane = fakePlane();
  const { dir, bin } = dummyJiraBin();
  const { kind, app } = await createBoardApp({
    raw: fixture,
    flags: "--plane --projects APH,PULSE",
    env: {
      PATH: dir,
      JIRA_BIN: bin,
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: plane.fetch,
  });
  expect(kind).toBe("plane");
  expect(app.board().error).toBeUndefined();
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);

  await refreshFromJira(app, kind);
  expect(app.board().columns.map((column) => column.title)).toEqual([
    "Backlog",
    "Todo",
    "In Progress",
    "Done",
  ]);
  expect(
    app.board().columns.flatMap((column) => column.cards.map((card) => card.key)),
  ).toEqual(["APH-13", "APH-12", "PULSE-1"]);
  expect(app.board().epics.map((epic) => epic.summary)).toEqual(["Auth"]);
});

test("boot without --plane does not select Plane", async () => {
  const { kind } = await createBoardApp({
    raw: fixture,
    flags: "--projects APH,PULSE",
    env: { PATH: "/tmp", JIRA_BIN: "jira" },
  });
  expect(kind).toBe("store");
});

test("Plane boot does not expose Fixture cards before live Refresh", async () => {
  const { kind, app } = await createBoardApp({
    raw: fixture,
    flags: "--plane --workspace team",
    env: {
      PATH: "/tmp",
      JIRA_BIN: "jira",
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: async () => new Response("no", { status: 500 }),
  });
  expect(kind).toBe("plane");
  expect(app.board().error).toBeUndefined();
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
  expect(app.board().epics).toEqual([]);
});

function plane429() {
  return new Response(JSON.stringify({ error: "RATE_LIMIT_EXCEEDED" }), {
    status: 429,
    headers: { "content-type": "application/json", "Retry-After": "0" },
  });
}

test("Plane 429 keeps Plane mode and does not present the Fixture as live", async () => {
  const { kind, app } = await createBoardApp({
    raw: fixture,
    flags: "--plane --workspace team",
    env: {
      PATH: "/tmp",
      JIRA_BIN: "jira",
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: async () => plane429(),
  });
  expect(kind).toBe("plane");
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
  await refreshFromJira(app, kind);
  expect(kind).toBe("plane");
  expect(app.board().error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
});

test("Plane mode does not serve Fake Jira", async () => {
  const { kind, app, store } = await createBoardApp({
    raw: fixture,
    flags: "--plane --workspace team",
    env: {
      PATH: "/tmp",
      JIRA_BIN: "jira",
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: async () => new Response("no", { status: 500 }),
  });
  expect(kind).toBe("plane");
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (!handleRequest(req, res, { app, store, kind })) {
      res.statusCode = 404;
      res.end("no fake");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const res = await fetch(`http://127.0.0.1:${addr.port}/rest/api/2/search`);
  const body = await res.text();
  server.close();
  expect(res.status).toBe(404);
  expect(body).toBe("no fake");
});

test("Plane boot Refresh settles before listen", async () => {
  const { kind, app, store } = await createBoardApp({
    raw: fixture,
    flags: "--plane --workspace team",
    env: {
      PATH: "/tmp",
      JIRA_BIN: "jira",
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: async () => plane429(),
  });
  expect(kind).toBe("plane");
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual([]);
  await refreshFromJira(app, kind);
  const { createServer } = await import("node:http");
  const server = createServer((req, res) => {
    if (!handleRequest(req, res, { app, store, kind })) {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  const board = await (await fetch(`http://127.0.0.1:${addr.port}/api/board`)).json();
  server.close();
  expect(board.error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(board.columns.flatMap((column: { cards: { key: string }[] }) => column.cards.map((card) => card.key))).toEqual([]);
});

test("a later 429 keeps the last Plane payload and the error", async () => {
  const plane = fakePlane();
  let fail = false;
  const fetchImpl: typeof fetch = async (input, init) => {
    if (fail) return plane429();
    return plane.fetch(input, init);
  };
  const { kind, app } = await createBoardApp({
    raw: fixture,
    flags: "--plane --workspace team",
    env: {
      PATH: "/tmp",
      JIRA_BIN: "jira",
      PLANE_API_KEY: "test-key",
      PLANE_HOST: "https://plane.test",
    },
    fetch: fetchImpl,
  });
  await refreshFromJira(app, kind);
  const keys = app.board().columns.flatMap((column) => column.cards.map((card) => card.key));
  expect(keys).toContain("APH-12");
  expect(keys.some((key) => key.startsWith("DEMO-"))).toBe(false);
  fail = true;
  await app.refresh("--plane --workspace other");
  expect(app.board().error).toMatch(/Plane 429: RATE_LIMIT_EXCEEDED/);
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key))).toEqual(keys);
  expect(app.board().columns.flatMap((column) => column.cards.map((card) => card.key)).some((key) => key.startsWith("DEMO-"))).toBe(false);
});

test("unscoped workspace catalog keeps Plane HTTP in-flight at 1 including module joins", async () => {
  const plane = fakePlane({ join: true });
  const tracked = withInFlight(plane.fetch);
  const flags = "--plane --workspace team";
  const cli = createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    flags,
    fetch: tracked.fetch,
    retryDelayMs: 0,
  });
  const issues = JSON.parse(await cli.list(flags)) as RawIssue[];
  expect(issues.map((issue) => issue.key)).toEqual(["APH-12", "APH-13", "PULSE-1", "DEC-9"]);
  expect(tracked.maxInFlight()).toBe(1);
  expect(plane.calls().some((call) => call.url.includes("/module-issues/"))).toBe(true);
  expect(plane.calls().filter((call) => call.url.includes("/states/")).length).toBe(3);
  expect(plane.calls().some((call) => call.url.includes(APH))).toBe(true);
  expect(plane.calls().some((call) => call.url.includes(PULSE))).toBe(true);
  expect(plane.calls().some((call) => call.url.includes(OTHER))).toBe(true);

  tracked.resetMax();
  await Promise.all([
    cli.move("APH-12", "Done"),
    cli.edit("APH-12", { summary: "Login form v2" }),
  ]);
  expect(tracked.maxInFlight()).toBe(1);
});

test("unscoped other workspace still requests every listed Project", async () => {
  const plane = fakePlane();
  const flags = "--plane --workspace other";
  const cli = planeCli(flags, plane.fetch);
  await cli.list(flags);
  const itemGets = plane
    .calls()
    .filter((call) => call.method === "GET" && /\/projects\/[^/]+\//.test(call.url))
    .map((call) => call.url);
  expect(itemGets.some((url) => url.includes(APH))).toBe(true);
  expect(itemGets.some((url) => url.includes(PULSE))).toBe(true);
  expect(itemGets.some((url) => url.includes(OTHER))).toBe(true);
});

test("--projects still narrows item endpoints after the project list", async () => {
  const plane = fakePlane();
  const flags = "--plane --workspace personal --projects APH";
  const cli = planeCli(flags, plane.fetch);
  await cli.list(flags);
  expect(plane.calls().some((call) => /\/workspaces\/[^/]+\/projects\/?$/.test(call.url))).toBe(true);
  expect(plane.calls().some((call) => call.url.includes(APH) && call.url.includes("/states/"))).toBe(
    true,
  );
  expect(plane.calls().some((call) => call.url.includes(PULSE))).toBe(false);
  expect(plane.calls().some((call) => call.url.includes(OTHER))).toBe(false);
});

function clock() {
  let now = 1_700_000_000_000;
  const slept: number[] = [];
  return {
    now() {
      return now;
    },
    async sleep(ms: number) {
      slept.push(ms);
      now += ms;
    },
    slept,
  };
}

function jsonRate(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

test("429 waits the Retry-After window then continues the catalog", async () => {
  const plane = fakePlane();
  const time = clock();
  let seen = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    seen += 1;
    if (seen === 2) {
      return jsonRate(
        { error_code: 5900, error_message: "RATE_LIMIT_EXCEEDED" },
        429,
        { "Retry-After": "2" },
      );
    }
    return plane.fetch(input, init);
  };
  const flags = "--plane --workspace team";
  const cli = createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    flags,
    fetch: fetchImpl,
    retryDelayMs: 0,
    now: time.now,
    sleep: time.sleep,
  });
  const issues = JSON.parse(await cli.list(flags)) as RawIssue[];
  expect(issues.map((issue) => issue.key)).toContain("APH-12");
  expect(time.slept).toEqual([2000]);
  expect(seen).toBeGreaterThan(2);
});

test("remaining 0 waits until X-RateLimit-Reset before the next request", async () => {
  const plane = fakePlane();
  const time = clock();
  let seen = 0;
  const fetchImpl: typeof fetch = async (input, init) => {
    seen += 1;
    const response = await plane.fetch(input, init);
    if (seen === 1) {
      return jsonRate(JSON.parse(await response.text()), 200, {
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(1_700_000_030),
      });
    }
    return response;
  };
  const flags = "--plane --workspace other";
  const cli = createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    flags,
    fetch: fetchImpl,
    retryDelayMs: 0,
    now: time.now,
    sleep: time.sleep,
  });
  await cli.list(flags);
  expect(time.slept[0]).toBe(30_000);
  expect(seen).toBeGreaterThan(1);
});

test("exhausted 429 policy surfaces the Plane 429 error without same-window retries", async () => {
  const time = clock();
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    urls.push(new URL(String(input)).pathname);
    return jsonRate(
      { error_code: 5900, error_message: "RATE_LIMIT_EXCEEDED" },
      429,
      { "Retry-After": "60" },
    );
  };
  const flags = "--plane --workspace team";
  const cli = createPlaneCli({
    host: "https://plane.test",
    apiKey: "test-key",
    flags,
    fetch: fetchImpl,
    retryDelayMs: 0,
    now: time.now,
    sleep: time.sleep,
  });
  await expect(cli.list(flags)).rejects.toThrow(/Plane 429:.*RATE_LIMIT_EXCEEDED/);
  expect(urls).toHaveLength(2);
  expect(time.slept).toEqual([60_000]);
});
