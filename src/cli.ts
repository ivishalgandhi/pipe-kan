import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join, resolve } from "node:path";
import { availableParallelism } from "node:os";

import { DEFAULT_FLAGS, flagsToJql, parseFlags } from "./flags.ts";
import { IssueStore, validIssueKey } from "./store.ts";

export type Cli = {
  list(flags: string): Promise<string>;
  listEpics(flags?: string): Promise<string>;
  listEpic(key: string, flags?: string): Promise<string>;
  listChildren(keys: string[]): Promise<string>;
  move(key: string, status: string): Promise<{ ok: boolean; error?: string }>;
  create(input: {
    summary: string;
    description?: string;
    labels?: string[];
    parent?: string;
    type?: string;
    status?: string;
  }): Promise<{ ok: boolean; key?: string; error?: string }>;
  edit(
    key: string,
    input: { summary?: string; description?: string; labels?: string[] },
  ): Promise<{ ok: boolean; error?: string }>;
  open(key: string): Promise<string>;
  view(key: string): Promise<string>;
};

export function createdKeyFromOutput(text: string): string | undefined {
  const matches = text.match(/[A-Z][A-Z0-9]*-\d+/gi) ?? [];
  for (let i = matches.length - 1; i >= 0; i--) {
    const key = matches[i];
    if (key && validIssueKey(key)) return key;
  }
  return undefined;
}

function projectClause(flags: string): string {
  const { projects } = parseFlags(flags || DEFAULT_FLAGS);
  if (!projects.length) return "";
  return `project in (${projects.map((p) => `"${p}"`).join(", ")})`;
}

function emptyList(text: string) {
  return /no result found/i.test(text);
}

function rateLimited(text: string) {
  return /\b429\b/.test(text);
}

const RETRY_LIMIT = 4;

const LIST_PAGE = 100;

function issueKey(issue: unknown): string | undefined {
  if (!issue || typeof issue !== "object" || !("key" in issue)) return undefined;
  return typeof issue.key === "string" ? issue.key : undefined;
}

function hasPaginate(args: string[]) {
  return args.some((arg) => arg === "--paginate" || arg.startsWith("--paginate="));
}

