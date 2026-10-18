export const DEFAULT_FLAGS = "";

export type ScopePair = { workspace: string; project: string };

export type ParsedFlags = {
  jql: string;
  projects: string[];
  plane: boolean;
  workspace?: string;
  workspaces: string[];
  scopes: ScopePair[];
};

function tokens(input: string): string[] {
  const out: string[] = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(input))) {
    out.push(match[1] ?? match[2] ?? match[3]);
  }
  return out;
}

function takeValue(list: string[], index: number, flag: string): [string, number] {
  const glued = list[index].slice(flag.length);
  if (glued) return [glued, index];
  return [list[index + 1] ?? "", index + 1];
}

export function parseFlags(flags: string): ParsedFlags {
  const list = tokens(flags.trim() || DEFAULT_FLAGS);
  let assignee = "";
  let epic = "";
  let type = "";
  let raw = "";
  let projectsValue = "";
  let workspacesValue = "";
  let scopesValue = "";
  let plane = false;
  let workspace = "";
  const statusEq: string[] = [];
  const statusNeq: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token === "--raw") continue;
    if (token === "--plane") {
      plane = true;
      continue;
    }
    if (token === "--workspaces" || token.startsWith("--workspaces=")) {
      const parts: string[] = [];
      if (token.startsWith("--workspaces=")) parts.push(token.slice("--workspaces=".length));
      while (i + 1 < list.length && !list[i + 1].startsWith("-")) {
        i++;
        parts.push(list[i]!);
      }
      workspacesValue = parts.join(",");
      continue;
    }
    if (token === "--scopes" || token.startsWith("--scopes=")) {
      const parts: string[] = [];
      if (token.startsWith("--scopes=")) parts.push(token.slice("--scopes=".length));
      while (i + 1 < list.length && !list[i + 1].startsWith("-")) {
        i++;
        parts.push(list[i]!);
      }
      scopesValue = parts.join(",");
      continue;
    }
    if (token === "--workspace" || token.startsWith("--workspace=")) {
      const [value, next] = takeValue(list, i, "--workspace");
      workspace = value.startsWith("=") ? value.slice(1) : value;
      i = next;
      continue;
    }
    if (token.startsWith("-a")) {
      [assignee, i] = takeValue(list, i, "-a");
      continue;
    }
    if (token.startsWith("-P")) {
      [epic, i] = takeValue(list, i, "-P");
      continue;
    }
    if (token.startsWith("-t")) {
      [type, i] = takeValue(list, i, "-t");
      continue;
    }
    if (token.startsWith("-s")) {
      const [status, next] = takeValue(list, i, "-s");
      i = next;
      if (status.startsWith("~")) statusNeq.push(status.slice(1));
      else statusEq.push(status);
      continue;
    }
    if (token === "--projects" || token.startsWith("--projects=")) {
      const parts: string[] = [];
      if (token.startsWith("--projects=")) {
        // glued form: --projects=PROJ1,PROJ2
        parts.push(token.slice("--projects=".length));
      }
      // Consume all following non-flag tokens so that a space after a comma
      // does not silently drop projects:
      //   --projects PROJ1, PROJ2  → tokens ["PROJ1,", "PROJ2"]  → both consumed
      //   --projects PROJ1 , PROJ2 → tokens ["PROJ1", ",", "PROJ2"] → all consumed
      while (i + 1 < list.length && !list[i + 1].startsWith("-")) {
        i++;
        parts.push(list[i]);
      }
      // Join with "," then the existing split/trim/filter handles deduplication
      projectsValue = parts.join(",");
      continue;
    }
    if (token === "-q" || token === "--jql") {
      raw = list[++i] ?? "";
      continue;
    }
    if (token.startsWith("-q")) {
      raw = token.slice(2);
    }
  }

  const projects = projectsValue
    .split(",")
    .map((p) => p.trim().toUpperCase())
    .filter(Boolean);
  const workspaces = uniqueSlugs(workspacesValue);
  const scopes = parseScopes(scopesValue);

  const workspaceSlug = workspace.trim() || undefined;

  if (raw) {
    return { jql: raw, projects, plane, workspace: workspaceSlug, workspaces, scopes };
  }

  const projectClause = projects.length
    ? `project in (${projects.map((p) => `"${p}"`).join(", ")})`
    : "";
  const clauses: string[] = [];
  if (projectClause) clauses.push(projectClause);
  if (assignee) clauses.push(`assignee="${assignee}"`);
  if (type) clauses.push(`type="${type}"`);
  if (epic) clauses.push(`parent="${epic}"`);
  for (const status of statusEq) clauses.push(`status="${status}"`);
  for (const status of statusNeq) clauses.push(`status!="${status}"`);
  return { jql: clauses.join(" AND "), projects, plane, workspace: workspaceSlug, workspaces, scopes };
}

