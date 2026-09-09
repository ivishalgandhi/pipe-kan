import { issuesToBoard, mergeEpics, type Board, type Card } from "./board.ts";
import { createStoreCli, type Cli } from "./cli.ts";
import { DEFAULT_FLAGS, flagsToJql } from "./flags.ts";
import { flattenIssue, type OpenField } from "./open.ts";
import { IssueStore } from "./store.ts";

export type App = {
  flags: string;
  hydrate(raw: unknown, opts?: { fromStore?: boolean }): Board;
  refresh(flags?: string): Promise<Board>;
  children(epic: string): Promise<Board>;
  board(): Board;
  move(
    key: string,
    status: string,
  ): Promise<{ ok: boolean; noop?: boolean; error?: string; board: Board }>;
  moveRaw(key: string, status: string): Promise<{ ok: boolean; noop?: boolean; error?: string }>;
  open(key: string): Promise<{ url: string; fields: OpenField[]; error?: string }>;
};

function columnsOf(raw: unknown): Record<string, Card[]> {
  return Object.fromEntries(
    issuesToBoard(raw).columns.map((column) => [column.title, column.cards]),
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

function cardsOf(raw: unknown): Card[] {
  if (!Array.isArray(raw)) return [];
  return issuesToBoard(raw).columns.flatMap((column) => column.cards);
}

export function createApp(opts: { store: IssueStore; cli?: Cli }): App {
  const cli = opts.cli ?? createStoreCli(opts.store);
  let flags = DEFAULT_FLAGS;
  let payload: unknown[] = [];
  let epicsPayload: unknown[] = [];
  let childrenRaw: unknown[] = [];
  let hasChildrenCache = false;
  let childrenError: string | undefined;

  function listedEpicKeys() {
    return issuesToBoard(epicsPayload).epics.map((epic) => epic.key);
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
      issuesToBoard(epicsPayload).epics.find((epic) => epic.key === key)?.status ??
      app.board().epics.find((epic) => epic.key === key)?.status
    );
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
      const board = issuesToBoard(payload);
      return {
        columns: board.columns,
        epics: mergeEpics(issuesToBoard(epicsPayload).epics, board.epics),
        ...(hasChildrenCache ? { children: columnsOf(childrenRaw) } : {}),
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
      return app.board();
    },
    async refresh(next) {
      if (next !== undefined) flags = next;
      console.log("Refresh");
      try {
        const issues = await cli.list(flags);
        const epics = await cli.listEpics(flags);
        const nextPayload = JSON.parse(issues);
        const nextEpics = JSON.parse(epics);
        const keys = issuesToBoard(nextEpics).epics.map((epic) => epic.key);
        const issueCount = Array.isArray(nextPayload) ? nextPayload.length : 0;
        console.log(`Refresh listed ${issueCount} issues, ${keys.length} epics`);
        let nextChildren: unknown[] = [];
        let nextHasCache = false;
        let nextError: string | undefined;
        try {
          nextChildren = JSON.parse(await cli.listChildren(keys));
          const cards = cardsOf(nextChildren);
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
        payload = nextPayload;
        epicsPayload = nextEpics;
        childrenRaw = nextChildren;
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
      const listed = issuesToBoard(epicsPayload).epics;
      if (!listed.some((e) => e.key === epic)) {
        return { columns: [], epics: [] };
      }
      if (hasChildrenCache) {
        const cards = Object.fromEntries(
          Object.entries(columnsOf(childrenRaw)).map(([title, list]) => [
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
      return stampMissingEpic(issuesToBoard(JSON.parse(await cli.listEpic(epic, flags))), epic);
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
