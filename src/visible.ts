import type { Card, Epic } from "./board.ts";

export type BoardFilter = Record<string, string[]>;

export type FilterFacet = {
  key: string;
  label: string;
  values: string[];
  group?: string;
};

export type BoardSort = "payload" | "priority" | "age" | "due" | "key";

export type VisibleOpts = {
  filter?: BoardFilter;
  sort?: BoardSort;
  hide?: string[];
  epics?: Epic[];
};

export type FavouriteFolder = {
  name: string;
  keys: string[];
};

export type FavouriteState = {
  keys: string[];
  folders: FavouriteFolder[];
};

function ofEpic(card: Card, epic: string) {
  return card.epic === epic;
}

function needle(query: string) {
  return query.trim().toLowerCase();
}

function haystack(card: Card) {
  return [
    card.key,
    card.summary,
    card.assignee,
    card.priority,
    card.epic,
    ...(card.labels ?? []),
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n")
    .toLowerCase();
}

export function cardMatches(card: Card, query: string) {
  const q = needle(query);
  return !q || haystack(card).includes(q);
}

export function epicMatches(epic: Epic, query: string) {
  const q = needle(query);
  return !q || `${epic.key}\n${epic.summary}\n${(epic.labels ?? []).join("\n")}`.toLowerCase().includes(q);
}

export function priorityRank(priority?: string): number {
  const value = (priority ?? "").trim().toLowerCase();
  if (!value) return 1000;
  const numbered = /^p(\d+)$/.exec(value);
  if (numbered) return Number(numbered[1]);
  const named: Record<string, number> = {
    highest: 1,
    critical: 1,
    blocker: 1,
    high: 2,
    h: 2,
    medium: 3,
    med: 3,
    m: 3,
    normal: 3,
    low: 4,
    l: 4,
    lowest: 5,
    trivial: 5,
  };
  return named[value] ?? 100;
}

function epicByKey(epics: Epic[] = []) {
  return new Map(epics.map((epic) => [epic.key, epic]));
}

function epicAssigneeOf(card: Card, byKey: Map<string, Epic>): string {
  return (card.epic ? byKey.get(card.epic)?.assignee : undefined) ?? "Unassigned";
}

function cardValues(card: Card, field: string, byKey: Map<string, Epic>): string[] {
  if (field === "assignee") return [card.assignee ?? "Unassigned"];
  if (field === "epicAssignee") return [epicAssigneeOf(card, byKey)];
  if (field === "priority") return card.priority ? [card.priority] : [];
  if (field === "labels") return card.labels ?? [];
  return [];
}

function hasFilter(filter?: BoardFilter) {
  return Boolean(filter && Object.values(filter).some((values) => values.length > 0));
}

function cardMatchesFilter(card: Card, filter?: BoardFilter, epics?: Epic[]) {
  if (!hasFilter(filter)) return true;
  const byKey = epicByKey(epics);
  return Object.entries(filter!).every(
    ([field, selected]) =>
      !selected.length || cardValues(card, field, byKey).some((value) => selected.includes(value)),
  );
}

function uniqueSorted(values: string[], compare: (a: string, b: string) => number) {
  return [...new Set(values)].sort(compare);
}

function peopleFacet(
  key: string,
  label: string,
  assigned: string[],
  unassigned: boolean,
): FilterFacet | undefined {
  if (!assigned.length) return undefined;
  return {
    key,
    label,
    group: "Assignee",
    values: [...uniqueSorted(assigned, (a, b) => a.localeCompare(b)), ...(unassigned ? ["Unassigned"] : [])],
  };
}

export function filterFacets(cards: Card[], epics: Epic[] = []): FilterFacet[] {
  const facets: FilterFacet[] = [];
  const priorities = [
    ...cards.map((card) => card.priority),
    ...epics.map((epic) => epic.priority),
  ].filter((value): value is string => Boolean(value));
  if (priorities.length) {
    facets.push({
      key: "priority",
      label: "Priority",
      group: "Priority",
      values: uniqueSorted(
        priorities,
        (a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b),
      ),
    });
  }
  const byKey = epicByKey(epics);
  const epicAssigned = cards
    .map((card) => (card.epic ? byKey.get(card.epic)?.assignee : undefined))
    .filter((value): value is string => Boolean(value));
  const epicFacet = peopleFacet(
    "epicAssignee",
    "Epic",
    epicAssigned,
    cards.some((card) => !byKey.get(card.epic ?? "")?.assignee),
  );
  if (epicFacet) facets.push(epicFacet);
  const assignees = [
    ...cards.map((card) => card.assignee),
    ...epics.map((epic) => epic.assignee),
  ].filter((value): value is string => Boolean(value));
  const storyFacet = peopleFacet(
    "assignee",
    "Stories",
    assignees,
    cards.some((card) => !card.assignee) || epics.some((epic) => !epic.assignee),
  );
  if (storyFacet) facets.push(storyFacet);
  const labels = [
    ...cards.flatMap((card) => card.labels ?? []),
    ...epics.flatMap((epic) => epic.labels ?? []),
  ];
  if (labels.length) {
    facets.push({
      key: "labels",
      label: "Labels",
      group: "Labels",
      values: uniqueSorted(labels, (a, b) => a.localeCompare(b)),
    });
  }
  return facets;
}

function omitted(
  card: Card,
  epic: string | null,
  query: string,
  filter?: BoardFilter,
  epics?: Epic[],
) {
  if (epic && !ofEpic(card, epic)) return true;
  return !cardMatches(card, query) || !cardMatchesFilter(card, filter, epics);
}

function parseTime(value?: string) {
  if (!value) return Number.NaN;
  return Date.parse(value);
}

function compareMissing(a: number, b: number) {
  const aMissing = Number.isNaN(a);
  const bMissing = Number.isNaN(b);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return a - b;
}

function byPriorityThenKey(
  a: { key: string; priority?: string },
  b: { key: string; priority?: string },
) {
  const rank = priorityRank(a.priority) - priorityRank(b.priority);
  return rank !== 0 ? rank : a.key.localeCompare(b.key);
}

function sortCards(cards: Card[], sort?: BoardSort) {
  if (!sort || sort === "payload") return cards;
  return [...cards].sort((a, b) => {
    let cmp = 0;
    if (sort === "priority") cmp = byPriorityThenKey(a, b);
    else if (sort === "age") cmp = compareMissing(parseTime(a.created), parseTime(b.created));
    else if (sort === "due") cmp = compareMissing(parseTime(a.dueDate), parseTime(b.dueDate));
    else if (sort === "key") cmp = a.key.localeCompare(b.key);
    return cmp !== 0 ? cmp : a.key.localeCompare(b.key);
  });
}

export function mergeSearchHits(
  columns: Record<string, Card[]>,
  extra: Record<string, Card[]> | undefined,
  query: string,
): Record<string, Card[]> {
  if (!needle(query) || !extra) return columns;
  const seen = new Set(
    Object.values(columns).flatMap((cards) => cards.map((card) => card.key)),
  );
  const next: Record<string, Card[]> = Object.fromEntries(
    Object.entries(columns).map(([title, cards]) => [title, [...cards]]),
  );
  for (const [title, cards] of Object.entries(extra)) {
    for (const card of cards) {
      if (seen.has(card.key) || !cardMatches(card, query)) continue;
      seen.add(card.key);
      const list = next[title] ?? [];
      list.push(card);
      next[title] = list;
    }
  }
  return next;
}

export function filterValue(
  columns: Record<string, Card[]>,
  epic: string | null,
  query = "",
  opts?: VisibleOpts,
): Record<string, Card[]> {
  const hide = new Set(opts?.hide ?? []);
  const next = Object.fromEntries(
    Object.entries(columns)
      .filter(([title]) => !hide.has(title))
      .map(([title, cards]) => [
        title,
        sortCards(
          cards.filter((card) => !omitted(card, epic, query, opts?.filter, opts?.epics)),
          opts?.sort,
        ),
      ]),
  );
  if (!needle(query) && !hasFilter(opts?.filter)) return next;
  return Object.fromEntries(
    Object.entries(next).filter(([, cards]) => cards.length > 0),
  );
}

function epicValues(epic: Epic, field: string): string[] {
  if (field === "assignee" || field === "epicAssignee") return [epic.assignee ?? "Unassigned"];
  if (field === "priority") return epic.priority ? [epic.priority] : [];
  if (field === "labels") return epic.labels ?? [];
  return [];
}

function epicMatchesFilter(epic: Epic, filter?: BoardFilter) {
  if (!hasFilter(filter)) return true;
  return Object.entries(filter!).every(
    ([field, selected]) =>
      !selected.length || epicValues(epic, field).some((value) => selected.includes(value)),
  );
}

function remainingChildren(
  epic: Epic,
  cards: Card[],
  query: string,
  filter?: BoardFilter,
  epics?: Epic[],
) {
  return cards.filter(
    (card) =>
      card.epic === epic.key &&
      cardMatches(card, query) &&
      cardMatchesFilter(card, filter, epics),
  );
}

function epicRowVisible(
  epic: Epic,
  cards: Card[],
  query: string,
  filter?: BoardFilter,
  epics?: Epic[],
) {
  const kids = cards.filter((card) => card.epic === epic.key);
  const searchHit =
    !needle(query) ||
    epicMatches(epic, query) ||
    kids.some((card) => cardMatches(card, query));
  if (!searchHit) return false;
  if (!hasFilter(filter)) return true;
  if (kids.length === 0) return true;
  return epicMatchesFilter(epic, filter) || remainingChildren(epic, cards, query, filter, epics).length > 0;
}

export function epicChildCount(
  cards: Card[],
  key: string,
  query = "",
  filter?: BoardFilter,
  epics?: Epic[],
) {
  return remainingChildren({ key, summary: "" }, cards, query, filter, epics).length;
}

export function filterEpics(
  epics: Epic[],
  cards: Card[],
  query: string,
  filter?: BoardFilter,
) {
  if (!needle(query) && !hasFilter(filter)) return epics;
  return epics.filter((epic) => epicRowVisible(epic, cards, query, filter, epics));
}

export function groupEpics(epics: Epic[]): { status: string; epics: Epic[] }[] {
  const groups = new Map<string, Epic[]>();
  const order: string[] = [];
  const none: Epic[] = [];
  for (const epic of epics) {
    const status = epic.status?.trim() ?? "";
    if (!status) {
      none.push(epic);
      continue;
    }
    const list = groups.get(status);
    if (!list) {
      groups.set(status, [epic]);
      order.push(status);
      continue;
    }
    list.push(epic);
  }
  return [
    ...order.map((status) => ({ status, epics: groups.get(status) ?? [] })),
    ...(none.length ? [{ status: "", epics: none }] : []),
  ];
}

export function mergeValue(
  next: Record<string, Card[]>,
  previous: Record<string, Card[]>,
  epic: string | null,
  query = "",
  opts?: VisibleOpts,
): Record<string, Card[]> {
  const hide = opts?.hide ?? [];
  if (!epic && !needle(query) && !hasFilter(opts?.filter) && hide.length === 0) {
    return next;
  }
  const hiddenCards = Object.fromEntries(
    Object.entries(previous).map(([title, cards]) => [
      title,
      hide.includes(title)
        ? cards
        : cards.filter((card) => omitted(card, epic, query, opts?.filter, opts?.epics)),
    ]),
  );
  const titles = new Set([...Object.keys(hiddenCards), ...Object.keys(next)]);
  return Object.fromEntries(
    [...titles].map((title) => [
      title,
      [...(hiddenCards[title] ?? []), ...(next[title] ?? [])],
    ]),
  );
}

export function rollbackColumns(
  previousValue: Record<string, Card[]>,
  current: Record<string, Card[]>,
  epic: string | null,
  query = "",
  opts?: VisibleOpts,
) {
  return mergeValue(previousValue, current, epic, query, opts);
}

export function stampEpic(
  columns: Record<string, Card[]>,
  children: Record<string, Card[]>,
  epic: string,
): Record<string, Card[]> {
  const childKeys = new Set(
    Object.values(children)
      .flat()
      .map((card) => card.key),
  );
  const titles = new Set([...Object.keys(columns), ...Object.keys(children)]);
  return Object.fromEntries(
    [...titles].map((title) => {
      const current = columns[title] ?? [];
      const incoming = children[title] ?? [];
      const have = new Set(current.map((card) => card.key));
      const stamped = current.map((card) =>
        childKeys.has(card.key) ? { ...card, epic: card.epic ?? epic } : card,
      );
      const added = incoming
        .filter((card) => !have.has(card.key))
        .map((card) => ({ ...card, epic: card.epic ?? epic }));
      return [title, [...stamped, ...added]];
    }),
  );
}

function folderOf(name: string, folders: FavouriteFolder[]) {
  return folders.find((folder) => folder.name.toLowerCase() === name.trim().toLowerCase());
}

export function listedFavourites(
  epics: Epic[],
  state: FavouriteState,
  query = "",
  cards: Card[] = [],
  filter?: BoardFilter,
): { unfiled: Epic[]; folders: { name: string; epics: Epic[] }[] } {
  const filed = new Set(state.folders.flatMap((folder) => folder.keys));
  const byKey = new Map(epics.map((epic) => [epic.key, epic]));
  const unfiled = state.keys
    .map((key) => byKey.get(key))
    .filter((epic): epic is Epic => !!epic && !filed.has(epic.key) && epicRowVisible(epic, cards, query, filter, epics))
    .sort(byPriorityThenKey);
  const folders = [...state.folders]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((folder) => ({
      name: folder.name,
      epics: folder.keys
        .map((key) => byKey.get(key))
        .filter((epic): epic is Epic => !!epic && epicRowVisible(epic, cards, query, filter, epics))
        .sort(byPriorityThenKey),
    }))
    .filter((folder) => !needle(query) || epicMatches({ key: "", summary: folder.name }, query) || folder.epics.length > 0);
  return { unfiled, folders };
}

export function favouriteGroup(
  epics: Epic[],
  keys: string[],
  query = "",
  cards: Card[] = [],
  filter?: BoardFilter,
) {
  return listedFavourites(epics, { keys, folders: [] }, query, cards, filter).unfiled;
}

export function toggleFavourite(state: FavouriteState, key: string): FavouriteState {
  if (state.keys.includes(key)) {
    return {
      keys: state.keys.filter((item) => item !== key),
      folders: state.folders.map((folder) => ({
        ...folder,
        keys: folder.keys.filter((item) => item !== key),
      })),
    };
  }
  return { ...state, keys: [...state.keys, key] };
}

export function addFolder(
  state: FavouriteState,
  name: string,
): { ok: true; state: FavouriteState } | { ok: false } {
  const trimmed = name.trim();
  if (!trimmed || folderOf(trimmed, state.folders)) return { ok: false };
  return { ok: true, state: { ...state, folders: [...state.folders, { name: trimmed, keys: [] }] } };
}

export function renameFolder(
  state: FavouriteState,
  from: string,
  to: string,
): { ok: true; state: FavouriteState } | { ok: false } {
  const trimmed = to.trim();
  const current = folderOf(from, state.folders);
  if (!trimmed || !current) return { ok: false };
  const clash = folderOf(trimmed, state.folders);
  if (clash && clash !== current) return { ok: false };
  if (clash === current) return { ok: false };
  return {
    ok: true,
    state: {
      ...state,
      folders: state.folders.map((folder) =>
        folder === current ? { ...folder, name: trimmed } : folder,
      ),
    },
  };
}

export function removeFolder(state: FavouriteState, name: string): FavouriteState {
  return {
    ...state,
    folders: state.folders.filter((folder) => folder.name.toLowerCase() !== name.trim().toLowerCase()),
  };
}

export function moveFavourite(
  state: FavouriteState,
  key: string,
  folder: string | null,
): FavouriteState {
  const keys = state.keys.includes(key) ? state.keys : [...state.keys, key];
  const folders = state.folders.map((item) => ({
    ...item,
    keys: item.keys.filter((itemKey) => itemKey !== key),
  }));
  if (folder) {
    const home = folderOf(folder, folders);
    if (home) home.keys.push(key);
  }
  return { keys, folders };
}

export type Preset = {
  name: string;
  filter: BoardFilter;
  sort: BoardSort;
  hide: string[];
};

function presetOf(name: string, presets: Preset[]) {
  return presets.find((preset) => preset.name.toLowerCase() === name.trim().toLowerCase());
}

function snapshotChrome(chrome: Pick<Preset, "filter" | "sort" | "hide">) {
  return {
    filter: { ...chrome.filter },
    sort: chrome.sort,
    hide: [...chrome.hide],
  };
}

export function addPreset(
  presets: Preset[],
  name: string,
  chrome: Pick<Preset, "filter" | "sort" | "hide">,
): { ok: true; presets: Preset[] } | { ok: false } {
  const trimmed = name.trim();
  if (!trimmed || presetOf(trimmed, presets)) return { ok: false };
  return {
    ok: true,
    presets: [
      ...presets,
      { name: trimmed, ...snapshotChrome(chrome) },
    ],
  };
}

export function applyPreset(
  presets: Preset[],
  name: string,
): { ok: true; chrome: Pick<Preset, "filter" | "sort" | "hide"> } | { ok: false } {
  const current = presetOf(name, presets);
  if (!current) return { ok: false };
  return { ok: true, chrome: snapshotChrome(current) };
}

export function overwritePreset(
  presets: Preset[],
  name: string,
  chrome: Pick<Preset, "filter" | "sort" | "hide">,
): { ok: true; presets: Preset[] } | { ok: false } {
  const current = presetOf(name, presets);
  if (!current) return { ok: false };
  return {
    ok: true,
    presets: presets.map((preset) =>
      preset === current
        ? { name: current.name, ...snapshotChrome(chrome) }
        : preset,
    ),
  };
}

export function renamePreset(
  presets: Preset[],
  from: string,
  to: string,
): { ok: true; presets: Preset[] } | { ok: false } {
  const trimmed = to.trim();
  const current = presetOf(from, presets);
  if (!trimmed || !current) return { ok: false };
  const clash = presetOf(trimmed, presets);
  if (clash) return { ok: false };
  return {
    ok: true,
    presets: presets.map((preset) =>
      preset === current ? { ...preset, name: trimmed } : preset,
    ),
  };
}

export function removePreset(presets: Preset[], name: string): Preset[] {
  return presets.filter((preset) => preset.name.toLowerCase() !== name.trim().toLowerCase());
}
