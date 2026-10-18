import { isNeedsInputLabel } from "./board.ts";
import {
  projectIdentifier,
  saveView,
  statusTypeOf,
  type InboxNotification,
  type LinearFavorite,
  type SavedView,
  type ViewFilter,
  type ViewKind,
  type ViewScope,
} from "./parity.ts";

export const FAVORITE_FOLDERS_KEY = "linear-favorite-folders";
export const ISSUE_PROJECT_KEY = "issue-project-assignments";
export const SIDEBAR_SECTIONS_KEY = "sidebar-sections";

export const PERF = {
  script: "pipe-kan:script-start",
  column: "pipe-kan:first-column",
  cold: "pipe-kan:cold-load",
  project: "pipe-kan:project-switch",
  workspace: "pipe-kan:workspace-switch",
} as const;

export const ICON_SPEC = {
  status: 14,
  priority: 12,
  project: 14,
  cycle: 12,
  labelDot: 8,
  avatar: 20,
  nav: 16,
  filterRow: 32,
  chevron: 12,
  statusStroke: 1.5,
  navStroke: 1.5,
  chevronStroke: 2,
} as const;

export const VIEW_ICONS = ["List", "LayoutGrid", "CalendarDays", "BarChart3", "Bug", "Zap", "Map", "Timer"] as const;

export const SIDEBAR_TOP = ["Inbox", "Pulse", "Agent"] as const;
export const WORKSPACE_ITEMS = ["Projects", "Views", "Initiatives", "More"] as const;
export const TEAM_ITEMS = ["Home", "Triage", "Issues", "Cycles", "Projects", "Views"] as const;
export const CYCLE_ITEMS = ["Current", "Upcoming"] as const;
export const FOOTER_ITEMS = ["Try", "Invite people", "Connect GitHub"] as const;
export const STATUS_TYPES = ["Backlog", "Unstarted", "Started", "Completed", "Cancelled"] as const;
export const PRIORITY_VALUES = ["Urgent", "High", "Medium", "Low", "None"] as const;

export type FilterRowKind = "prompt" | "advanced" | "backend" | "soon";

export type FilterRow = {
  id: string;
  label: string;
  icon: string;
  kind: FilterRowKind;
};

/** Named Add Filter rows. The plan's "21" under-counts this list. */
export const ADD_FILTER_ROWS: FilterRow[] = [
  { id: "ai", label: "AI filter", icon: "Sparkles", kind: "prompt" },
  { id: "advanced", label: "Advanced filter", icon: "SlidersHorizontal", kind: "advanced" },
  { id: "status", label: "Status", icon: "CircleDot", kind: "backend" },
  { id: "statusType", label: "Status type", icon: "Layers", kind: "backend" },
  { id: "assignee", label: "Assignee", icon: "User", kind: "backend" },
  { id: "agent", label: "Agent", icon: "Bot", kind: "soon" },
  { id: "creator", label: "Creator", icon: "UserPlus", kind: "soon" },
  { id: "priority", label: "Priority", icon: "Flag", kind: "backend" },
  { id: "estimate", label: "Estimate", icon: "Gauge", kind: "soon" },
  { id: "labels", label: "Labels", icon: "Tag", kind: "backend" },
  { id: "relations", label: "Relations", icon: "GitBranch", kind: "soon" },
  { id: "suggestedLabel", label: "Suggested label", icon: "Lightbulb", kind: "soon" },
  { id: "dates", label: "Dates", icon: "Calendar", kind: "backend" },
  { id: "project", label: "Project", icon: "Box", kind: "backend" },
  { id: "projectProperties", label: "Project properties", icon: "Settings", kind: "backend" },
  { id: "initiative", label: "Initiative", icon: "Target", kind: "backend" },
  { id: "cycle", label: "Cycle", icon: "Clock", kind: "soon" },
  { id: "addedToCycle", label: "Added to cycle", icon: "PlusCircle", kind: "soon" },
  { id: "subscribers", label: "Subscribers", icon: "Users", kind: "soon" },
  { id: "autoClosed", label: "Auto-closed", icon: "CheckCircle2", kind: "soon" },
  { id: "content", label: "Content", icon: "FileText", kind: "soon" },
  { id: "links", label: "Links", icon: "Link", kind: "soon" },
  { id: "template", label: "Template", icon: "FileStack", kind: "soon" },
];

export type ViewDraft = {
  icon: string;
  title: string;
  description: string;
  kind: ViewKind;
  scope: ViewScope;
};

export const EMPTY_VIEW_DRAFT: ViewDraft = {
  icon: "List",
  title: "",
  description: "",
  kind: "issues",
  scope: "personal",
};

export function createNamedView(
  views: SavedView[],
  draft: ViewDraft,
  filter: ViewFilter,
): { ok: true; views: SavedView[] } | { ok: false; reason: string } {
  const saved = saveView(views, draft.title, filter, {
    icon: draft.icon,
    description: draft.description.trim(),
    scope: draft.scope,
    kind: draft.kind,
  });
  if (!saved.ok) return { ok: false, reason: draft.title.trim() ? "View names must be unique" : "Title is required" };
  return saved;
}

export function groupSavedViews(views: SavedView[], kind?: ViewKind) {
  const rows = kind ? views.filter((view) => (view.kind ?? "issues") === kind) : views;
  return {
    personal: rows.filter((view) => (view.scope ?? "personal") === "personal"),
    team: rows.filter((view) => view.scope === "team"),
  };
}

