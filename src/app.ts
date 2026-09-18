import { readFileSync } from "node:fs";
import { availableParallelism, homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { issuesToBoard, mergeEpics, type Board, type Card } from "./board.ts";
import { createStoreCli, type Cli } from "./cli.ts";
import { DEFAULT_FLAGS, flagsToJql } from "./flags.ts";
import { flattenIssue, type OpenField } from "./open.ts";
import { IssueStore } from "./store.ts";
import {
  asNames,
  mergeViewIntoIssue,
  resolveTargetEndFieldId,
  targetEndFieldIdFromJiraConfig,
} from "./target-end.ts";
import { readTargetEndFieldMap, writeTargetEndFieldMap } from "./field-map.ts";

export type App = {
  flags: string;
  hydrate(raw: unknown, opts?: { fromStore?: boolean }): Board;
  refresh(flags?: string, opts?: { scope?: "all" | "selected"; epicKeys?: string[] }): Promise<Board>;
  children(epic: string): Promise<Board>;
  board(): Board;
  move(
    key: string,
    status: string,
  ): Promise<{ ok: boolean; noop?: boolean; error?: string; board: Board }>;
  moveRaw(key: string, status: string): Promise<{ ok: boolean; noop?: boolean; error?: string }>;
  create(input: Parameters<Cli["create"]>[0]): Promise<{
    ok: boolean;
    key?: string;
    error?: string;
    board: Board;
  }>;
  edit(
    key: string,
    input: Parameters<Cli["edit"]>[1],
  ): Promise<{ ok: boolean; error?: string; board: Board }>;
  open(key: string): Promise<{ url: string; fields: OpenField[]; error?: string }>;
};

function columnsOf(raw: unknown, fieldId?: string): Record<string, Card[]> {
  return Object.fromEntries(
    issuesToBoard(raw, { targetEndFieldId: fieldId }).columns.map((column) => [column.title, column.cards]),
  );
}

function stampMissingEpic(board: Board, epic: string): Board {
  for (const column of board.columns) {
    for (const card of column.cards) {
      if (!card.epic) card.epic = epic;
    }
  }
  return board;
}

function cardsOf(raw: unknown, fieldId?: string): Card[] {
  if (!Array.isArray(raw)) return [];
  return issuesToBoard(raw, { targetEndFieldId: fieldId }).columns.flatMap((column) => column.cards);
}

function issueKeyOf(issue: unknown): string | undefined {
  if (!issue || typeof issue !== "object" || !("key" in issue)) return undefined;
  return typeof issue.key === "string" ? issue.key : undefined;
}

function viewConcurrency(): number {
  const env = Number(process.env.PIPE_KAN_CHILDREN_CONCURRENCY);
  if (!Number.isNaN(env) && env > 0) return env;
  return Math.max(3, Math.min(10, availableParallelism()));
}

function defaultFieldMapPath() {
  if (process.env.PIPE_KAN_FIELD_MAP) return process.env.PIPE_KAN_FIELD_MAP;
  if (process.env.VITEST) {
    return join(tmpdir(), `pipe-kan-field-map-${process.pid}-${Math.random().toString(16).slice(2)}.json`);
  }
  return join(homedir(), ".pipe-kan", "field-map.json");
}

function defaultJiraConfigPath() {
  if (process.env.JIRA_CONFIG_FILE) return process.env.JIRA_CONFIG_FILE;
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), ".config"), ".jira", ".config.yml");
}

function safeRead(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    return readFileSync(path, "utf8");
  } catch {
    return undefined;
  }
}

async function poolMap<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T);
    }
  }
  const workers = Math.min(Math.max(1, concurrency), Math.max(1, items.length));
  await Promise.all(Array.from({ length: workers }, run));
  return results;
}

