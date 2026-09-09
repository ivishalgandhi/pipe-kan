export const DEFAULT_FLAGS = "";

export type ParsedFlags = {
  jql: string;
  projects: string[];
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
  const statusEq: string[] = [];
  const statusNeq: string[] = [];

  for (let i = 0; i < list.length; i++) {
    const token = list[i];
    if (token === "--raw") continue;
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
    if (token === "--projects") {
      [projectsValue, i] = takeValue(list, i, "--projects");
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

  if (raw) {
    return { jql: raw, projects };
  }

  const projectClause = projects.length
    ? `project in (${projects.map((p) => `'${p}'`).join(", ")})`
    : "";
  const clauses: string[] = [];
  if (projectClause) clauses.push(projectClause);
  if (assignee) clauses.push(`assignee="${assignee}"`);
  if (type) clauses.push(`type="${type}"`);
  if (epic) clauses.push(`parent="${epic}"`);
  for (const status of statusEq) clauses.push(`status="${status}"`);
  for (const status of statusNeq) clauses.push(`status!="${status}"`);
  return { jql: clauses.join(" AND "), projects };
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