function uniqueSlugs(value: string): string[] {
  const seen = new Set<string>();
  const slugs: string[] = [];
  for (const part of value.split(",")) {
    const slug = part.trim().toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    slugs.push(slug);
  }
  return slugs;
}

function parseScopes(value: string): ScopePair[] {
  const seen = new Set<string>();
  const scopes: ScopePair[] = [];
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const slash = trimmed.indexOf("/");
    if (slash <= 0) continue;
    const workspace = trimmed.slice(0, slash).trim().toLowerCase();
    const project = trimmed.slice(slash + 1).trim().toUpperCase();
    if (!workspace || !project) continue;
    const key = `${workspace}/${project}`;
    if (seen.has(key)) continue;
    seen.add(key);
    scopes.push({ workspace, project });
  }
  return scopes;
}

function replaceFlag(flags: string, name: string, values: string[]): string {
  const list = tokens(flags.trim());
  const out: string[] = [];
  let wrote = false;
  for (let i = 0; i < list.length; i++) {
    const token = list[i]!;
    if (token === name || token.startsWith(`${name}=`)) {
      if (token === name) i += 1;
      if (!wrote && values.length) {
        out.push(name, values.join(","));
        wrote = true;
      } else {
        wrote = true;
      }
      continue;
    }
    out.push(token);
  }
  if (!wrote && values.length) out.push(name, values.join(","));
  return out.join(" ");
}

export function commitWorkspaceSlug(
  liveSlug: string,
  typed: string,
): { action: "reject" } | { action: "noop" } | { action: "commit"; slug: string } {
  const slug = typed.trim();
  if (!slug) return { action: "reject" };
  if (slug === liveSlug) return { action: "noop" };
  return { action: "commit", slug };
}

export function setWorkspaceFlag(flags: string, slug: string): string {
  const trimmed = slug.trim();
  if (!trimmed) return flags;
  const list = tokens(flags.trim());
  const out: string[] = [];
  let wrote = false;
  for (let i = 0; i < list.length; i++) {
    const token = list[i]!;
    if (token === "--workspace" || token.startsWith("--workspace=")) {
      if (token === "--workspace") i += 1;
      if (!wrote) {
        out.push("--workspace", trimmed);
        wrote = true;
      }
      continue;
    }
    out.push(token);
  }
  if (!wrote) out.push("--workspace", trimmed);
  return out.join(" ");
}

export function setPlaneFlag(flags: string, on: boolean): string {
  const list = tokens(flags.trim()).filter((token) => token !== "--plane");
  if (on) list.unshift("--plane");
  return list.join(" ");
}

export function setWorkspacesFlag(flags: string, slugs: string[]): string {
  return replaceFlag(flags, "--workspaces", uniqueSlugs(slugs.join(",")));
}

export function setScopesFlag(flags: string, scopes: ScopePair[]): string {
  const value = parseScopes(scopes.map((scope) => `${scope.workspace}/${scope.project}`).join(","));
  return replaceFlag(
    flags,
    "--scopes",
    value.map((scope) => `${scope.workspace}/${scope.project}`),
  );
}

export function applyScopeSelection(
  flags: string,
  selection: { workspaces: string[]; scopes: ScopePair[] },
): string {
  const scopes = parseScopes(selection.scopes.map((scope) => `${scope.workspace}/${scope.project}`).join(","));
  const workspaces = uniqueSlugs(
    [...selection.workspaces, ...scopes.map((scope) => scope.workspace)].join(","),
  );
  let next = setWorkspacesFlag(flags, workspaces);
  if (workspaces[0]) next = setWorkspaceFlag(next, workspaces[0]);
  next = setScopesFlag(next, scopes);
  next = setProjectsFlag(
    next,
    [...new Set(scopes.map((scope) => scope.project))],
  );
  return next;
}

export function setProjectsFlag(flags: string, identifiers: string[]): string {
  const value = identifiers
    .map((identifier) => identifier.trim().toUpperCase())
    .filter(Boolean)
    .join(",");
  const list = tokens(flags.trim());
  const out: string[] = [];
  let wrote = false;
  for (let i = 0; i < list.length; i++) {
    const token = list[i]!;
    if (token === "--projects" || token.startsWith("--projects=")) {
      if (token === "--projects") i += 1;
      if (!wrote && value) {
        out.push("--projects", value);
        wrote = true;
      } else {
        wrote = true;
      }
      continue;
    }
    out.push(token);
  }
  if (!wrote && value) out.push("--projects", value);
  return out.join(" ");
}

export function wantsPlane(flags: string): boolean {
  return parseFlags(flags).plane;
}

export function flagsToJql(flags: string): string {
  return parseFlags(flags).jql;
}

export function argvToFlags(argv: string[]): string {
  const args = argv.slice(2);
  if (args.length === 0) return "";
  // If the user passes a single raw JQL string (legacy usage), keep it.
  if (args.length === 1 && !args[0].startsWith("-")) return args[0];
  return args.join(" ");
}
