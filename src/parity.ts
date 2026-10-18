export type Health = "green" | "yellow" | "red" | "gray";

export const HEALTH_COLOR: Record<Health, string> = {
  green: "#22c55e",
  yellow: "#eab308",
  red: "#ef4444",
  gray: "#9ca3af",
};

export function healthLabel(health: Health): string {
  if (health === "green") return "On track";
  if (health === "yellow") return "At risk";
  if (health === "red") return "Off track";
  return "No updates";
}

export const HEALTH_FILTERS = ["On track", "At risk", "Off track", "Update missing", "No update expected"] as const;

export function healthMatches(health: Health, selected: string[] | undefined): boolean {
  if (!selected?.length) return true;
  return selected.some((label) => {
    const key = label.toLowerCase();
    if (key === "on track") return health === "green";
    if (key === "at risk") return health === "yellow";
    if (key === "off track") return health === "red";
    return health === "gray";
  });
}

export type Opener = "stories" | "epics" | "combined" | "initiatives" | "projects";

export type Layout = "list" | "board" | "timeline";
export type Grouping =
  | "status"
  | "health"
  | "target"
  | "initiative"
  | "assignee"
  | "project"
  | "priority"
  | "label";
export type Ordering = "manual" | "status" | "priority" | "updated" | "created" | "target";
export type Zoom = "week" | "month" | "quarter" | "year";
export type CompletedWindow = "week" | "month" | "year" | "all" | "none";

export type DisplayOptions = {
  layout: Layout;
  grouping: Grouping;
  ordering: Ordering;
  zoom: Zoom;
  showEmptyGroups: boolean;
  completed: CompletedWindow;
  showSubIssues?: boolean;
  properties?: string[];
};

export const DEFAULT_DISPLAY: DisplayOptions = {
  layout: "board",
  grouping: "status",
  ordering: "manual",
  zoom: "month",
  showEmptyGroups: true,
  completed: "all",
};

export type DateRange = { from?: string; to?: string };

export type ViewFilter = {
  created?: DateRange;
  updated?: DateRange;
  due?: DateRange;
  status: string[];
  assignee: string[];
  priority: string[];
  labels: string[];
  project: string[];
  health?: string[];
};

export const EMPTY_VIEW_FILTER: ViewFilter = {
  status: [],
  assignee: [],
  priority: [],
  labels: [],
  project: [],
};

export type SavedView = {
  name: string;
  filter: ViewFilter;
  default?: boolean;
};

export type ScopePair = { workspace: string; project: string };

export type ParityInitiative = {
  key: string;
  name: string;
  workspace: string;
  project: string;
  status: string;
  rawStatus: string;
  priority?: string;
  startDate?: string;
  targetDate?: string;
  updated?: string;
  health: Health;
  activeProjects: number;
};

export type ParityProject = {
  workspace: string;
  id: string;
  identifier: string;
  name: string;
  total: number;
  completed: number;
  status: string;
  startDate?: string;
  targetDate?: string;
  updated?: string;
  health: Health;
};

export type ParitySnapshot = {
  initiatives: ParityInitiative[];
  projects: ParityProject[];
  workspaces: string[];
};

export type SourceId = "plane" | "jira" | "taskwarrior";

export type SourceOption = {
  id: SourceId;
  label: string;
  enabled: boolean;
  reason?: string;
};

export type LinearFavorite = {
  kind: "initiative" | "project" | "issue";
  id: string;
  label: string;
};

const STATUS_RANK = ["backlog", "todo", "to do", "in progress", "paused", "done", "cancelled", "canceled"];
const PRIORITY_RANK = ["urgent", "high", "medium", "low", "none"];

