export type OpenField = {
  label: string;
  value: string;
  pills?: string[];
};

const SKIP_FIELDS = new Set([
  "comment",
  "comments",
  "changelog",
  "worklog",
  "schema",
  "names",
  "renderedFields",
  "editmeta",
  "transitions",
  "operations",
]);

const LEADING = [
  "summary",
  "priority",
  "assignee",
  "duedate",
  "targetend",
  "targetEnd",
  "targetenddate",
  "targetEndDate",
  "labels",
  "description",
] as const;

export function frameSrc(url: string, origin: string): string | null {
  if (url.startsWith("/")) return url;
  try {
    const parsed = new URL(url, origin);
    return parsed.origin === new URL(origin).origin ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function flattenAdf(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const item = node as { text?: string; content?: unknown[]; type?: string };
  if (typeof item.text === "string") return item.text;
  const inner = (item.content ?? []).map(flattenAdf).join("");
  if (
    item.type === "paragraph" ||
    item.type === "heading" ||
    item.type === "listItem" ||
    item.type === "blockquote"
  ) {
    return `${inner}\n`;
  }
  return inner;
}

function isSchemaDump(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as { type?: unknown; system?: unknown; items?: unknown; content?: unknown };
  return typeof item.type === "string" && (item.system !== undefined || item.items !== undefined) && item.content === undefined;
}

function flattenValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (trimmed.includes("<") && trimmed.includes(">")) return stripHtml(trimmed) || undefined;
    return trimmed;
  }
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    const parts = value.map(flattenValue).filter((part): part is string => Boolean(part));
    return parts.length ? parts.join(", ") : undefined;
  }
  if (typeof value === "object") {
    if (isSchemaDump(value)) return undefined;
    const item = value as {
      type?: unknown;
      displayName?: unknown;
      name?: unknown;
      value?: unknown;
      content?: unknown;
    };
    if (item.type === "doc") {
      const text = flattenAdf(value).replace(/\n+/g, "\n").trim();
      return text || undefined;
    }
    if (typeof item.displayName === "string" && item.displayName.trim()) return item.displayName.trim();
    if (typeof item.value === "string" && item.value.trim()) return item.value.trim();
    if (typeof item.name === "string" && item.name.trim()) return item.name.trim();
  }
  return undefined;
}

function fieldLabel(key: string, value: unknown) {
  if (key.startsWith("customfield_") && value && typeof value === "object" && "name" in value) {
    const name = (value as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return key;
}

function labelsOf(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const pills = value
    .map((item) => {
      if (typeof item === "string" && item) return item;
      if (item && typeof item === "object" && "name" in item) {
        const name = (item as { name?: unknown }).name;
        if (typeof name === "string" && name) return name;
      }
      return undefined;
    })
    .filter((item): item is string => Boolean(item));
  return pills.length ? pills : undefined;
}

export function flattenIssue(raw: unknown, url: string): OpenField[] {
  const issue = raw as { key?: unknown; fields?: Record<string, unknown> } | null;
  const fields = issue?.fields ?? {};
  const rows: OpenField[] = [];
  const key = typeof issue?.key === "string" ? issue.key : "";
  if (key) rows.push({ label: "Key", value: key });
  const summary = flattenValue(fields.summary);
  if (summary) rows.push({ label: "Summary", value: summary });
  if (url) rows.push({ label: "Jira URL", value: url });
  const priority = flattenValue(fields.priority);
  if (priority) rows.push({ label: "Priority", value: priority });
  const assignee = flattenValue(fields.assignee);
  if (assignee) rows.push({ label: "Assignee", value: assignee });
  const due = flattenValue(fields.duedate);
  if (due) rows.push({ label: "Due date", value: due });
  const pills = labelsOf(fields.labels);
  if (pills) rows.push({ label: "Labels", value: pills.join(", "), pills });
  const description = flattenValue(fields.description);
  if (description) rows.push({ label: "Description", value: description });

  const rest = Object.entries(fields)
    .filter(([key]) => !LEADING.includes(key as (typeof LEADING)[number]) && !SKIP_FIELDS.has(key))
    .map(([key, value]) => {
      const text = flattenValue(value);
      if (!text) return undefined;
      return { label: fieldLabel(key, value), value: text };
    })
    .filter((row): row is OpenField => Boolean(row))
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...rows, ...rest];
}
