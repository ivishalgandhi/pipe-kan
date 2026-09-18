import { DEFAULT_FLAGS, parseFlags } from "./flags.ts";
import type { Cli } from "./cli.ts";
import type { RawIssue } from "./board.ts";

export const DEFAULT_PLANE_HOST = "https://plane.tail48fe8.ts.net";
export const DEFAULT_PLANE_WORKSPACE = "personal";

const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"];
const RETRY_LIMIT = 1;
const RETRY_DELAY_CAP_MS = 8_000;

export type PlaneFetch = typeof fetch;

export type PlaneOpts = {
  host?: string;
  apiKey: string;
  workspace?: string;
  flags?: string;
  fetch?: PlaneFetch;
  retryDelayMs?: number;
};

type PlaneState = {
  id: string;
  name: string;
  group?: string;
  sequence?: number;
};

type PlaneLabel = {
  id: string;
  name: string;
};

type PlaneProject = {
  id: string;
  identifier: string;
  name: string;
};

type PlaneModule = {
  id: string;
  name: string;
  status?: string;
  created_at?: string;
  target_date?: string;
  start_date?: string;
};

type PlaneWorkItem = {
  id: string;
  name?: string;
  description?: unknown;
  description_html?: unknown;
  description_stripped?: unknown;
  sequence_id?: number;
  priority?: string;
  state?: unknown;
  assignees?: unknown;
  assignee_details?: unknown;
  labels?: unknown;
  label_details?: unknown;
  module_ids?: unknown;
  modules?: unknown;
  module?: unknown;
  created_at?: string;
  target_date?: string;
  start_date?: string;
  archived_at?: string | null;
  is_draft?: boolean;
  project?: string;
};

type CachedWork = {
  issue: RawIssue;
  item: PlaneWorkItem;
  project: PlaneProject;
  moduleKey?: string;
};

type CachedModule = {
  issue: RawIssue;
  module: PlaneModule;
  project: PlaneProject;
};

export function planeHost(env: NodeJS.ProcessEnv = process.env): string {
  return (env.PLANE_HOST ?? DEFAULT_PLANE_HOST).replace(/\/$/, "");
}

export function planeWorkspace(
  flags = "",
  env: NodeJS.ProcessEnv = process.env,
): string {
  return parseFlags(flags).workspace || env.PLANE_WORKSPACE || DEFAULT_PLANE_WORKSPACE;
}

export function planeApiBase(host: string): string {
  const trimmed = host.replace(/\/$/, "");
  if (trimmed.endsWith("/api/v1")) return trimmed;
  if (trimmed.endsWith("/api")) return `${trimmed}/v1`;
  return `${trimmed}/api/v1`;
}

export function planeModuleKey(identifier: string, moduleId: string): string {
  const hex = moduleId.replace(/-/g, "").slice(-8);
  const n = Number.parseInt(hex, 16);
  return `${identifier.toUpperCase()}M-${Number.isFinite(n) ? n : 0}`;
}

export function planeWorkItemKey(identifier: string, sequenceId: number): string {
  return `${identifier.toUpperCase()}-${sequenceId}`;
}

export function titleCasePriority(value: string | undefined): string | undefined {
  if (!value || value.toLowerCase() === "none") return undefined;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function moduleStatusName(status: string | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "backlog":
      return "Backlog";
    case "unstarted":
    case "planned":
      return "Todo";
    case "started":
    case "in_progress":
      return "In Progress";
    case "paused":
      return "Paused";
    case "completed":
      return "Done";
    case "cancelled":
    case "canceled":
      return "Cancelled";
    default:
      return status?.trim() || "Todo";
  }
}