export function createApp(opts: {
  store: IssueStore;
  cli?: Cli;
  flags?: string;
  fieldMapPath?: string;
  jiraConfigPath?: string;
}): App {
  const cli = opts.cli ?? createStoreCli(opts.store);
  const fieldMapPath = opts.fieldMapPath ?? defaultFieldMapPath();
  const jiraConfigPath = opts.jiraConfigPath ?? defaultJiraConfigPath();
  let flags = opts.flags ?? DEFAULT_FLAGS;
  let payload: unknown[] = [];
  let epicsPayload: unknown[] = [];
  let childrenRaw: unknown[] = [];
  let hasChildrenCache = false;
  let childrenError: string | undefined;
  let targetEndFieldId =
    readTargetEndFieldMap(fieldMapPath).targetEnd ??
    targetEndFieldIdFromJiraConfig(safeRead(jiraConfigPath) ?? "");
  let workflowStates: string[] | undefined;

  function boardOpts() {
    return { targetEndFieldId, ...(workflowStates?.length ? { statuses: workflowStates } : {}) };
  }

  function toBoard(raw: unknown) {
    return issuesToBoard(raw, boardOpts());
  }

  function listedEpicKeys() {
    return toBoard(epicsPayload).epics.map((epic) => epic.key);
  }

  function cacheFromStore() {
    epicsPayload = opts.store.list(flagsToJql("-tEpic"));
    childrenRaw = opts.store.childrenOf(listedEpicKeys());
    hasChildrenCache = true;
    childrenError = undefined;
  }

  function currentStatus(key: string): string | undefined {
    const fromPayload = (payload as { key?: string; fields?: { status?: { name?: string } } }[])
      .find((issue) => issue.key === key)?.fields?.status?.name;
    return (
      fromPayload ??
      toBoard(epicsPayload).epics.find((epic) => epic.key === key)?.status ??
      app.board().epics.find((epic) => epic.key === key)?.status
    );
  }

  function rememberTargetEndId(issues: unknown[]) {
    for (const issue of issues) {
      if (!issue || typeof issue !== "object") continue;
      const row = issue as { names?: unknown };
      const id = resolveTargetEndFieldId(asNames(row.names));
      if (id) {
        targetEndFieldId = id;
        writeTargetEndFieldMap(fieldMapPath, { targetEnd: id });
        return;
      }
    }
    const fromConfig = targetEndFieldIdFromJiraConfig(safeRead(jiraConfigPath) ?? "");
    if (!fromConfig) return;
    targetEndFieldId = fromConfig;
    writeTargetEndFieldMap(fieldMapPath, { targetEnd: fromConfig });
  }

  async function hydrateRaw(raw: unknown): Promise<unknown[]> {
    if (!Array.isArray(raw) || raw.length === 0) return Array.isArray(raw) ? raw : [];
    const keys = [...new Set(raw.map(issueKeyOf).filter((key): key is string => Boolean(key)))];
    if (!keys.length) return raw;
    const concurrency = viewConcurrency();
    console.log(`Refresh view-raw ${keys.length} issues; concurrency ${concurrency}`);
    const views = await poolMap(keys, concurrency, async (key) => {
      try {
        return JSON.parse(await cli.view(key)) as unknown;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`Refresh view ${key} failed; ${message}`);
        return null;
      }
    });
    const byKey = new Map<string, unknown>();
    for (const view of views) {
      const key = issueKeyOf(view);
      if (key) byKey.set(key, view);
    }
    const merged = raw.map((issue) => {
      const key = issueKeyOf(issue);
      const view = key ? byKey.get(key) : undefined;
      return view ? mergeViewIntoIssue(issue, view) : issue;
    });
    rememberTargetEndId(merged);
    return merged;
  }

  function issueEpic(issue: unknown): string | undefined {
    return cardsOf([issue], targetEndFieldId)[0]?.epic;
  }

  function mergeSelectedChildren(existing: unknown[], incoming: unknown[], epicKeys: string[]) {
    const replace = new Set(epicKeys);
    const incomingKeys = new Set(
      incoming.map(issueKeyOf).filter((key): key is string => Boolean(key)),
    );
    const kept = existing.filter((issue) => {
      const key = issueKeyOf(issue);
      if (key && incomingKeys.has(key)) return false;
      const epic = issueEpic(issue);
      return !epic || !replace.has(epic);
    });
    return [...kept, ...incoming];
  }

  async function refreshSelected(epicKeys: string[]) {
    const keys = [...new Set(epicKeys.filter((key) => key.trim() !== ""))];
    console.log("Refresh selected", keys.join(","));
    try {
      let nextChildren: unknown[] = JSON.parse(await cli.listChildren(keys));
      const cards = cardsOf(nextChildren, targetEndFieldId);
      if (cards.length > 0 && !cards.some((card) => card.epic) && keys.length === 1) {
        const epic = keys[0]!;
        nextChildren = JSON.parse(await cli.listEpic(epic, flags));
      }
      const hydrated = await hydrateRaw(nextChildren);
      childrenRaw = mergeSelectedChildren(childrenRaw, hydrated, keys);
      hasChildrenCache = true;
      childrenError = undefined;
      return app.board();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refresh failed";
      console.error("Refresh failed", message);
      return { ...app.board(), error: message };
    }
  }

  async function tryMove(key: string, status: string) {
    const current = currentStatus(key);
    if (current === status) {
      return { ok: true as const, noop: true, error: undefined };
    }
    const result = await cli.move(key, status);
    return result.ok
      ? { ok: true as const, noop: false, error: undefined }
      : { ok: false as const, noop: false, error: result.error };
  }

  const app: App = {
    get flags() {
      return flags;
    },
    board() {
      const board = toBoard(payload);
      return {
        columns: board.columns,
        epics: mergeEpics(toBoard(epicsPayload).epics, board.epics),
        ...(hasChildrenCache ? { children: columnsOf(childrenRaw, targetEndFieldId) } : {}),
        ...(childrenError ? { error: childrenError } : {}),
      };
    },
    hydrate(raw, hydrateOpts) {
      payload = Array.isArray(raw) ? raw : [];
      epicsPayload = [];
      childrenRaw = [];
      hasChildrenCache = false;
      childrenError = undefined;
      if (hydrateOpts?.fromStore) cacheFromStore();
      rememberTargetEndId([...payload, ...epicsPayload, ...childrenRaw]);
      return app.board();
    },
    async refresh(next, opts) {
      if (opts?.scope === "selected") {
        return refreshSelected(opts.epicKeys ?? []);
      }
      if (next !== undefined) flags = next;
      console.log("Refresh");
      try {
        if (cli.states) {
          try {
            workflowStates = await cli.states(flags);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.log(`Refresh states failed; ${message}`);
          }
        }
        const issues = await cli.list(flags);
        const epics = await cli.listEpics(flags);
        const listedPayload = JSON.parse(issues);
        const listedEpics = JSON.parse(epics);
        const keys = toBoard(listedEpics).epics.map((epic) => epic.key);
        const issueCount = Array.isArray(listedPayload) ? listedPayload.length : 0;
        console.log(`Refresh listed ${issueCount} issues, ${keys.length} epics`);
        let nextChildren: unknown[] = [];
        let nextHasCache = false;
        let nextError: string | undefined;
        try {
          nextChildren = JSON.parse(await cli.listChildren(keys));
          const cards = cardsOf(nextChildren, targetEndFieldId);
          if (cards.length > 0 && !cards.some((card) => card.epic)) {
            console.log(`Refresh children missing Epic keys; skip ${keys.length} per-Epic lists`);
            nextChildren = [];
            nextHasCache = false;
          } else {
            nextHasCache = true;
            console.log(`Refresh children ${cards.length}`);
          }
        } catch (err) {
          nextChildren = childrenRaw;
          nextHasCache = hasChildrenCache;
          nextError = err instanceof Error ? err.message : "Epic children list failed";
          console.log("Refresh children failed; keeping existing children", nextError);
        }
        payload = await hydrateRaw(listedPayload);
        epicsPayload = await hydrateRaw(listedEpics);
        childrenRaw = nextHasCache ? await hydrateRaw(nextChildren) : nextChildren;
        hasChildrenCache = nextHasCache;
        childrenError = nextError;
        return app.board();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Refresh failed";
        console.error("Refresh failed", message);
        return { ...app.board(), error: message };
      }
    },
    async children(epic) {
      const listed = toBoard(epicsPayload).epics;
      if (!listed.some((e) => e.key === epic)) {
        return { columns: [], epics: [] };
      }
      if (hasChildrenCache) {
        const cards = Object.fromEntries(
          Object.entries(columnsOf(childrenRaw, targetEndFieldId)).map(([title, list]) => [
            title,
            list.filter((card) => card.epic === epic).map((card) => ({
              ...card,
              epic: card.epic ?? epic,
            })),
          ]),
        );
        const columns = Object.entries(cards)
          .filter(([, list]) => list.length)
          .map(([title, list]) => ({ id: title, title, cards: list }));
        if (columns.length) return { columns, epics: [] };
      }
      return stampMissingEpic(toBoard(JSON.parse(await cli.listEpic(epic, flags))), epic);
    },

    async move(key, status) {
      const result = await tryMove(key, status);
      if (!result.ok) {
        return { ok: false, error: result.error, board: app.board() };
      }
      if (result.noop) {
        return { ok: true, noop: true, board: app.board() };
      }
      await app.refresh();
      return { ok: true, board: app.board() };
    },

    async moveRaw(key, status) {
      const result = await tryMove(key, status);
      return result.ok
        ? { ok: true, noop: result.noop }
        : { ok: false, error: result.error };
    },
    async create(input) {
      const result = await cli.create(input);
      if (!result.ok) {
        return { ok: false, error: result.error, key: result.key, board: app.board() };
      }
      await app.refresh();
      return { ok: true, key: result.key, board: app.board() };
    },
    async edit(key, input) {
      const result = await cli.edit(key, input);
      if (!result.ok) {
        return { ok: false, error: result.error, board: app.board() };
      }
      await app.refresh();
      return { ok: true, board: app.board() };
    },
    async open(key) {
      const urlP = cli.open(key);
      try {
        const [url, raw] = await Promise.all([urlP, cli.view(key)]);
        return { url, fields: flattenIssue(JSON.parse(raw), url) };
      } catch (err) {
        return {
          url: await urlP.catch(() => `/browse/${key}`),
          fields: [],
          error: err instanceof Error ? err.message : "jira issue view failed",
        };
      }
    },
  };
  return app;
}