export function createStoreCli(store: IssueStore, defaultFlags = DEFAULT_FLAGS): Cli {
  return {
    async list(flags) {
      const issues = store.list(flagsToJql(flags || defaultFlags));
      return JSON.stringify(issues, null, 2);
    },
    async listEpics(queryFlags = defaultFlags) {
      const clause = projectClause(queryFlags || defaultFlags);
      const jql = clause ? `${clause} AND type="Epic"` : 'type="Epic"';
      const issues = store.list(jql);
      return JSON.stringify(issues, null, 2);
    },
    async listEpic(key, queryFlags = defaultFlags) {
      const clause = projectClause(queryFlags || defaultFlags);
      const jql = clause
        ? `${clause} AND parent="${key}"`
        : `parent="${key}"`;
      const issues = store.list(jql);
      return JSON.stringify(issues, null, 2);
    },
    async listChildren(keys) {
      return JSON.stringify(store.childrenOf(keys.filter(validIssueKey)), null, 2);
    },
    async move(key, status) {
      return store.move(key, status);
    },
    async create(input) {
      return store.create(input);
    },
    async edit(key, input) {
      return store.edit(key, input);
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
    retryDelayMs?: number;
    flags?: string;
  } = {},
): Cli {
  const bin = opts.bin ?? "jira";
  const retryDelayMs = opts.retryDelayMs ?? 1000;
  const defaultFlags = opts.flags ?? DEFAULT_FLAGS;

  function fmt(args: string[]) {
    return args
      .filter((arg) => arg !== "--raw")
      .map((arg, i, all) => (all[i - 1] === "-q" && arg.length > 48 ? `${arg.slice(0, 48)}…` : arg))
      .join(" ");
  }

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

  async function runRetry(args: string[]) {
    let result = await run(args);
    for (let attempt = 0; attempt < RETRY_LIMIT; attempt++) {
      if (result.code === 0 || !rateLimited(result.stderr || result.stdout)) return result;
      const delay = retryDelayMs * 2 ** attempt;
      console.log(`jira 429 retry ${delay}ms ${fmt(args)}`);
      if (retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
      result = await run(args);
    }
    return result;
  }

  async function listOnce(args: string[]): Promise<unknown[]> {
    const started = Date.now();
    const result = await runRetry(args);
    if (result.code !== 0) {
      const text = result.stderr || result.stdout || "jira issue list failed";
      if (emptyList(text)) {
        console.log(`jira ${fmt(args)} -> 0 (${Date.now() - started}ms)`);
        return [];
      }
      console.log(`jira ${fmt(args)} fail (${Date.now() - started}ms)`);
      throw new Error(text);
    }
    const parsed = JSON.parse(result.stdout);
    const page = Array.isArray(parsed) ? parsed : [];
    console.log(`jira ${fmt(args)} -> ${page.length} (${Date.now() - started}ms)`);
    return page;
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
    console.log(`jira ${fmt(args)} ${issues.length} total`);
    return JSON.stringify(issues);
  }
  async function moveIssue(key: string, status: string) {
    const result = await runRetry(["issue", "move", key, status]);
    if (result.code !== 0) {
      return { ok: false, error: (result.stderr || result.stdout).trim() };
    }
    return { ok: true as const };
  }

  return {
    async list(flags) {
      const parsed = parseFlags(flags || defaultFlags);
      const args = ["issue", "list"];
      if (parsed.projects.length) {
        args.push("-q", parsed.jql);
      } else {
        const extra = (flags || defaultFlags).split(/\s+/).filter(Boolean);
        args.push(...extra);
      }
      args.push("--raw");
      return JSON.stringify(await listOnce(args));
    },
    async listEpics(queryFlags = defaultFlags) {
      const parsed = parseFlags(queryFlags || defaultFlags);
      const args = ["issue", "list"];
      if (parsed.projects.length) {
        args.push("-q", `project in (${parsed.projects.map((p) => `"${p}"`).join(", ")}) AND type="Epic"`);
      } else {
        args.push("-q", 'type="Epic"');
      }
      return listAll(args);
    },
    async listEpic(key, queryFlags = defaultFlags) {
      const parsed = parseFlags(queryFlags || defaultFlags);
      const args = ["issue", "list"];
      if (parsed.projects.length) {
        args.push(
          "-q",
          `project in (${parsed.projects.map((p) => `"${p}"`).join(", ")}) AND (parent="${key}" OR "Epic Link"="${key}")`,
        );
      } else {
        args.push("-q", `(parent="${key}" OR "Epic Link"="${key}")`);
      }
      return listAll(args);
    },
    async listChildren(keys) {
      const validKeys = keys.filter(validIssueKey);
      if (!validKeys.length) {
        console.log("Refresh children skipped; no valid parent keys");
        return "[]";
      }
      const issues: unknown[] = [];
      const seen = new Set<string>();
      let anyFailed = false;
      let lockedMode: "or" | "epic" | "parent" | undefined;

      function buildJql(chunkKeys: string[], mode: "or" | "epic" | "parent") {
        const list = chunkKeys.map((key) => `"${key}"`).join(", ");
        if (mode === "epic") return `"Epic Link" in (${list})`;
        if (mode === "parent") return `parent in (${list})`;
        return `(parent in (${list}) OR "Epic Link" in (${list}))`;
      }

      function chunkSizeFor(mode: "or" | "epic" | "parent") {
        return mode === "or" ? 50 : 100;
      }

      async function fetchChunk(
        chunk: string[],
        chunkIndex: number,
        preferredMode?: "or" | "epic" | "parent",
      ): Promise<{ issues: unknown[]; used?: "or" | "epic" | "parent"; error?: string }> {
        const modes: Array<"or" | "epic" | "parent"> = preferredMode
          ? [preferredMode, "or", "epic", "parent"].filter(
              (m, i, arr) => arr.indexOf(m) === i,
            ) as Array<"or" | "epic" | "parent">
          : ["or", "epic", "parent"];
        let lastError: string | undefined;

        for (const mode of modes) {
          const size = chunkSizeFor(mode);
          if (chunk.length > size) continue;
          try {
            const chunkIssues = JSON.parse(
              await listAll([
                "issue",
                "list",
                "-q",
                buildJql(chunk, mode),
              ]),
            ) as unknown[];
            return { issues: chunkIssues, used: mode };
          } catch (err) {
            lastError = err instanceof Error ? err.message : String(err);
          }
        }
        console.log(
          `Refresh children chunk ${chunkIndex + 1} failed; ${lastError ?? "unknown error"}`,
        );
        return { issues: [], error: lastError };
      }

      function childrenConcurrency(): number {
        const env = Number(process.env.PIPE_KAN_CHILDREN_CONCURRENCY);
        if (!Number.isNaN(env) && env > 0) return env;
        return Math.max(3, Math.min(10, availableParallelism()));
      }

      const concurrency = childrenConcurrency();
      console.log(`Refresh children ${validKeys.length} epics; concurrency ${concurrency}`);
      const chunks: { chunk: string[]; index: number }[] = [];
      let cursor = 0;
      for (let i = 0; i < validKeys.length; i += chunkSizeFor(lockedMode ?? "or")) {
        const size = chunkSizeFor(lockedMode ?? "or");
        const chunk = validKeys.slice(i, i + size);
        chunks.push({ chunk, index: cursor++ });
      }

      async function processChunk({ chunk, index }: { chunk: string[]; index: number }) {
        const preferred = lockedMode;
        const result = await fetchChunk(chunk, index, preferred);
        if (result.used && !lockedMode) {
          lockedMode = result.used;
        }
        if (result.error) {
          anyFailed = true;
          return;
        }
        for (const issue of result.issues) {
          const key = issueKey(issue);
          if (key && !seen.has(key)) {
            seen.add(key);
            issues.push(issue);
          }
        }
      }

      for (let i = 0; i < chunks.length; i += concurrency) {
        await Promise.all(chunks.slice(i, i + concurrency).map(processChunk));
      }

      if (anyFailed && issues.length === 0) {
        throw new Error("Epic children fetch failed for all batches");
      }
      return JSON.stringify(issues);
    },
    async move(key, status) {
      return moveIssue(key, status);
    },
    async create(input) {
      const args = [
        "issue",
        "create",
        "--no-input",
        "-y",
        "-t",
        input.type?.trim() || "Story",
        "-s",
        input.summary,
      ];
      if (input.description) {
        args.push("-b", input.description);
      }
      for (const label of input.labels ?? []) {
        args.push("-l", label);
      }
      if (input.parent) {
        args.push("-P", input.parent);
      }
      const result = await runRetry(args);
      if (result.code !== 0) {
        return { ok: false, error: (result.stderr || result.stdout).trim() };
      }
      const key = createdKeyFromOutput(`${result.stdout}\n${result.stderr}`);
      if (input.status?.trim() && key) {
        const moved = await moveIssue(key, input.status.trim());
        if (!moved.ok) return { ok: false, key, error: moved.error };
      }
      return key ? { ok: true, key } : { ok: true };
    },
    async edit(key, input) {
      const args = ["issue", "edit", key, "--no-input", "-y"];
      if (input.summary !== undefined) args.push("-s", input.summary);
      if (input.description !== undefined) args.push("-b", input.description);
      if (input.labels?.length) {
        for (const label of input.labels) args.push("-l", label);
      }
      const result = await runRetry(args);
      if (result.code !== 0) {
        return { ok: false, error: (result.stderr || result.stdout).trim() };
      }
      return { ok: true };
    },
    async open(key) {
      const result = await runRetry(["open", key, "--no-browser"]);
      return result.stdout.trim().split("\n").pop() ?? `/browse/${key}`;
    },
    async view(key) {
      const result = await runRetry(["issue", "view", key, "--raw"]);
      if (result.code !== 0) {
        throw new Error((result.stderr || result.stdout || "jira issue view failed").trim());
      }
      return result.stdout;
    },
  };
}
