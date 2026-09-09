export const ME = {
  displayName: "Person A",
  emailAddress: "user@test.com",
  name: "user@test.com",
};

export const TRANSITIONS = [
  { id: "11", name: "To Do" },
  { id: "21", name: "In Progress" },
  { id: "31", name: "Done" },
] as const;

const ALLOWED: Record<string, string[]> = {
  "To Do": ["In Progress"],
  "In Progress": ["To Do", "Done"],
  Done: ["In Progress"],
};

export type StoredIssue = {
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    assignee?: { displayName?: string; emailAddress?: string };
    parent?: { key?: string };
    [key: string]: unknown;
  };
};

export function validIssueKey(key: string): boolean {
  return /^[A-Z][A-Z0-9]*-\d+$/i.test(key.trim());
}

function fieldValue(issue: StoredIssue, field: string): string {
  switch (field) {
    case "project":
      return issue.key.split("-")[0] ?? "";
    case "assignee":
      return [
        issue.fields.assignee?.emailAddress,
        issue.fields.assignee?.displayName,
      ]
        .filter(Boolean)
        .join("\n");
    case "status":
      return issue.fields.status.name;
    case "parent":
      return issue.fields.parent?.key ?? "";
    case "type": {
      const named = issue.fields.issuetype ?? issue.fields.issueType;
      if (
        named &&
        typeof named === "object" &&
        "name" in named &&
        typeof named.name === "string"
      ) {
        return named.name;
      }
      return "";
    }
    case "key":
      return issue.key;
    default:
      return "";
  }
}

function matchesClause(issue: StoredIssue, clause: string): boolean {
  const match = clause.trim().match(/^(\w+)\s*(!=|=)\s*"?([^"]+)"?$/);
  if (!match) return true;
  const [, field, op, raw] = match;
  const expected = raw.trim();
  const actual = fieldValue(issue, field);
  const hit =
    field === "assignee"
      ? actual
          .split("\n")
          .some((value) => value.toLowerCase() === expected.toLowerCase())
      : actual.toLowerCase() === expected.toLowerCase();
  return op === "!=" ? !hit : hit;
}

export function matchJql(issue: StoredIssue, jql: string): boolean {
  const stripped = jql.replace(/\s+ORDER BY\s+.+$/i, "").trim();
  if (!stripped) return true;
  return stripped
    .split(/\s+AND\s+/i)
    .every((clause) => matchesClause(issue, clause));
}

export class IssueStore {
  constructor(private issues: StoredIssue[]) {}

  static fromRaw(raw: unknown): IssueStore {
    if (!Array.isArray(raw)) {
      throw new Error("Fixture must be a JSON array");
    }
    return new IssueStore(structuredClone(raw) as StoredIssue[]);
  }

  all(): StoredIssue[] {
    return this.issues;
  }

  rawJson(): string {
    return JSON.stringify(this.issues, null, 2);
  }

  get(key: string): StoredIssue | undefined {
    return this.issues.find(
      (issue) => issue.key.toUpperCase() === key.toUpperCase(),
    );
  }

  list(jql = ""): StoredIssue[] {
    return this.issues.filter((issue) => matchJql(issue, jql));
  }

  childrenOf(keys: string[]): StoredIssue[] {
    const listed = new Set(keys.filter(validIssueKey));
    return this.issues.filter((issue) => {
      if (fieldValue(issue, "type").toLowerCase() === "epic") return false;
      return listed.has(fieldValue(issue, "parent"));
    });
  }

  transitions(key: string) {
    const issue = this.get(key);
    if (!issue) return [];
    const allowed = ALLOWED[issue.fields.status.name] ?? [];
    return TRANSITIONS.map((transition) => ({
      ...transition,
      isAvailable: allowed.includes(transition.name),
    }));
  }

  move(
    key: string,
    status: string,
  ): { ok: true } | { ok: false; error: string } {
    const issue = this.get(key);
    if (!issue) return { ok: false, error: `Issue ${key} not found` };
    const transition = this.transitions(key).find(
      (item) =>
        item.name.toLowerCase() === status.toLowerCase() || item.id === status,
    );
    if (!transition || !transition.isAvailable) {
      const available = this.transitions(key)
        .filter((item) => item.isAvailable)
        .map((item) => item.name)
        .join(", ");
      return {
        ok: false,
        error: `invalid transition state "${status}"\nAvailable states for issue ${key}: ${available}`,
      };
    }
    issue.fields.status.name = transition.name;
    if (transition.name === "Done") {
      issue.fields.resolution = { name: "Done" };
    } else {
      delete issue.fields.resolution;
    }
    return { ok: true };
  }
}