export function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function parseDay(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function computeHealth(status: string, targetDate?: string, now = new Date()): Health {
  const key = normalizeStatus(status);
  if (key === "done" || key === "completed" || key === "complete") return "green";
  if (key === "cancelled" || key === "canceled") return "red";
  if (key === "in progress" || key === "started" || key === "active" || key === "paused") {
    const target = parseDay(targetDate);
    if (key === "paused") return "yellow";
    if (target && target.getTime() < startOfToday(now).getTime()) return "yellow";
    return "green";
  }
  if (
    key === "todo" ||
    key === "to do" ||
    key === "backlog" ||
    key === "planned" ||
    key === "unstarted" ||
    key === ""
  ) {
    return "gray";
  }
  return "gray";
}

export function isCompletedStatus(status: string): boolean {
  const key = normalizeStatus(status);
  return key === "done" || key === "completed" || key === "complete" || key === "cancelled" || key === "canceled";
}

export function includeCompleted(
  status: string,
  targetDate: string | undefined,
  window: CompletedWindow,
  now = new Date(),
): boolean {
  if (!isCompletedStatus(status)) return true;
  if (window === "none") return false;
  if (window === "all") return true;
  const day = parseDay(targetDate);
  if (!day) return false;
  const span = window === "week" ? 7 : window === "month" ? 30 : 365;
  const today = startOfToday(now).getTime();
  const delta = today - day.getTime();
  return delta >= 0 && delta <= span * 86_400_000;
}

export function projectIdentifier(key: string): string {
  const bare = key.includes("/") ? key.slice(key.indexOf("/") + 1) : key;
  const moduleKey = /^([A-Z][A-Z0-9]*)M-\d+$/i.exec(bare);
  if (moduleKey?.[1]) return moduleKey[1].toUpperCase();
  const issueKey = /^([A-Z][A-Z0-9]*)-\d+$/i.exec(bare);
  return issueKey?.[1]?.toUpperCase() ?? "";
}

export function scopeKey(pair: ScopePair): string {
  return `${pair.workspace.trim().toLowerCase()}/${pair.project.trim().toUpperCase()}`;
}

export function toggleScope(pairs: ScopePair[], pair: ScopePair): ScopePair[] {
  const key = scopeKey(pair);
  if (pairs.some((item) => scopeKey(item) === key)) {
    return pairs.filter((item) => scopeKey(item) !== key);
  }
  return [...pairs, { workspace: pair.workspace.trim().toLowerCase(), project: pair.project.trim().toUpperCase() }];
}

export function toggleWorkspace(slugs: string[], slug: string): string[] {
  const key = slug.trim().toLowerCase();
  if (!key) return slugs;
  if (slugs.some((item) => item.toLowerCase() === key)) {
    return slugs.filter((item) => item.toLowerCase() !== key);
  }
  return [...slugs, key];
}

function statusRank(status?: string): number {
  const key = normalizeStatus(status ?? "");
  const index = STATUS_RANK.indexOf(key);
  return index === -1 ? STATUS_RANK.length : index;
}

function priorityRank(priority?: string): number {
  const key = (priority ?? "none").trim().toLowerCase();
  const index = PRIORITY_RANK.indexOf(key);
  return index === -1 ? PRIORITY_RANK.length : index;
}

export function orderRows<T>(
  rows: T[],
  ordering: Ordering,
  pick: (row: T) => {
    status?: string;
    priority?: string;
    updated?: string;
    created?: string;
    target?: string;
  },
): T[] {
  const next = [...rows];
  if (ordering === "manual") return next;
  next.sort((a, b) => {
    const left = pick(a);
    const right = pick(b);
    if (ordering === "status") return statusRank(left.status) - statusRank(right.status);
    if (ordering === "priority") return priorityRank(left.priority) - priorityRank(right.priority);
    const field = ordering === "updated" ? "updated" : ordering === "created" ? "created" : "target";
    const aTime = parseDay(left[field])?.getTime() ?? Number.POSITIVE_INFINITY;
    const bTime = parseDay(right[field])?.getTime() ?? Number.POSITIVE_INFINITY;
    return aTime - bTime;
  });
  return next;
}

export function groupRows<T>(
  rows: T[],
  groupOf: (row: T) => string,
  showEmpty: boolean,
  emptyLabels: string[] = [],
): { key: string; rows: T[] }[] {
  const buckets = new Map<string, T[]>();
  for (const label of emptyLabels) buckets.set(label, []);
  for (const row of rows) {
    const key = groupOf(row) || "None";
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }
  return [...buckets.entries()]
    .filter(([, list]) => showEmpty || list.length > 0)
    .map(([key, list]) => ({ key, rows: list }));
}

export type TimelineBar = {
  id: string;
  label: string;
  group: string;
  health: Health;
  x: number;
  width: number;
  unscheduled: boolean;
};

export type TimelineLayout = {
  width: number;
  todayX: number;
  ticks: { label: string; x: number }[];
  bars: TimelineBar[];
  unscheduled: { id: string; label: string; health: Health; group: string }[];
};

const PX_PER_DAY: Record<Zoom, number> = { week: 28, month: 8, quarter: 3, year: 1 };

function addDays(day: Date, count: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + count);
}

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

