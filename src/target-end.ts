export type TargetEndFieldMap = {
  targetEnd?: string;
};

const EXACT_NAME = "Target End Date";
const ALIAS_NAMES = new Set(["Target End", "Target end"]);
const NAMED_FIELD_KEYS = [
  "Target End Date",
  "Target End",
  "Target end",
  "targetEndDate",
  "targetenddate",
  "targetEnd",
  "targetend",
] as const;

function isTargetStart(name: string) {
  const folded = name.trim().toLowerCase();
  return folded === "target start" || folded === "target start date";
}

export function asNames(raw: unknown): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const names: Record<string, string> = {};
  for (const [id, value] of Object.entries(raw)) {
    if (typeof value === "string" && value.trim()) names[id] = value.trim();
  }
  return Object.keys(names).length ? names : undefined;
}

export function resolveTargetEndFieldId(names?: Record<string, string>): string | undefined {
  if (!names) return undefined;
  let alias: string | undefined;
  for (const [id, name] of Object.entries(names)) {
    if (!id.startsWith("customfield_")) continue;
    if (isTargetStart(name)) continue;
    if (name === EXACT_NAME) return id;
    if (ALIAS_NAMES.has(name) && !alias) alias = id;
  }
  return alias;
}

export function isoDay(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const text = value.trim();
    const day = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (day) return `${day[1]}-${day[2]}-${day[3]}`;
    const parsed = Date.parse(text);
    if (Number.isNaN(parsed)) return undefined;
    const date = new Date(parsed);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (value && typeof value === "object") {
    const item = value as { value?: unknown; date?: unknown };
    return isoDay(item.value) ?? isoDay(item.date);
  }
  return undefined;
}

export function issueTargetEnd(
  fields: Record<string, unknown> | undefined,
  opts: { names?: Record<string, string>; fieldId?: string } = {},
): string | undefined {
  if (!fields) return undefined;
  for (const key of NAMED_FIELD_KEYS) {
    const day = isoDay(fields[key]);
    if (day) return day;
  }
  const mapped = resolveTargetEndFieldId(opts.names) ?? opts.fieldId;
  if (mapped && mapped.startsWith("customfield_")) {
    const day = isoDay(fields[mapped]);
    if (day) return day;
  }
  return undefined;
}

export function mergeViewIntoIssue(listIssue: unknown, viewIssue: unknown): unknown {
  if (!viewIssue || typeof viewIssue !== "object") return listIssue;
  if (!listIssue || typeof listIssue !== "object") return viewIssue;
  const list = listIssue as { fields?: Record<string, unknown>; names?: unknown };
  const view = viewIssue as { fields?: Record<string, unknown>; names?: unknown };
  const names = { ...asNames(list.names), ...asNames(view.names) };
  return {
    ...list,
    ...view,
    ...(Object.keys(names).length ? { names } : {}),
    fields: { ...list.fields, ...view.fields },
  };
}

function unquoteYaml(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function targetEndFieldIdFromJiraConfig(yaml: string): string | undefined {
  if (!yaml.trim()) return undefined;
  const names: Record<string, string> = {};
  let name: string | undefined;
  let key: string | undefined;
  const flush = () => {
    if (name && key) names[key] = name;
    name = undefined;
    key = undefined;
  };
  for (const rawLine of yaml.split(/\r?\n/)) {
    const line = rawLine.replace(/\t/g, "  ");
    if (/^\s*-\s*$/.test(line) || /^\s*-\s+\S/.test(line)) flush();
    const nameMatch = line.match(/^\s*-?\s*name:\s*(.+?)\s*$/);
    if (nameMatch) name = unquoteYaml(nameMatch[1] ?? "");
    const keyMatch = line.match(/^\s*-?\s*key:\s*['"]?(customfield_\d+)['"]?/);
    if (keyMatch) key = keyMatch[1];
  }
  flush();
  return resolveTargetEndFieldId(names);
}

