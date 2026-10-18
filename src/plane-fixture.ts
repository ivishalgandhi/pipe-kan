import { readFileSync } from "node:fs";

import type { PlaneFetch } from "./plane.ts";

export type PlaneFixture = {
  workspaces: { id: string; name: string; slug: string }[];
  projects: Record<string, { id: string; identifier: string; name: string }[]>;
  states: { id: string; name: string; group: string; sequence: number }[];
  labels: { id: string; name: string }[];
  members: { id: string; display_name: string }[];
  modules: Record<string, FixtureModule[]>;
  issues: Record<string, FixtureIssue[]>;
};

type FixtureModule = {
  id: string;
  name: string;
  status: string;
  priority?: string;
  start_date?: string;
  target_date?: string;
  created_at?: string;
  updated_at?: string;
};

type FixtureIssue = {
  id: string;
  name: string;
  sequence_id: number;
  priority?: string;
  state: string;
  labels?: string[];
  module_ids?: string[];
  assignee?: string;
  created_at?: string;
  updated_at?: string;
  target_date?: string;
  start_date?: string;
};

const STATES = [
  { id: "st-backlog", name: "Backlog", group: "backlog", sequence: 1 },
  { id: "st-todo", name: "Todo", group: "unstarted", sequence: 2 },
  { id: "st-progress", name: "In Progress", group: "started", sequence: 3 },
  { id: "st-done", name: "Done", group: "completed", sequence: 4 },
  { id: "st-cancelled", name: "Cancelled", group: "cancelled", sequence: 5 },
];

function mod(id: string, name: string, status: string, extra: Partial<FixtureModule> = {}): FixtureModule {
  return { id, name, status, created_at: "2026-01-04T00:00:00Z", updated_at: "2026-02-02T00:00:00Z", ...extra };
}

function issue(id: string, name: string, sequence: number, state: string, extra: Partial<FixtureIssue> = {}): FixtureIssue {
  return { id, name, sequence_id: sequence, state, created_at: "2026-01-06T00:00:00Z", updated_at: "2026-03-03T00:00:00Z", ...extra };
}

/** Synthetic Plane catalog. work and personal both contain PULSE. No live data. */
export const SYNTHETIC_PLANE: PlaneFixture = {
  workspaces: [
    { id: "ws-work", name: "Work", slug: "work" },
    { id: "ws-personal", name: "Personal", slug: "personal" },
  ],
  projects: {
    work: [
      { id: "work-pulse", identifier: "PULSE", name: "Pulse" },
      { id: "work-aph", identifier: "APH", name: "Aphrodite" },
    ],
    personal: [
      { id: "personal-pulse", identifier: "PULSE", name: "Pulse" },
      { id: "personal-pkan", identifier: "PKAN", name: "Pipe kan" },
    ],
  },
  states: STATES,
  labels: [
    { id: "lbl-needs", name: "needs-input" },
    { id: "lbl-roadmap", name: "roadmap" },
  ],
  members: [
    { id: "user-ada", display_name: "Ada" },
    { id: "user-grace", display_name: "Grace" },
  ],
  modules: {
    "work-pulse": [
      mod("mod-00000000000000000000000000000001", "Backlog objective", "backlog", { priority: "low" }),
      mod("mod-00000000000000000000000000000002", "Planned objective", "todo", { priority: "medium", start_date: "2026-04-01", target_date: "2026-12-01" }),
      mod("mod-00000000000000000000000000000003", "Slipped objective", "in_progress", { priority: "high", start_date: "2025-01-01", target_date: "2025-06-01" }),
      mod("mod-00000000000000000000000000000004", "On track objective", "in_progress", { priority: "urgent", start_date: "2026-03-01", target_date: "2026-11-15" }),
      mod("mod-00000000000000000000000000000005", "Shipped objective", "done", { priority: "medium", start_date: "2025-11-01", target_date: "2026-01-20" }),
      mod("mod-00000000000000000000000000000006", "Dropped objective", "cancelled", { priority: "low", target_date: "2025-03-01" }),
      mod("mod-00000000000000000000000000000007", "Undated objective", "in_progress", { priority: "low", start_date: "2026-05-01" }),
    ],
    "personal-pulse": [
      mod("mod-00000000000000000000000000000011", "Home objective", "in_progress", { priority: "medium", start_date: "2026-02-01", target_date: "2026-08-01" }),
    ],
    "work-aph": [
      mod("mod-00000000000000000000000000000021", "Aphrodite objective", "todo", { priority: "high", target_date: "2026-07-01" }),
    ],
    "personal-pkan": [],
  },
  issues: {
    "work-pulse": [
      issue("wi-work-1", "Work pulse story", 1, "st-progress", { priority: "high", module_ids: ["mod-00000000000000000000000000000004"], assignee: "Ada", labels: ["lbl-roadmap"], target_date: "2026-11-01" }),
      issue("wi-work-2", "Work pulse done", 2, "st-done", { priority: "low", module_ids: ["mod-00000000000000000000000000000005"], assignee: "Grace" }),
    ],
    "personal-pulse": [
      issue("wi-home-1", "Personal pulse story", 1, "st-todo", { priority: "medium", module_ids: ["mod-00000000000000000000000000000011"], assignee: "Ada", labels: ["lbl-needs"], target_date: "2026-08-01" }),
    ],
    "work-aph": [issue("wi-aph-1", "Aphrodite story", 4, "st-backlog", { priority: "medium" })],
    "personal-pkan": [issue("wi-pkan-1", "Pipe kan story", 3, "st-todo", { priority: "low", assignee: "Grace" })],
  },
};