export function orderStateNames(states: PlaneState[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  const sorted = [...states].sort((a, b) => {
    const groupA = STATE_GROUPS.indexOf((a.group ?? "").toLowerCase());
    const groupB = STATE_GROUPS.indexOf((b.group ?? "").toLowerCase());
    const group = (groupA === -1 ? 99 : groupA) - (groupB === -1 ? 99 : groupB);
    if (group) return group;
    return (a.sequence ?? 0) - (b.sequence ?? 0);
  });
  for (const state of sorted) {
    const name = state.name.trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asId(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  const row = asRecord(value);
  return asString(row?.id);
}

function named(value: unknown): string | undefined {
  const row = asRecord(value);
  return asString(row?.name) ?? asString(row?.display_name) ?? asString(row?.displayName);
}

function stateNameOf(item: PlaneWorkItem, states: Map<string, PlaneState>): string | undefined {
  const expanded = named(item.state);
  if (expanded) return expanded;
  const id = asId(item.state);
  if (id && states.get(id)?.name) return states.get(id)!.name;
  return undefined;
}

function labelNamesOf(item: PlaneWorkItem, labels: Map<string, PlaneLabel>): string[] {
  const raw = [
    ...(Array.isArray(item.label_details) ? item.label_details : []),
    ...(Array.isArray(item.labels) ? item.labels : []),
  ];
  const names = new Set<string>();
  for (const entry of raw) {
    const fromName = named(entry) ?? asString(entry);
    if (fromName && !labels.has(fromName)) {
      names.add(fromName);
      continue;
    }
    const id = asId(entry);
    const mapped = id ? labels.get(id)?.name : undefined;
    if (mapped) names.add(mapped);
  }
  return [...names];
}

function assigneeOf(item: PlaneWorkItem): string | undefined {
  const raw = Array.isArray(item.assignee_details)
    ? item.assignee_details
    : Array.isArray(item.assignees)
      ? item.assignees
      : [];
  for (const entry of raw) {
    const name =
      named(entry) ??
      asString(asRecord(entry)?.email) ??
      asString(asRecord(entry)?.first_name);
    if (name) return name;
  }
  return undefined;
}

function moduleIdsOf(item: PlaneWorkItem): string[] {
  const ids = new Set<string>();
  for (const entry of [
    ...(Array.isArray(item.module_ids) ? item.module_ids : []),
    ...(Array.isArray(item.modules) ? item.modules : []),
    item.module,
  ]) {
    const id = asId(entry);
    if (id) ids.add(id);
  }
  return [...ids];
}

function descriptionOf(item: PlaneWorkItem): string | undefined {
  return (
    asString(item.description_stripped) ??
    asString(item.description) ??
    (asString(item.description_html)
      ? asString(item.description_html)!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
      : undefined)
  );
}

export function workItemToIssue(
  item: PlaneWorkItem,
  project: PlaneProject,
  opts: { states: Map<string, PlaneState>; labels: Map<string, PlaneLabel>; moduleKey?: string },
): RawIssue | undefined {
  if (item.archived_at || item.is_draft) return undefined;
  const sequence = Number(item.sequence_id);
  if (!Number.isFinite(sequence)) return undefined;
  const status = stateNameOf(item, opts.states);
  if (!status) return undefined;
  const key = planeWorkItemKey(project.identifier, sequence);
  const priority = titleCasePriority(item.priority);
  const assignee = assigneeOf(item);
  const labels = labelNamesOf(item, opts.labels);
  const description = descriptionOf(item);
  const target = asString(item.target_date);
  return {
    key,
    fields: {
      summary: asString(item.name) ?? "",
      status: { name: status },
      ...(priority ? { priority: { name: priority } } : {}),
      ...(assignee ? { assignee: { displayName: assignee } } : {}),
      ...(target ? { duedate: target, "Target End Date": target } : {}),
      issuetype: { name: "Story" },
      issueType: { name: "Story" },
      ...(opts.moduleKey ? { parent: { key: opts.moduleKey } } : {}),
      ...(labels.length ? { labels } : {}),
      ...(asString(item.created_at) ? { created: item.created_at } : {}),
      ...(description ? { description } : {}),
    },
  };
}

export function moduleToIssue(module: PlaneModule, project: PlaneProject): RawIssue {
  const target = asString(module.target_date);
  return {
    key: planeModuleKey(project.identifier, module.id),
    fields: {
      summary: asString(module.name) ?? module.id,
      status: { name: moduleStatusName(module.status) },
      issuetype: { name: "Epic" },
      issueType: { name: "Epic" },
      ...(target ? { duedate: target, "Target End Date": target } : {}),
      ...(asString(module.created_at) ? { created: module.created_at } : {}),
    },
  };
}

function joinUrl(base: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

function queryPath(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const encoded = params.toString();
  if (!encoded) return path;
  return `${path}${path.includes("?") ? "&" : "?"}${encoded}`;
}

export function planeRetryDelayMs(
  response: { headers: { get(name: string): string | null } },
  fallback: number,
  cap = RETRY_DELAY_CAP_MS,
): number {
  const raw = response.headers.get("retry-after");
  if (raw) {
    const seconds = Number(raw);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, cap);
    }
    const at = Date.parse(raw);
    if (!Number.isNaN(at)) {
      return Math.min(Math.max(0, at - Date.now()), cap);
    }
  }
  return Math.min(Math.max(0, fallback), cap);
}

function errorMessage(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    const detail =
      asString(parsed.detail) ??
      asString(parsed.error) ??
      asString(parsed.message) ??
      (Array.isArray(parsed.non_field_errors) ? asString(parsed.non_field_errors[0]) : undefined);
    if (detail) return `Plane ${status}: ${detail}`;
  } catch {
    /* use raw body */
  }
  const snippet = body.replace(/\s+/g, " ").trim().slice(0, 240);
  return snippet ? `Plane ${status}: ${snippet}` : `Plane ${status}`;
}

function htmlParagraph(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped}</p>`;
}

export function createPlaneCli(opts: PlaneOpts): Cli {
  if (!opts.apiKey.trim()) {
    throw new Error("Plane mode needs PLANE_API_KEY");
  }
  const host = (opts.host ?? DEFAULT_PLANE_HOST).replace(/\/$/, "");
  const apiBase = planeApiBase(host);
  const defaultFlags = opts.flags ?? DEFAULT_FLAGS;
  const fetchFn = opts.fetch ?? fetch;
  const retryDelayMs = opts.retryDelayMs ?? 1000;
  let lastFlags = defaultFlags;
  let workItemResource = "work-items";
  let catalog:
    | {
        flags: string;
        workspace: string;
        projects: PlaneProject[];
        states: Map<string, Map<string, PlaneState>>;
        labels: Map<string, Map<string, PlaneLabel>>;
        works: Map<string, CachedWork>;
        modules: Map<string, CachedModule>;
        columns: string[];
      }
    | undefined;

  function workspaceOf(flags: string): string {
    return planeWorkspace(flags || defaultFlags);
  }

  async function request(
    path: string,
    init: RequestInit = {},
    attempt = 0,
  ): Promise<{ status: number; body: string }> {
    const headers = new Headers(init.headers);
    headers.set("X-API-Key", opts.apiKey);
    if (init.body && !headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    const response = await fetchFn(joinUrl(apiBase, path), { ...init, headers });
    const body = await response.text();
    if (response.status === 429 && attempt < RETRY_LIMIT) {
      const delay = retryDelayMs
        ? planeRetryDelayMs(response, retryDelayMs * 2 ** attempt)
        : 0;
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      return request(path, init, attempt + 1);
    }
    if (!response.ok) {
      const error = new Error(errorMessage(response.status, body)) as Error & { status?: number };
      error.status = response.status;
      throw error;
    }
    return { status: response.status, body };
  }

  async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
    const { body } = await request(path, init);
    if (!body.trim()) return null;
    return JSON.parse(body);
  }

  function asPages(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    const row = asRecord(raw);
    return Array.isArray(row?.results) ? row.results : [];
  }

  async function paginate(path: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let cursor: string | undefined;
    for (let page = 0; page < 50; page++) {
      const url = queryPath(path, { per_page: "100", ...(cursor ? { cursor } : {}) });
      const raw = await requestJson(url);
      if (Array.isArray(raw) && page === 0 && !asRecord(raw)) {
        return raw;
      }
      const row = asRecord(raw);
      const chunk = asPages(raw);
      items.push(...chunk);
      if (!row?.next_page_results) break;
      const next = asString(row.next_cursor);
      if (!next || next === cursor) break;
      cursor = next;
    }
    return items;
  }

  async function withResource<T>(run: (resource: string) => Promise<T>): Promise<T> {
    try {
      return await run(workItemResource);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (workItemResource === "work-items" && status === 404) {
        workItemResource = "issues";
        return run(workItemResource);
      }
      throw err;
    }
  }

  function scopedProjects(all: PlaneProject[], flags: string): PlaneProject[] {
    const { projects } = parseFlags(flags || defaultFlags);
    if (!projects.length) return all;
    const wanted = new Set(projects);
    return all.filter((project) => wanted.has(project.identifier.toUpperCase()));
  }

  function parseProject(raw: unknown): PlaneProject | undefined {
    const row = asRecord(raw);
    const id = asString(row?.id);
    const identifier = asString(row?.identifier)?.toUpperCase();
    if (!id || !identifier) return undefined;
    return { id, identifier, name: asString(row?.name) ?? identifier };
  }

  function parseState(raw: unknown): PlaneState | undefined {
    const row = asRecord(raw);
    const id = asString(row?.id);
    const name = asString(row?.name);
    if (!id || !name) return undefined;
    return {
      id,
      name,
      group: asString(row?.group),
      sequence: typeof row?.sequence === "number" ? row.sequence : undefined,
    };
  }

  function parseLabel(raw: unknown): PlaneLabel | undefined {
    const row = asRecord(raw);
    const id = asString(row?.id);
    const name = asString(row?.name);
    if (!id || !name) return undefined;
    return { id, name };
  }

  function parseModule(raw: unknown): PlaneModule | undefined {
    const row = asRecord(raw);
    const id = asString(row?.id);
    if (!id) return undefined;
    return {
      id,
      name: asString(row?.name) ?? id,
      status: asString(row?.status),
      created_at: asString(row?.created_at),
      target_date: asString(row?.target_date),
      start_date: asString(row?.start_date),
    };
  }

  async function loadCatalog(flags: string) {
    lastFlags = flags || defaultFlags;
    const workspace = workspaceOf(lastFlags);
    if (catalog && catalog.flags === lastFlags && catalog.workspace === workspace) return catalog;

      const projects = scopedProjects(
      (await paginate(`/workspaces/${workspace}/projects/`)).map(parseProject).filter((row): row is PlaneProject => !!row),
      lastFlags,
    );
    const states = new Map<string, Map<string, PlaneState>>();
    const labels = new Map<string, Map<string, PlaneLabel>>();
    const works = new Map<string, CachedWork>();
    const modules = new Map<string, CachedModule>();
    const columnStates: PlaneState[] = [];

    for (const project of projects) {
      const [stateRows, labelRows, moduleRows, workRows] = await Promise.all([
        paginate(`/workspaces/${workspace}/projects/${project.id}/states/`),
        paginate(`/workspaces/${workspace}/projects/${project.id}/labels/`),
        paginate(`/workspaces/${workspace}/projects/${project.id}/modules/`),
        withResource((resource) =>
          paginate(
            queryPath(`/workspaces/${workspace}/projects/${project.id}/${resource}/`, {
              expand: "assignees,labels,state,module",
            }),
          ),
        ),
      ]);
      const stateById = new Map<string, PlaneState>();
      for (const row of stateRows) {
        const state = parseState(row);
        if (!state) continue;
        stateById.set(state.id, state);
        columnStates.push(state);
      }
      const labelById = new Map<string, PlaneLabel>();
      for (const row of labelRows) {
        const label = parseLabel(row);
        if (label) labelById.set(label.id, label);
      }
      const moduleById = new Map<string, CachedModule>();
      for (const row of moduleRows) {
        const module = parseModule(row);
        if (!module) continue;
        const issue = moduleToIssue(module, project);
        const cached = { issue, module, project };
        moduleById.set(module.id, cached);
        modules.set(String(issue.key), cached);
      }
      states.set(project.id, stateById);
      labels.set(project.id, labelById);

      const workItems = workRows as PlaneWorkItem[];
      const missingModules =
        moduleById.size > 0 &&
        workItems.some(
          (item) => item.module_ids == null && item.modules == null && item.module == null,
        );
      const issueByModule = new Map<string, string[]>();
      if (missingModules && moduleById.size) {
        await Promise.all(
          [...moduleById.keys()].map(async (moduleId) => {
            const rows = await paginate(
              `/workspaces/${workspace}/projects/${project.id}/modules/${moduleId}/module-issues/`,
            );
            const ids = rows
              .map((row) => asId(asRecord(row)?.issue) ?? asId(row))
              .filter((id): id is string => !!id);
            issueByModule.set(moduleId, ids);
          }),
        );
      }

      for (const raw of workItems) {
        const item = raw as PlaneWorkItem;
        const fromItem = moduleIdsOf(item)[0];
        const fromJoin = [...issueByModule.entries()].find(([, ids]) => ids.includes(item.id))?.[0];
        const moduleId = fromItem ?? fromJoin;
        const moduleKey = moduleId ? moduleById.get(moduleId)?.issue.key : undefined;
        const issue = workItemToIssue(item, project, {
          states: stateById,
          labels: labelById,
          moduleKey: typeof moduleKey === "string" ? moduleKey : undefined,
        });
        const issueKey = typeof issue?.key === "string" ? issue.key : undefined;
        if (!issue || !issueKey) continue;
        works.set(issueKey, {
          issue,
          item,
          project,
          ...(typeof moduleKey === "string" ? { moduleKey } : {}),
        });
      }
    }

    catalog = {
        flags: lastFlags,
        workspace,
      projects,
      states,
      labels,
      works,
      modules,
      columns: orderStateNames(columnStates),
    };
    return catalog;
  }

  function filterWorks(flags: string, works: CachedWork[]): CachedWork[] {
    const parsed = parseFlags(flags || defaultFlags);
    return works.filter(({ issue }) => {
      const status = typeof issue.fields?.status?.name === "string" ? issue.fields.status.name : "";
      const type = typeof issue.fields?.issuetype?.name === "string" ? issue.fields.issuetype.name : "";
      const parent = asString(asRecord(issue.fields?.parent)?.key);
      const assignee = asString(asRecord(issue.fields?.assignee)?.displayName);
      if (parsed.jql.includes("type=") && !parsed.jql.includes('type="Epic"')) {
        const wanted = /type="([^"]+)"/.exec(parsed.jql)?.[1];
        if (wanted && wanted.toLowerCase() !== type.toLowerCase()) return false;
      }
      const statusEq = [...parsed.jql.matchAll(/status="([^"]+)"/g)].map((match) => match[1]);
      const statusNeq = [...parsed.jql.matchAll(/status!="([^"]+)"/g)].map((match) => match[1]);
      if (statusEq.length && !statusEq.some((name) => name.toLowerCase() === status.toLowerCase())) {
        return false;
      }
      if (statusNeq.some((name) => name.toLowerCase() === status.toLowerCase())) return false;
      const assigneeWanted = /assignee="([^"]+)"/.exec(parsed.jql)?.[1];
      if (assigneeWanted && assigneeWanted.toLowerCase() !== (assignee ?? "").toLowerCase()) {
        return false;
      }
      const parentWanted = /parent="([^"]+)"/.exec(parsed.jql)?.[1];
      if (parentWanted && parentWanted !== parent) return false;
      return true;
    });
  }

  async function lookupByKey(key: string, flags: string): Promise<CachedWork | undefined> {
    const loaded = await loadCatalog(flags);
    const cached = loaded.works.get(key);
    if (cached) return cached;
    if (loaded.modules.has(key)) return undefined;
    const raw = await withResource((resource) =>
      requestJson(`/workspaces/${loaded.workspace}/${resource}/${key}/`),
    );
    const row = asRecord(raw);
    if (!row) return undefined;
    const project =
      loaded.projects.find((item) => item.id === asString(row.project)) ??
      loaded.projects.find((item) => key.toUpperCase().startsWith(`${item.identifier}-`));
    if (!project) return undefined;
    const stateById = loaded.states.get(project.id) ?? new Map();
    const labelById = loaded.labels.get(project.id) ?? new Map();
    const item = raw as PlaneWorkItem;
    const issue = workItemToIssue(item, project, { states: stateById, labels: labelById });
    const issueKey = typeof issue?.key === "string" ? issue.key : undefined;
    if (!issue || !issueKey) return undefined;
    const next = { issue, item, project };
    loaded.works.set(issueKey, next);
    return next;
  }

  async function resolveLabelIds(project: PlaneProject, names: string[] | undefined, flags: string) {
    if (!names?.length) return [];
    const loaded = await loadCatalog(flags);
    const byName = new Map(
      [...(loaded.labels.get(project.id)?.values() ?? [])].map((label) => [label.name.toLowerCase(), label.id]),
    );
    return names.map((name) => byName.get(name.toLowerCase())).filter((id): id is string => !!id);
  }

  async function resolveStateId(project: PlaneProject, status: string, flags: string) {
    const loaded = await loadCatalog(flags);
    const states = [...(loaded.states.get(project.id)?.values() ?? [])];
    return states.find((state) => state.name.toLowerCase() === status.toLowerCase())?.id;
  }

  return {
    async list(flags) {
      const query = flags || defaultFlags;
      const loaded = await loadCatalog(query);
      const issues = filterWorks(query, [...loaded.works.values()]).map((row) => row.issue);
      return JSON.stringify(issues);
    },
    async listEpics(queryFlags = defaultFlags) {
      const loaded = await loadCatalog(queryFlags || defaultFlags);
      return JSON.stringify([...loaded.modules.values()].map((row) => row.issue));
    },
    async listEpic(key, queryFlags = defaultFlags) {
      const loaded = await loadCatalog(queryFlags || defaultFlags);
      const issues = [...loaded.works.values()]
        .filter((row) => row.moduleKey === key)
        .map((row) => row.issue);
      return JSON.stringify(issues);
    },
    async listChildren(keys) {
      const loaded = await loadCatalog(lastFlags);
      const wanted = new Set(keys);
      const issues = [...loaded.works.values()]
        .filter((row) => row.moduleKey && wanted.has(row.moduleKey))
        .map((row) => row.issue);
      return JSON.stringify(issues);
    },
    async states(flags) {
      const loaded = await loadCatalog(flags || defaultFlags);
      return loaded.columns;
    },
    async move(key, status) {
      try {
        const module = (await loadCatalog(lastFlags)).modules.get(key);
        if (module) {
          const mapped = Object.entries({
            backlog: "backlog",
            todo: "planned",
            "to do": "planned",
            "in progress": "in_progress",
            paused: "paused",
            done: "completed",
            completed: "completed",
            cancelled: "cancelled",
            canceled: "cancelled",
          }).find(([name]) => name === status.toLowerCase())?.[1];
          if (!mapped) return { ok: false, error: `Unknown Plane module status "${status}"` };
          await request(
            `/workspaces/${workspaceOf(lastFlags)}/projects/${module.project.id}/modules/${module.module.id}/`,
            { method: "PATCH", body: JSON.stringify({ status: mapped }) },
          );
          catalog = undefined;
          return { ok: true };
        }
        const work = await lookupByKey(key, lastFlags);
        if (!work) return { ok: false, error: `Work item ${key} not found` };
        const state = await resolveStateId(work.project, status, lastFlags);
        if (!state) return { ok: false, error: `Unknown Plane state "${status}" for ${key}` };
        await withResource((resource) =>
          request(
            `/workspaces/${workspaceOf(lastFlags)}/projects/${work.project.id}/${resource}/${work.item.id}/`,
            { method: "PATCH", body: JSON.stringify({ state }) },
          ),
        );
        catalog = undefined;
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async create(input) {
      try {
        const loaded = await loadCatalog(lastFlags);
        const parent = input.parent ? loaded.modules.get(input.parent) : undefined;
        const project = parent?.project ?? loaded.projects[0];
        if (!project) return { ok: false, error: "No Plane project in Scope" };
        const state = input.status?.trim()
          ? await resolveStateId(project, input.status.trim(), lastFlags)
          : undefined;
        const labels = await resolveLabelIds(project, input.labels, lastFlags);
        const body: Record<string, unknown> = { name: input.summary };
        if (input.description) body.description_html = htmlParagraph(input.description);
        if (state) body.state = state;
        if (labels.length) body.labels = labels;
        const created = asRecord(
          await withResource((resource) =>
            requestJson(`/workspaces/${workspaceOf(lastFlags)}/projects/${project.id}/${resource}/`, {
              method: "POST",
              body: JSON.stringify(body),
            }),
          ),
        );
        const sequence = Number(created?.sequence_id);
        const key =
          Number.isFinite(sequence) && sequence > 0
            ? planeWorkItemKey(project.identifier, sequence)
            : undefined;
        if (parent && created?.id) {
          await request(
            `/workspaces/${workspaceOf(lastFlags)}/projects/${project.id}/modules/${parent.module.id}/module-issues/`,
            { method: "POST", body: JSON.stringify({ issues: [created.id] }) },
          );
        }
        catalog = undefined;
        return key ? { ok: true, key } : { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async edit(key, input) {
      try {
        const work = await lookupByKey(key, lastFlags);
        if (!work) return { ok: false, error: `Work item ${key} not found` };
        const body: Record<string, unknown> = {};
        if (input.summary !== undefined) body.name = input.summary;
        if (input.description !== undefined) body.description_html = htmlParagraph(input.description);
        if (input.labels) body.labels = await resolveLabelIds(work.project, input.labels, lastFlags);
        await withResource((resource) =>
          request(
            `/workspaces/${workspaceOf(lastFlags)}/projects/${work.project.id}/${resource}/${work.item.id}/`,
            { method: "PATCH", body: JSON.stringify(body) },
          ),
        );
        catalog = undefined;
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
    async open(key) {
      return `${host}/${workspaceOf(lastFlags)}/browse/${key}`;
    },
    async view(key) {
      const loaded = await loadCatalog(lastFlags);
      const module = loaded.modules.get(key);
      if (module) return JSON.stringify(module.issue);
      const work = await lookupByKey(key, lastFlags);
      if (work) return JSON.stringify(work.issue);
      throw new Error(`Work item ${key} not found`);
    },
  };
}