export type FilterOptions = {
  status: string[];
  assignee: string[];
  priority: string[];
  labels: string[];
  project: string[];
  initiative: string[];
};

export function toggleFilterList(filter: ViewFilter, key: "status" | "assignee" | "priority" | "labels" | "project" | "statusType" | "initiative" | "health", value: string): ViewFilter {
  const current = filter[key] ?? [];
  const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
  if (key === "status" || key === "assignee" || key === "priority" || key === "labels" || key === "project") {
    return { ...filter, [key]: next };
  }
  if (!next.length) {
    const copy = { ...filter };
    delete copy[key];
    return copy;
  }
  return { ...filter, [key]: next };
}

export function statusMark(status: string): { hollow: boolean; token: string } {
  const type = statusTypeOf(status);
  if (type === "Cancelled") return { hollow: false, token: "--status-cancelled" };
  if (status.trim().toLowerCase() === "paused") return { hollow: true, token: "--status-paused" };
  if (type === "Started") return { hollow: false, token: "--status-active" };
  if (type === "Completed") return { hollow: false, token: "--status-done" };
  if (type === "Backlog") return { hollow: true, token: "--status-backlog" };
  return { hollow: true, token: "--status-todo" };
}

export function priorityToken(priority?: string): string {
  const key = (priority ?? "none").trim().toLowerCase();
  if (key === "urgent" || key === "highest" || key === "critical") return "--priority-urgent";
  if (key === "high") return "--priority-high";
  if (key === "medium") return "--priority-medium";
  if (key === "low") return "--priority-low";
  return "--priority-none";
}

export function labelToken(label: string): string {
  let hash = 0;
  for (const char of label) hash = (hash + char.charCodeAt(0)) % 6;
  return `--label-${hash + 1}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

export type InboxCard = { key: string; assignee?: string; labels?: string[] };

export function inboxBadgeCount(cards: InboxCard[], read: boolean): string {
  if (read) return "";
  const count = cards.filter((card) => (card.labels ?? []).some((label) => isNeedsInputLabel(label))).length;
  if (count <= 0) return "";
  return count > 9 ? "9+" : String(count);
}

export function inboxNotifications(cards: InboxCard[]): InboxNotification[] {
  const kinds = ["update", "assign", "mention"] as const;
  const source = cards.length
    ? cards
    : [
        { key: "DEMO-12", assignee: "Ada" },
        { key: "DEMO-3", assignee: "Grace" },
        { key: "DEMO-8", assignee: "Ada" },
        { key: "DEMO-15", assignee: "Grace" },
        { key: "DEMO-21", assignee: "Ada" },
      ];
  const total = Math.max(5, source.length);
  const rows: InboxNotification[] = [];
  for (let index = 0; index < total; index += 1) {
    const card = source[index % source.length]!;
    const kind = kinds[index % kinds.length]!;
    const text =
      kind === "update" ? `${card.key} was updated` : kind === "assign" ? `${card.key} assigned to you` : `${card.key} mentioned you`;
    rows.push({
      id: `${card.key}:${kind}:${index}`,
      kind,
      issueKey: card.key,
      text,
      actor: card.assignee || "Ada",
      ago: `${index + 1}h ago`,
      unread: true,
    });
  }
  return rows;
}

export function triageCount(needsInput: number): number {
  return needsInput > 0 ? needsInput : 15;
}

export function addFavoriteFolder(folders: string[], name: string): { ok: true; folders: string[] } | { ok: false } {
  const trimmed = name.trim();
  if (!trimmed || folders.some((folder) => folder.toLowerCase() === trimmed.toLowerCase())) return { ok: false };
  return { ok: true, folders: [...folders, trimmed] };
}

export function groupLinearFavorites(favorites: LinearFavorite[], folders: string[]) {
  const named = new Set(folders);
  return {
    groups: folders.map((name) => ({
      name,
      items: favorites.filter((item) => item.folder === name),
    })),
    loose: favorites.filter((item) => !item.folder || !named.has(item.folder)),
  };
}

export function fileLinearFavorite(list: LinearFavorite[], item: Pick<LinearFavorite, "kind" | "id">, folder?: string): LinearFavorite[] {
  return list.map((entry) => (entry.kind === item.kind && entry.id === item.id ? { ...entry, folder } : entry));
}

export type PickerProject = {
  id: string;
  identifier: string;
  name: string;
  workspace: string;
  status: string;
  owner: string;
  priority: string;
  progress: number;
  issues: number;
};

export function filterPickerProjects(projects: PickerProject[], query: string): PickerProject[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return projects;
  return projects.filter((project) =>
    project.name.toLowerCase().includes(needle) ||
    project.identifier.toLowerCase().includes(needle) ||
    project.id.toLowerCase().includes(needle),
  );
}

export function projectChip(identifier: string): string {
  return `P-${identifier}`;
}

export function issueProjectId(key: string, assignments: Record<string, string>): string {
  if (Object.prototype.hasOwnProperty.call(assignments, key)) return assignments[key] ?? "";
  return projectIdentifier(key);
}

export function assignIssueProject(map: Record<string, string>, key: string, projectId: string): Record<string, string> {
  const next = { ...map };
  if (!projectId) next[key] = "";
  else next[key] = projectId;
  return next;
}

export function switchKind(previousWorkspaces: string[], nextWorkspaces: string[]): "workspace" | "project" {
  const left = previousWorkspaces.map((item) => item.toLowerCase()).sort().join(",");
  const right = nextWorkspaces.map((item) => item.toLowerCase()).sort().join(",");
  return left === right ? "project" : "workspace";
}
