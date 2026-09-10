import { expect, test } from "vitest";

import { createApp } from "./app.ts";
import { epicsToColumns, issuesToBoard, mergeEpics, type Card, type Epic, type RawIssue } from "./board.ts";
import { commandCatalog } from "./command.ts";
import { IssueStore } from "./store.ts";
import {
  applyColumnOrder,
  combinedBoard,
  filterEpics,
  filterFacets,
  filterValue,
  groupEpics,
  listedFavourites,
  mergeValue,
} from "./visible.ts";

const STATUSES = ["Draft", "To Do", "In Progress", "Done"] as const;

function manyEpics(count: number): Epic[] {
  return Array.from({ length: count }, (_, n) => ({
    key: `DEMO-${n + 1}`,
    summary: `Epic ${n + 1}`,
    status: STATUSES[n % STATUSES.length],
    priority: ["High", "Medium", "Low"][n % 3],
    ...(n % 11 === 0 ? {} : { assignee: `Person ${n % 12}` }),
    labels: [`label-${n % 20}`],
  }));
}

function epicRaw(epic: Epic): RawIssue {
  return {
    key: epic.key,
    fields: {
      summary: epic.summary,
      status: { name: epic.status },
      issuetype: { name: "Epic" },
      issueType: { name: "Epic" },
      ...(epic.priority ? { priority: { name: epic.priority } } : {}),
      ...(epic.assignee ? { assignee: { displayName: epic.assignee } } : {}),
      labels: epic.labels,
    },
  };
}

function childrenRaw(epics: Epic[]): RawIssue[] {
  return epics.flatMap((epic, n) =>
    n % 5 === 0
      ? [
          {
            key: `STORY-${n + 1}`,
            fields: {
              summary: `Child of ${epic.key}`,
              status: { name: "To Do" },
              issuetype: { name: "Story" },
              parent: { key: epic.key },
              labels: [`child-${n % 8}`],
            },
          },
        ]
      : [],
  );
}

function columnMap(epics: Epic[]): Record<string, Card[]> {
  return Object.fromEntries(epicsToColumns(epics).map((column) => [column.title, column.cards]));
}

function keysOf(columns: Record<string, Card[]>) {
  return Object.values(columns).flatMap((cards) => cards.map((card) => card.key));
}

function expectUnique(keys: string[]) {
  expect(new Set(keys).size).toBe(keys.length);
}

