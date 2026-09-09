export type Epic = {
  key: string;
  summary: string;
  status?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  targetEnd?: string;
  labels?: string[];
};

export type Card = {
  key: string;
  summary: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  targetEnd?: string;
  type?: string;
  epic?: string;
  labels?: string[];
  created?: string;
};

export type Column = {
  id: string;
  title: string;
  cards: Card[];
};
export type Board = {
  columns: Column[];
  epics: Epic[];
  children?: Record<string, Card[]>;
  error?: string;
};

export type RawIssue = {
  key?: unknown;
  fields?: {
    summary?: unknown;
    status?: { name?: unknown };
    priority?: { name?: unknown };
    assignee?: unknown;
    duedate?: unknown;
    issuetype?: { name?: unknown };
    issueType?: { name?: unknown };
    parent?: { key?: unknown };
    parentEpic?: unknown;
    "Epic Link"?: unknown;
    labels?: unknown;
    components?: unknown;
    created?: unknown;
    // Plausible Jira field names for "Target End Date".
    // Jira Advanced Roadmaps stores this in a customfield_NNNNN whose key varies by install,
    // so issueTargetEnd also scans customfield_* entries as a best-effort fallback.
    targetEnd?: unknown;
    targetend?: unknown;
    targetEndDate?: unknown;
    targetenddate?: unknown;
    "Target End"?: unknown;
    "Target End Date"?: unknown;
  } & Record<string, unknown>;
};

