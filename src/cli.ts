import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";

import { DEFAULT_FLAGS, flagsToJql } from "./flags.ts";
import type { IssueStore } from "./store.ts";

export type Cli = {
  list(flags: string): Promise<string>;
  listEpics(): Promise<string>;
  listEpic(key: string): Promise<string>;
  listChildren(keys: string[]): Promise<string>;
  move(key: string, status: string): Promise<{ ok: boolean; error?: string }>;
  open(key: string): Promise<string>;
  view(key: string): Promise<string>;
};

function emptyList(text: string) {
  return /no result found/i.test(text);
}

const LIST_PAGE = 100;

function issueKey(issue: unknown): string | undefined {
  if (!issue || typeof issue !== "object" || !("key" in issue)) return undefined;
  return typeof issue.key === "string" ? issue.key : undefined;
}

function hasPaginate(args: string[]) {
  return args.some((arg) => arg === "--paginate" || arg.startsWith("--paginate="));
}

export function createStoreCli(store: IssueStore): Cli {
  return {
    async list(flags) {
      const issues = store.list(flagsToJql(flags || DEFAULT_FLAGS));
      return JSON.stringify(issues, null, 2);
    },
    async listEpics() {
      const issues = store.list(flagsToJql("-tEpic"));
      return JSON.stringify(issues, null, 2);
    },
    async listEpic(key) {
      const issues = store.list(`project="DEMO" AND parent="${key}"`);
      return JSON.stringify(issues, null, 2);
    },
    async listChildren(keys) {
      return JSON.stringify(store.childrenOf(keys), null, 2);
    },
    async move(key, status) {
      return store.move(key, status);
    },
    async open(key) {
      return `/browse/${key}`;
    },
    async view(key) {
      const issue = store.get(key);
      if (!issue) throw new Error(`Issue ${key} not found`);
      return JSON.stringify(issue);
    },
  };
}

export function resolveJiraBin(
  bin = process.env.JIRA_BIN ?? "jira",
  pathVar = process.env.PATH ?? "",
): string | undefined {
  if (!bin) return undefined;
  if (bin.includes("/") || bin.includes("\\")) {
    const abs = resolve(bin);
    return existsSync(abs) ? abs : undefined;
  }
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    const candidate = join(dir, bin);
    if (existsSync(candidate)) return candidate;
  }
  return undefined;
}

export function createJiraCli(
  opts: {
    bin?: string;
    configPath?: string;
    token?: string;
  } = {},
): Cli {
  const bin = opts.bin ?? "jira";

  function run(args: string[]) {
    return new Promise<{ code: number; stdout: string; stderr: string }>(
      (resolveRun, reject) => {
        const env = { ...process.env };
        if (opts.configPath) env.JIRA_CONFIG_FILE = resolve(opts.configPath);
        if (opts.token) env.JIRA_API_TOKEN = opts.token;
        const child = spawn(bin, args, { env });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr.on("data", (chunk) => {
          stderr += chunk;
        });
        child.on("error", reject);
        child.on("close", (code) =>
          resolveRun({ code: code ?? 1, stdout, stderr }),
        );
      },
    );
  }

  async function listOnce(args: string[]): Promise<unknown[]> {
    const result = await run(args);
    if (result.code !== 0) {
      const text = result.stderr || result.stdout || "jira issue list failed";
      if (emptyList(text)) return [];
      throw new Error(text);
    }
    const parsed = JSON.parse(result.stdout);
    return Array.isArray(parsed) ? parsed : [];
  }

  async function listAll(args: string[]): Promise<string> {
    if (hasPaginate(args)) {
      return JSON.stringify(await listOnce([...args, "--raw"]));
    }
    const issues: unknown[] = [];
    const seen = new Set<string>();
    for (let from = 0; ; from += LIST_PAGE) {
      const page = await listOnce([
        ...args,
        "--paginate",
        `${from}:${LIST_PAGE}`,
        "--raw",
      ]);
      if (!page.length) break;
      const first = issueKey(page[0]);
      if (first && seen.has(first)) break;
      for (const issue of page) {
        const key = issueKey(issue);
        if (key) seen.add(key);
        issues.push(issue);
      }
      if (page.length < LIST_PAGE) break;
    }
    return JSON.stringify(issues);
  }

  return {
    async list(flags) {
      const extra = (flags || DEFAULT_FLAGS).split(/\s+/).filter(Boolean);
      return JSON.stringify(await listOnce(["issue", "list", ...extra, "--raw"]));
    },
    async listEpics() {
      return listAll(["issue", "list", "-tEpic"]);
    },
    async listEpic(key) {
      return listAll([
        "issue",
        "list",
        "-q",
        `(parent="${key}" OR "Epic Link"="${key}")`,
      ]);
    },
    async listChildren(keys) {
      if (!keys.length) return "[]";
      const list = keys.map((key) => `"${key}"`).join(", ");
      return listAll([
        "issue",
        "list",
        "-q",
        `(parent in (${list}) OR "Epic Link" in (${list}))`,
      ]);
    },
    async move(key, status) {
      const result = await run(["issue", "move", key, status]);
      if (result.code !== 0) {
        return {
          ok: false,
          error: (result.stderr || result.stdout).trim(),
        };
      }
      return { ok: true };
    },
    async open(key) {
      const result = await run(["open", key, "--no-browser"]);
      return result.stdout.trim().split("\n").pop() ?? `/browse/${key}`;
    },
    async view(key) {
      const result = await run(["issue", "view", key, "--raw"]);
      if (result.code !== 0) {
        throw new Error((result.stderr || result.stdout || "jira issue view failed").trim());
      }
      return result.stdout;
    },
  };
}