for (const count of [200, 250, 300]) {
  test(`issuesToBoard and epicsToColumns keep ${count} unique Epics`, () => {
    const epics = manyEpics(count);
    const board = issuesToBoard(epics.map(epicRaw));
    expect(board.epics.map((epic) => epic.key)).toEqual(epics.map((epic) => epic.key));
    expectUnique(board.epics.map((epic) => epic.key));
    const columns = epicsToColumns(board.epics);
    expect(columns.map((column) => column.title)).toEqual([...STATUSES]);
    const cards = columns.flatMap((column) => column.cards);
    expect(cards).toHaveLength(count);
    expectUnique(cards.map((card) => card.key));
    expect(cards.every((card) => card.type === "Epic")).toBe(true);
  });

  test(`Refresh lists ${count} Epics and their children`, async () => {
    const epics = manyEpics(count);
    const stories = childrenRaw(epics);
    const store = IssueStore.fromRaw([...epics.map(epicRaw), ...stories]);
    const started = performance.now();
    const board = await createApp({ store }).refresh();
    expect(performance.now() - started).toBeLessThan(1500);
    expect(board.epics).toHaveLength(count);
    expectUnique(board.epics.map((epic) => epic.key));
    expect(board.epics.map((epic) => epic.key)).toEqual(epics.map((epic) => epic.key));
    expect(board.columns.flatMap((column) => column.cards).map((card) => card.key)).toEqual(
      stories.map((issue) => issue.key),
    );
    expect(board.children).toBeTruthy();
    expect(Object.values(board.children ?? {}).flat()).toHaveLength(stories.length);
  });

  test(`Filter, Search, and Combined stay unique across ${count} Epics`, () => {
    const epics = manyEpics(count);
    const stories = childrenRaw(epics).map((issue) => ({
      key: String(issue.key),
      summary: String(issue.fields?.summary ?? ""),
      epic: String(
        issue.fields?.parent && typeof issue.fields.parent === "object" && "key" in issue.fields.parent
          ? issue.fields.parent.key
          : "",
      ),
      type: "Story",
      labels: Array.isArray(issue.fields?.labels)
        ? issue.fields.labels.filter((label): label is string => typeof label === "string")
        : undefined,
    }));
    const epicColumns = columnMap(epics);
    const columns = {
      ...epicColumns,
      "To Do": [...stories, ...(epicColumns["To Do"] ?? [])],
    };
    const cards = Object.values(columns).flat();
    const started = performance.now();
    const listed = filterEpics(epics, cards, "Epic 12");
    const grouped = groupEpics(epics);
    const facets = filterFacets(cards, epics);
    const filtered = filterValue(columns, null, "", { filter: { priority: ["High"] }, epics });
    const combined = combinedBoard(columns, epics, "", { sort: "key" });
    const favourites = listedFavourites(
      epics,
      { keys: epics.slice(0, 40).map((epic) => epic.key), folders: [] },
      "",
      cards,
    );
    expect(performance.now() - started).toBeLessThan(500);

    expect(listed.some((epic) => epic.key === "DEMO-12")).toBe(true);
    expect(listed.length).toBeLessThan(count);
    expect(grouped.reduce((sum, group) => sum + group.epics.length, 0)).toBe(count);
    expect(grouped.map((group) => group.status)).toEqual([...STATUSES]);
    expect(facets.find((facet) => facet.key === "priority")?.values).toEqual(["High", "Medium", "Low"]);
    expect(facets.find((facet) => facet.key === "labels")?.values).toHaveLength(28);
    expectUnique(keysOf(filtered));
    expectUnique(keysOf(combined));
    expect(combined.Draft?.some((card) => card.type === "Epic")).toBe(true);
    expect(favourites.unfiled).toHaveLength(40);
  });
}

test("merge keeps one Card when 250 Epics include a duplicate after Move", () => {
  const epics = manyEpics(250);
  const previous = columnMap(epics);
  const moved = previous.Draft[0];
  const next = {
    Draft: previous.Draft,
    "To Do": [moved, ...previous["To Do"]],
    "In Progress": previous["In Progress"],
    Done: previous.Done,
  };
  const merged = mergeValue(next, previous, null);
  expect(keysOf(merged).filter((key) => key === moved.key)).toEqual([moved.key]);
  expect(merged["To Do"].some((card) => card.key === moved.key)).toBe(true);
  expect(merged.Draft.some((card) => card.key === moved.key)).toBe(false);
  expectUnique(keysOf(merged));
  expect(keysOf(merged)).toHaveLength(250);
});

test("applyColumnOrder restores Draft first among 300 Epic statuses", () => {
  const columns = columnMap(manyEpics(300));
  const ordered = applyColumnOrder(columns, ["Done", "Draft", "In Progress"]);
  expect(Object.keys(ordered)).toEqual(["Done", "Draft", "In Progress", "To Do"]);
  expect(keysOf(ordered)).toHaveLength(300);
  expectUnique(keysOf(ordered));
});

test("mergeEpics keeps listed order for 300 Epics and fills missing summaries", () => {
  const listed = manyEpics(300);
  const fromBoard: Epic[] = [
    { key: "DEMO-1", summary: "" },
    { key: "EXTRA-1", summary: "from stories" },
  ];
  const merged = mergeEpics(listed, fromBoard);
  expect(merged).toHaveLength(301);
  expect(merged[0]).toMatchObject({ key: "DEMO-1", summary: "Epic 1" });
  expect(merged.at(-1)).toEqual({ key: "EXTRA-1", summary: "from stories" });
});

test("Command finds one Epic among 300", () => {
  const epics = manyEpics(300);
  const groups = commandCatalog({ presets: [], query: "Epic 247", epics });
  const epicRows = groups.find((group) => group.id === "epics")?.rows ?? [];
  expect(epicRows).toEqual([
    { label: "Epic 247", key: "DEMO-247", jump: { kind: "epic", key: "DEMO-247" } },
  ]);
});