function formatDueDate(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = day
    ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTargetEnd(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const date = day
    ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function createdAt(fields: RawIssue["fields"]): string | undefined {
  return typeof fields?.created === "string" && fields.created
    ? fields.created
    : undefined;
}

export function cardAge(created: unknown, now = Date.now()): string | undefined {
  if (typeof created !== "string" || !created) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(created);
  const start = day
    ? Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : Date.parse(created);
  if (Number.isNaN(start)) return undefined;
  const end = new Date(now);
  const today = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const origin = day ? start : Date.UTC(
    new Date(start).getUTCFullYear(),
    new Date(start).getUTCMonth(),
    new Date(start).getUTCDate(),
  );
  const days = Math.max(0, Math.round((today - origin) / 86_400_000));
  return `${days}d`;
}

export function targetEndDistance(targetEnd: unknown, now = Date.now()): string | undefined {
  const formatted = formatTargetEnd(targetEnd);
  if (!formatted) return undefined;
  const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(targetEnd as string);
  const target = day
    ? Date.UTC(Number(day[1]), Number(day[2]) - 1, Number(day[3]))
    : Date.parse(targetEnd as string);
  if (Number.isNaN(target)) return undefined;
  const end = new Date(now);
  const today = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  const days = Math.round((target - today) / 86_400_000);
  const absDays = Math.abs(days);
  if (absDays < 7) return `${absDays}d`;
  if (absDays < 60) return `${Math.max(1, Math.floor(absDays / 7))}w`;
  return `${Math.max(1, Math.round(absDays / 30))}m`;
}

function issueType(fields: RawIssue["fields"]): string | undefined {
  const name = fields?.issuetype?.name ?? fields?.issueType?.name;
  return typeof name === "string" ? name : undefined;
}

function asIssueKey(value: unknown): string | undefined {
  if (typeof value === "string") {
    const key = value.trim();
    return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(key) ? key : undefined;
  }
  if (value && typeof value === "object" && "key" in value) {
    return asIssueKey((value as { key?: unknown }).key);
  }
  return undefined;
}

function epicKey(fields: RawIssue["fields"]): string | undefined {
  if (!fields) return undefined;
  const named =
    asIssueKey(fields.parent) ??
    asIssueKey(fields.parentEpic) ??
    asIssueKey(fields["Epic Link"]);
  if (named) return named;
  for (const [name, value] of Object.entries(fields)) {
    if (!name.startsWith("customfield_")) continue;
    const key = asIssueKey(value);
    if (key) return key;
  }
  return undefined;
}

function labelName(item: unknown): string | undefined {
  if (typeof item === "string" && item) return item;
  if (item && typeof item === "object" && "name" in item) {
    const name = (item as { name?: unknown }).name;
    if (typeof name === "string" && name) return name;
  }
  return undefined;
}

function issueLabels(fields: RawIssue["fields"]): string[] | undefined {
  const raw = [
    ...(Array.isArray(fields?.labels) ? fields.labels : []),
    ...(Array.isArray(fields?.components) ? fields.components : []),
  ];
  const labels = [...new Set(raw.map(labelName).filter((name): name is string => !!name))];
  return labels.length > 0 ? labels : undefined;
}

function issueStatus(fields: RawIssue["fields"]): string | undefined {
  return typeof fields?.status?.name === "string" && fields.status.name
    ? fields.status.name
    : undefined;
}

function issueAssignee(fields: RawIssue["fields"]): string | undefined {
  const raw = fields?.assignee;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (!raw || typeof raw !== "object") return undefined;
  const assignee = raw as { displayName?: unknown; name?: unknown };
  if (typeof assignee.displayName === "string" && assignee.displayName.trim()) {
    return assignee.displayName.trim();
  }
  if (typeof assignee.name === "string" && assignee.name.trim()) {
    return assignee.name.trim();
  }
  return undefined;
}

function issueTargetEnd(fields: RawIssue["fields"]): string | undefined {
  if (!fields) return undefined;
  const candidates: unknown[] = [
    fields.targetEnd,
    fields.targetend,
    fields.targetEndDate,
    fields.targetenddate,
    fields["Target End"],
    fields["Target End Date"],
  ];
  const direct = candidates.find((value) => typeof value === "string" && value.trim());
  if (direct) return formatTargetEnd(direct);
  // Fallback: Advanced Roadmaps stores the target end date in an install-specific
  // customfield_NNNNN. Accept any custom field that parses as a date string.
  for (const [key, value] of Object.entries(fields)) {
    if (!key.startsWith("customfield_")) continue;
    if (typeof value === "string" && value.trim()) {
      const formatted = formatTargetEnd(value.trim());
      if (formatted) return formatted;
    }
  }
  return undefined;
}

function toEpic(face: {
  key: string;
  summary: string;
  status?: string;
  priority?: string;
  assignee?: string;
  dueDate?: string;
  targetEnd?: string;
  labels?: string[];
}): Epic {
  return {
    key: face.key,
    summary: face.summary,
    ...(face.status ? { status: face.status } : {}),
    ...(face.priority ? { priority: face.priority } : {}),
    ...(face.assignee ? { assignee: face.assignee } : {}),
    ...(face.dueDate ? { dueDate: face.dueDate } : {}),
    ...(face.targetEnd ? { targetEnd: face.targetEnd } : {}),
    ...(face.labels ? { labels: face.labels } : {}),
  };
}

function toCard(issue: RawIssue, key: string): Card {
  const summary =
    typeof issue.fields?.summary === "string" ? issue.fields.summary : "";
  const priority =
    typeof issue.fields?.priority?.name === "string"
      ? issue.fields.priority.name
      : undefined;
  const assignee = issueAssignee(issue.fields);
  const dueDate = formatDueDate(issue.fields?.duedate);
  const targetEnd = issueTargetEnd(issue.fields);
  const type = issueType(issue.fields);
  const epic = epicKey(issue.fields);
  const labels = issueLabels(issue.fields);
  const created = createdAt(issue.fields);
  return {
    key,
    summary,
    ...(priority ? { priority } : {}),
    ...(assignee ? { assignee } : {}),
    ...(dueDate ? { dueDate } : {}),
    ...(targetEnd ? { targetEnd } : {}),
    ...(type ? { type } : {}),
    ...(epic ? { epic } : {}),
    ...(labels ? { labels } : {}),
    ...(created ? { created } : {}),
  };
}

export function issuesToBoard(raw: unknown): Board {
  if (!Array.isArray(raw)) {
    throw new Error("jira-cli --raw payload must be a JSON array");
  }

  const columns: Column[] = [];
  const byStatus = new Map<string, Column>();
  const epics: Epic[] = [];
  const epicByKey = new Map<string, Epic>();

  function rememberEpic(epic: Epic) {
    const existing = epicByKey.get(epic.key);
    if (!existing) {
      epicByKey.set(epic.key, epic);
      epics.push(epic);
      return;
    }
    if (!existing.summary && epic.summary) {
      Object.assign(existing, epic);
    }
  }

  for (const issue of raw as RawIssue[]) {
    const key = typeof issue?.key === "string" ? issue.key : "";
    const status =
      typeof issue?.fields?.status?.name === "string"
        ? issue.fields.status.name
        : "";
    if (!key || !status) continue;

    const card = toCard(issue, key);
    if ((card.type ?? "").toLowerCase() === "epic") {
      rememberEpic(toEpic({ ...card, status: issueStatus(issue.fields) }));
      continue;
    }

    if (card.epic) {
      rememberEpic({ key: card.epic, summary: card.epic });
    }

    let column = byStatus.get(status);
    if (!column) {
      column = { id: status, title: status, cards: [] };
      byStatus.set(status, column);
      columns.push(column);
    }
    column.cards.push(card);
  }

  return { columns, epics };
}

export function mergeEpics(listed: Epic[], fromBoard: Epic[]): Epic[] {
  const byKey = new Map<string, Epic>();
  for (const epic of listed) byKey.set(epic.key, { ...epic });
  for (const epic of fromBoard) {
    const existing = byKey.get(epic.key);
    if (!existing) {
      byKey.set(epic.key, { ...epic });
      continue;
    }
    if (!existing.summary && epic.summary) Object.assign(existing, epic);
    if (!existing.targetEnd && epic.targetEnd) existing.targetEnd = epic.targetEnd;
  }
  return [...byKey.values()];
}

export function epicsToColumns(epics: Epic[]): Column[] {
  const columns: Column[] = [];
  const byStatus = new Map<string, Column>();
  for (const epic of epics) {
    const status = epic.status ?? "To Do";
    let column = byStatus.get(status);
    if (!column) {
      column = { id: status, title: status, cards: [] };
      byStatus.set(status, column);
      columns.push(column);
    }
    column.cards.push({
      key: epic.key,
      summary: epic.summary,
      type: "Epic",
      ...(epic.priority ? { priority: epic.priority } : {}),
      ...(epic.assignee ? { assignee: epic.assignee } : {}),
      ...(epic.dueDate ? { dueDate: epic.dueDate } : {}),
      ...(epic.targetEnd ? { targetEnd: epic.targetEnd } : {}),
      ...(epic.labels ? { labels: epic.labels } : {}),
    });
  }
  return columns;
}
