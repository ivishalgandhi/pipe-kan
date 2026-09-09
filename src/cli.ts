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
  open(key: string): Promise<string>;
  view(key: string): Promise<string>;
};

function projectClause(flags: string): string {
  const { projects } = parseFlags(flags || DEFAULT_FLAGS);
  if (!projects.length) return 'project="DEMO"';
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
      const issues = store.list(`${projectClause(queryFlags || defaultFlags)} AND type="Epic"`);
      return JSON.stringify(issues, null, 2);
    },
    async listEpic(key, queryFlags = defaultFlags) {
      const issues = store.list(`${projectClause(queryFlags || defaultFlags)} AND parent="${key}"`);
      return JSON.stringify(issues, null, 2);
    },
    async listChildren(keys) {
      return JSON.stringify(store.childrenOf(keys.filter(validIssueKey)), null, 2);
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

  return {
    async list(flags) {
      const extra = (flags || DEFAULT_FLAGS).split(/\s+/).filter(Boolean);
      return JSON.stringify(await listOnce(["issue", "list", ...extra, "--raw"]));
    },
    async listEpics(queryFlags = defaultFlags) {
      const clause = projectClause(queryFlags || defaultFlags);
      return listAll(["issue", "list", "-q", `${clause} AND type="Epic"`]);
    },
    async listEpic(key, queryFlags = defaultFlags) {
      const clause = projectClause(queryFlags || defaultFlags);
      return listAll([
        "issue",
        "list",
        "-q",
        `${clause} AND (parent="${key}" OR "Epic Link"="${key}")`,
      ]);
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
      const result = await runRetry(["issue", "move", key, status]);
      if (result.code !== 0) {
        return {
          ok: false,
          error: (result.stderr || result.stdout).trim(),
        };
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