function tickLabel(day: Date, zoom: Zoom): string {
  if (zoom === "year") return String(day.getFullYear());
  if (zoom === "quarter") return `Q${Math.floor(day.getMonth() / 3) + 1} ${day.getFullYear()}`;
  if (zoom === "month") {
    return day.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  return day.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function layoutTimeline(
  items: { id: string; label: string; group: string; health: Health; start?: string; end?: string }[],
  zoom: Zoom,
  now = new Date(),
): TimelineLayout {
  const unscheduled = items
    .filter((item) => !parseDay(item.start) && !parseDay(item.end))
    .map((item) => ({ id: item.id, label: item.label, health: item.health, group: item.group }));
  const scheduled = items.filter((item) => parseDay(item.start) || parseDay(item.end));
  const today = startOfToday(now);
  const anchors = scheduled.flatMap((item) => {
    const start = parseDay(item.start);
    const end = parseDay(item.end);
    return [start, end].filter((day): day is Date => Boolean(day));
  });
  let min = anchors.length ? anchors.reduce((a, b) => (a < b ? a : b)) : today;
  let max = anchors.length ? anchors.reduce((a, b) => (a > b ? a : b)) : addDays(today, 30);
  if (min > today) min = today;
  if (max < today) max = today;
  min = addDays(min, -7);
  max = addDays(max, 7);
  const span = Math.max(1, daysBetween(min, max));
  const px = PX_PER_DAY[zoom];
  const width = Math.max(640, span * px);
  const xOf = (day: Date) => daysBetween(min, day) * px;
  const ticks: { label: string; x: number }[] = [];
  const seen = new Set<string>();
  for (let cursor = new Date(min); cursor <= max; cursor = addDays(cursor, 1)) {
    const stamp =
      zoom === "week"
        ? cursor.getDay() === 1
        : zoom === "month"
          ? cursor.getDate() === 1
          : zoom === "quarter"
            ? cursor.getDate() === 1 && cursor.getMonth() % 3 === 0
            : cursor.getMonth() === 0 && cursor.getDate() === 1;
    if (!stamp) continue;
    const label = tickLabel(cursor, zoom);
    if (seen.has(label)) continue;
    seen.add(label);
    ticks.push({ label, x: xOf(cursor) });
  }
  const bars: TimelineBar[] = scheduled.map((item) => {
    const start = parseDay(item.start) ?? parseDay(item.end) ?? today;
    const end = parseDay(item.end) ?? parseDay(item.start) ?? start;
    const left = xOf(start < end ? start : end);
    const right = xOf(addDays(start < end ? end : start, 1));
    return {
      id: item.id,
      label: item.label,
      group: item.group,
      health: item.health,
      x: left,
      width: Math.max(px, right - left),
      unscheduled: false,
    };
  });
  return { width, todayX: xOf(today), ticks, bars, unscheduled };
}

export function sourceOptions(input: { planeKey: boolean; jiraBin: boolean }): SourceOption[] {
  return [
    {
      id: "plane",
      label: "Plane",
      enabled: input.planeKey,
      ...(input.planeKey ? {} : { reason: "Set PLANE_API_KEY to use Plane" }),
    },
    {
      id: "jira",
      label: "Jira",
      enabled: true,
      ...(input.jiraBin ? {} : { reason: "jira-cli is not on PATH; Fake Jira is used" }),
    },
    {
      id: "taskwarrior",
      label: "Taskwarrior",
      enabled: false,
      reason: "Taskwarrior is not connected",
    },
  ];
}

export function isWorkspaceChord(query: string): boolean {
  return query.trim().toLowerCase() === "ow";
}

function inRange(value: string | undefined, range: DateRange | undefined): boolean {
  if (!range || (!range.from && !range.to)) return true;
  const day = parseDay(value);
  if (!day) return false;
  const from = parseDay(range.from);
  const to = parseDay(range.to);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export type Filterable = {
  created?: string;
  updated?: string;
  due?: string;
  status?: string;
  assignee?: string;
  priority?: string;
  labels?: string[];
  project?: string;
  health?: Health;
};

export function matchViewFilter(item: Filterable, filter: ViewFilter): boolean {
  if (!inRange(item.created, filter.created)) return false;
  if (!inRange(item.updated, filter.updated)) return false;
  if (!inRange(item.due, filter.due)) return false;
  if (filter.status.length && !filter.status.some((status) => normalizeStatus(status) === normalizeStatus(item.status ?? ""))) {
    return false;
  }
  if (filter.assignee.length && !filter.assignee.some((name) => name.toLowerCase() === (item.assignee ?? "").toLowerCase())) {
    return false;
  }
  if (filter.priority.length && !filter.priority.some((name) => name.toLowerCase() === (item.priority ?? "").toLowerCase())) {
    return false;
  }
  if (filter.labels.length) {
    const labels = new Set((item.labels ?? []).map((label) => label.toLowerCase()));
    if (!filter.labels.some((label) => labels.has(label.toLowerCase()))) return false;
  }
  if (filter.project.length && !filter.project.some((project) => project.toUpperCase() === (item.project ?? "").toUpperCase())) {
    return false;
  }
  if (item.health && !healthMatches(item.health, filter.health)) return false;
  return true;
}

export function viewFilterChips(filter: ViewFilter): { id: string; label: string }[] {
  const chips: { id: string; label: string }[] = [];
  const dateChip = (id: string, title: string, range?: DateRange) => {
    if (!range || (!range.from && !range.to)) return;
    if (range.from && !range.to) chips.push({ id, label: `${title} after ${range.from}` });
    else if (!range.from && range.to) chips.push({ id, label: `${title} before ${range.to}` });
    else chips.push({ id, label: `${title} ${range.from} – ${range.to}` });
  };
  dateChip("created", "Created", filter.created);
  dateChip("updated", "Latest update date", filter.updated);
  dateChip("due", "Due", filter.due);
  for (const health of filter.health ?? []) chips.push({ id: `health:${health}`, label: `Health is ${health}` });
  for (const status of filter.status) chips.push({ id: `status:${status}`, label: `Status ${status}` });
  for (const assignee of filter.assignee) chips.push({ id: `assignee:${assignee}`, label: `Assignee ${assignee}` });
  for (const priority of filter.priority) chips.push({ id: `priority:${priority}`, label: `Priority ${priority}` });
  for (const label of filter.labels) chips.push({ id: `label:${label}`, label: `Label ${label}` });
  for (const project of filter.project) chips.push({ id: `project:${project}`, label: `Project ${project}` });
  return chips;
}

export function clearViewChip(filter: ViewFilter, id: string): ViewFilter {
  const next: ViewFilter = {
    ...filter,
    status: [...filter.status],
    assignee: [...filter.assignee],
    priority: [...filter.priority],
    labels: [...filter.labels],
    project: [...filter.project],
    ...(filter.health ? { health: [...filter.health] } : {}),
    ...(filter.created ? { created: { ...filter.created } } : {}),
    ...(filter.updated ? { updated: { ...filter.updated } } : {}),
    ...(filter.due ? { due: { ...filter.due } } : {}),
  };
  if (id === "created") delete next.created;
  else if (id === "updated") delete next.updated;
  else if (id === "due") delete next.due;
  else if (id.startsWith("status:")) next.status = next.status.filter((item) => `status:${item}` !== id);
  else if (id.startsWith("assignee:")) next.assignee = next.assignee.filter((item) => `assignee:${item}` !== id);
  else if (id.startsWith("priority:")) next.priority = next.priority.filter((item) => `priority:${item}` !== id);
  else if (id.startsWith("label:")) next.labels = next.labels.filter((item) => `label:${item}` !== id);
  else if (id.startsWith("project:")) next.project = next.project.filter((item) => `project:${item}` !== id);
  else if (id.startsWith("health:")) {
    next.health = (next.health ?? []).filter((item) => `health:${item}` !== id);
    if (!next.health.length) delete next.health;
  }
  return next;
}

export function viewFilterActive(filter: ViewFilter): boolean {
  return viewFilterChips(filter).length > 0;
}

export function saveView(
  views: SavedView[],
  name: string,
  filter: ViewFilter,
): { ok: true; views: SavedView[] } | { ok: false } {
  const trimmed = name.trim();
  if (!trimmed || views.some((view) => view.name.toLowerCase() === trimmed.toLowerCase())) return { ok: false };
  return { ok: true, views: [...views, { name: trimmed, filter }] };
}

export function setDefaultView(views: SavedView[], name: string): SavedView[] {
  const key = name.trim().toLowerCase();
  return views.map((view) => ({ ...view, default: view.name.toLowerCase() === key }));
}

export function defaultView(views: SavedView[]): SavedView | undefined {
  return views.find((view) => view.default);
}

export function toggleLinearFavorite(list: LinearFavorite[], item: LinearFavorite): LinearFavorite[] {
  if (list.some((entry) => entry.kind === item.kind && entry.id === item.id)) {
    return list.filter((entry) => !(entry.kind === item.kind && entry.id === item.id));
  }
  return [...list, item];
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const DISPLAY_KEY = "board-display-options";
export const VIEW_FILTER_KEY = "board-view-filter";
export const SAVED_VIEWS_KEY = "board-saved-views";
export const LINEAR_FAVORITES_KEY = "linear-favorites";

export function initiativeGroup(row: ParityInitiative, grouping: Grouping): string {
  if (grouping === "health") return row.health;
  if (grouping === "target") return row.targetDate?.slice(0, 7) || "No target";
  if (grouping === "project" || grouping === "initiative") return row.project;
  if (grouping === "priority") return row.priority || "None";
  if (grouping === "assignee") return "Unassigned";
  if (grouping === "label") return "No label";
  return row.status || "None";
}

export function projectGroup(row: ParityProject, grouping: Grouping, initiative?: string): string {
  if (grouping === "health") return row.health;
  if (grouping === "initiative") return initiative || "No initiative";
  if (grouping === "target") return row.targetDate?.slice(0, 7) || "No target";
  if (grouping === "project") return row.identifier;
  return row.status || "None";
}

export function filterParity<T extends { status: string; targetDate?: string }>(
  rows: T[],
  completed: CompletedWindow,
  now = new Date(),
): T[] {
  return rows.filter((row) => includeCompleted(row.status, row.targetDate, completed, now));
}

export function effectiveLayout(kind: Opener, display: DisplayOptions, touched: boolean): Layout {
  const roadmap = kind === "initiatives" || kind === "projects";
  if (!touched) return roadmap ? "list" : "board";
  if (!roadmap && display.layout === "timeline") return "board";
  return display.layout;
}