function page(results: unknown[]) {
  return { results, next_page_results: false, next_cursor: "" };
}

export function planeFixtureFetch(fixture: PlaneFixture = SYNTHETIC_PLANE): PlaneFetch {
  const data = JSON.parse(JSON.stringify(fixture)) as PlaneFixture;
  const stateById = new Map(data.states.map((state) => [state.id, state]));
  const labelById = new Map(data.labels.map((label) => [label.id, label]));

  return async (input, init) => {
    const url = new URL(String(input), "https://plane.test");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const parts = path.split("/").filter(Boolean);
    let body: Record<string, unknown> | undefined;
    if (init?.body) body = JSON.parse(String(init.body)) as Record<string, unknown>;

    if (method === "GET" && parts[2] === "users" && parts[4] === "workspaces") {
      return Response.json(data.workspaces);
    }
    if (method === "GET" && parts[2] === "workspaces" && parts.length === 3) {
      return Response.json(page(data.workspaces));
    }
    if (method === "GET" && /\/workspaces\/[^/]+\/projects$/.test(path)) {
      return Response.json(page(data.projects[parts[3] ?? ""] ?? []));
    }
    if (method === "GET" && parts[4] === "members" && parts.length === 5) return Response.json(page(data.members));

    const projectId = parts[5] ?? "";
    const collection = parts[6];
    const itemId = parts[7];
    const projectIssues = data.issues[projectId] ?? [];
    const projectModules = data.modules[projectId] ?? [];

    if (method === "GET" && collection === "states") return Response.json(page(data.states));
    if (method === "GET" && collection === "labels") return Response.json(page(data.labels));
    if (method === "GET" && collection === "modules" && !itemId) return Response.json(page(projectModules));
    if (method === "GET" && collection === "modules" && parts[8] === "module-issues") {
      const ids = projectIssues.filter((row) => row.module_ids?.includes(itemId ?? "")).map((row) => row.id);
      return Response.json(page(ids.map((id) => ({ issue: id, module: itemId }))));
    }
    if (method === "GET" && (collection === "work-items" || collection === "issues") && !itemId) {
      return Response.json(page(projectIssues.map((row) => toWorkItem(row, stateById, labelById))));
    }
    if (method === "PATCH" && collection === "modules" && itemId) {
      const module = projectModules.find((row) => row.id === itemId);
      if (module && typeof body?.status === "string") module.status = body.status;
      return Response.json({ id: itemId, ...body });
    }
    if (method === "PATCH" && (collection === "work-items" || collection === "issues") && itemId) {
      const issueRow = projectIssues.find((row) => row.id === itemId);
      if (issueRow && typeof body?.state === "string") issueRow.state = body.state;
      if (issueRow && typeof body?.priority === "string") issueRow.priority = body.priority;
      if (issueRow && typeof body?.name === "string") issueRow.name = body.name;
      return Response.json({ id: itemId, ...body });
    }
    if (method === "POST" && (collection === "work-items" || collection === "issues") && !itemId) {
      const sequence = 100 + projectIssues.length;
      projectIssues.push(issue(`wi-new-${sequence}`, String(body?.name ?? "New"), sequence, "st-todo"));
      return Response.json({ id: `wi-new-${sequence}`, sequence_id: sequence, name: body?.name }, { status: 201 });
    }
    return new Response(`unhandled ${method} ${path}`, { status: 404 });
  };
}

function toWorkItem(
  row: FixtureIssue,
  states: Map<string, { id: string; name: string }>,
  labels: Map<string, { id: string; name: string }>,
) {
  const state = states.get(row.state);
  return {
    id: row.id,
    name: row.name,
    sequence_id: row.sequence_id,
    priority: row.priority,
    state: state ? { id: state.id, name: state.name } : row.state,
    labels: row.labels ?? [],
    label_details: (row.labels ?? []).map((id) => labels.get(id)).filter(Boolean),
    module_ids: row.module_ids ?? [],
    assignees: row.assignee ? [{ display_name: row.assignee }] : [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    target_date: row.target_date,
    start_date: row.start_date,
  };
}

export function resolvePlaneFetch(env: NodeJS.ProcessEnv = process.env): PlaneFetch | undefined {
  const fixture = env.PLANE_FIXTURE?.trim();
  if (!fixture) return undefined;
  if (fixture === "synthetic") return planeFixtureFetch(SYNTHETIC_PLANE);
  const parsed = JSON.parse(readFileSync(fixture, "utf8")) as PlaneFixture;
  return planeFixtureFetch(parsed);
}
