import { expect, test } from "vitest";

import { commandCatalog, commandPick } from "./command.ts";

test("empty query lists Actions only and omits Apply when there are no Presets", () => {
  expect(commandCatalog({ presets: [], query: "" })).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [
        { label: "All stories", jump: { kind: "all-stories" } },
        { label: "All epics", jump: { kind: "all-epics" } },
        { label: "Refresh", jump: { kind: "refresh" } },
        { label: "Agent", jump: { kind: "agent" } },
      ],
    },
  ]);
});

test("Apply rows follow Preset create order", () => {
  expect(commandCatalog({ presets: ["Now", "Later"], query: "" })).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [
        { label: "All stories", jump: { kind: "all-stories" } },
        { label: "All epics", jump: { kind: "all-epics" } },
        { label: "Refresh", jump: { kind: "refresh" } },
        { label: "Agent", jump: { kind: "agent" } },
        { label: "Apply Now", jump: { kind: "preset", name: "Now" } },
        { label: "Apply Later", jump: { kind: "preset", name: "Later" } },
      ],
    },
  ]);
});

test("typing filters Actions by case-insensitive row label", () => {
  expect(commandCatalog({ presets: ["Now", "Later"], query: "REF" })).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [{ label: "Refresh", jump: { kind: "refresh" } }],
    },
  ]);
  expect(commandCatalog({ presets: ["Now", "Later"], query: "apply" })).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [
        { label: "Apply Now", jump: { kind: "preset", name: "Now" } },
        { label: "Apply Later", jump: { kind: "preset", name: "Later" } },
      ],
    },
  ]);
  expect(commandCatalog({ presets: ["Now", "Later"], query: "now" })).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [{ label: "Apply Now", jump: { kind: "preset", name: "Now" } }],
    },
  ]);
  expect(commandCatalog({ presets: ["Now"], query: "missing" })).toEqual([]);
});

test("pick yields all-stories, all-epics, refresh, agent, and preset intents", () => {
  const rows = commandCatalog({ presets: ["Now"], query: "" })[0]?.rows ?? [];
  expect(rows.map((row) => commandPick(row))).toEqual([
    { kind: "all-stories" },
    { kind: "all-epics" },
    { kind: "refresh" },
    { kind: "agent" },
    { kind: "preset", name: "Now" },
  ]);
});

const listedEpic = { key: "DEMO-1", summary: "Ship a local kanban", labels: ["kanban"] };
const otherEpic = { key: "DEMO-9", summary: "Other" };
const child = {
  key: "DEMO-2",
  summary: "Parse jira-cli",
  epic: "DEMO-1",
  assignee: "Ada",
  priority: "Medium",
  labels: ["parser"],
};
const labeled = { key: "DEMO-3", summary: "Drag a Card to Move", epic: "DEMO-1", labels: ["kanban"] };

test("empty query omits Epics and Cards even when listed", () => {
  expect(
    commandCatalog({
      presets: [],
      query: "",
      epics: [listedEpic],
      cards: [child],
      favouriteKeys: ["DEMO-1"],
    }),
  ).toEqual([
    {
      id: "actions",
      title: "Actions",
      rows: [
        { label: "All stories", jump: { kind: "all-stories" } },
        { label: "All epics", jump: { kind: "all-epics" } },
        { label: "Refresh", jump: { kind: "refresh" } },
        { label: "Agent", jump: { kind: "agent" } },
      ],
    },
  ]);
});

test("typing lists matching Epics then Cards after filtered Actions", () => {
  expect(
    commandCatalog({
      presets: [],
      query: "kanban",
      epics: [listedEpic, otherEpic],
      cards: [child, labeled],
    }),
  ).toEqual([
    {
      id: "epics",
      title: "Epics",
      rows: [{ label: "Ship a local kanban", key: "DEMO-1", jump: { kind: "epic", key: "DEMO-1" } }],
    },
    {
      id: "cards",
      title: "Cards",
      rows: [
        {
          label: "Drag a Card to Move",
          key: "DEMO-3",
          jump: { kind: "card", key: "DEMO-3", epic: "DEMO-1" },
        },
      ],
    },
  ]);
  expect(
    commandCatalog({
      presets: [],
      query: "all",
      epics: [listedEpic],
      cards: [child],
    })[0],
  ).toEqual({
    id: "actions",
    title: "Actions",
    rows: [
      { label: "All stories", jump: { kind: "all-stories" } },
      { label: "All epics", jump: { kind: "all-epics" } },
    ],
  });
});

test("Epic match is key summary labels and ignores a matching child", () => {
  expect(
    commandCatalog({
      presets: [],
      query: "parse",
      epics: [listedEpic],
      cards: [child],
    }).map((group) => group.id),
  ).toEqual(["cards"]);
  expect(
    commandCatalog({
      presets: [],
      query: "DEMO-1",
      epics: [listedEpic],
      cards: [child],
    }).map((group) => group.id),
  ).toEqual(["epics", "cards"]);
});

test("Card match uses the same needles as Search", () => {
  const rows = (query: string) =>
    commandCatalog({ presets: [], query, epics: [listedEpic], cards: [child] })
      .find((group) => group.id === "cards")
      ?.rows.map((row) => row.key);
  expect(rows("DEMO-2")).toEqual(["DEMO-2"]);
  expect(rows("Parse")).toEqual(["DEMO-2"]);
  expect(rows("Ada")).toEqual(["DEMO-2"]);
  expect(rows("Medium")).toEqual(["DEMO-2"]);
  expect(rows("parser")).toEqual(["DEMO-2"]);
});

test("typing lists every matching Epic and Card in payload order and Actions never cap", () => {
  const epics = Array.from({ length: 9 }, (_, i) => ({
    key: `EPIC-${i}`,
    summary: `Listed epic ${i}`,
  }));
  const cards = Array.from({ length: 9 }, (_, i) => ({
    key: `CARD-${i}`,
    summary: `Listed card ${i}`,
  }));
  const groups = commandCatalog({
    presets: Array.from({ length: 9 }, (_, i) => `Now ${i}`),
    query: "listed",
    epics,
    cards,
  });
  expect(groups.find((group) => group.id === "epics")?.rows.map((row) => row.key)).toEqual(
    epics.map((epic) => epic.key),
  );
  expect(groups.find((group) => group.id === "cards")?.rows.map((row) => row.key)).toEqual(
    cards.map((card) => card.key),
  );
  expect(
    commandCatalog({
      presets: Array.from({ length: 9 }, (_, i) => `Now ${i}`),
      query: "apply",
    }).find((group) => group.id === "actions")?.rows,
  ).toHaveLength(9);
});

test("Filter Hide Search and selected Epic do not drop catalog rows", () => {
  const hidden = { key: "DEMO-5", summary: "Already shipped", epic: "DEMO-1" };
  expect(
    commandCatalog({
      presets: [],
      query: "shipped",
      epics: [listedEpic],
      cards: [hidden],
    }).find((group) => group.id === "cards")?.rows.map((row) => row.key),
  ).toEqual(["DEMO-5"]);
});

test("children-cache Cards omitted unless they are in Scope", () => {
  expect(
    commandCatalog({
      presets: [],
      query: "DEMO",
      epics: [listedEpic],
      cards: [child],
    }).find((group) => group.id === "cards")?.rows.map((row) => row.key),
  ).toEqual(["DEMO-2"]);
});

test("Favourite is a starred Epic whose pick is the epic jump", () => {
  const rows =
    commandCatalog({
      presets: [],
      query: "ship",
      epics: [listedEpic, otherEpic],
      favouriteKeys: ["DEMO-1"],
    }).find((group) => group.id === "epics")?.rows ?? [];
  expect(rows).toEqual([
    {
      label: "Ship a local kanban",
      key: "DEMO-1",
      starred: true,
      jump: { kind: "epic", key: "DEMO-1" },
    },
  ]);
  expect(commandPick(rows[0]!)).toEqual({ kind: "epic", key: "DEMO-1" });
});

test("pick yields card and epic intents", () => {
  const groups = commandCatalog({
    presets: [],
    query: "demo",
    epics: [listedEpic],
    cards: [child],
  });
  const epic = groups.find((group) => group.id === "epics")?.rows[0];
  const card = groups.find((group) => group.id === "cards")?.rows[0];
  expect(epic && commandPick(epic)).toEqual({ kind: "epic", key: "DEMO-1" });
  expect(card && commandPick(card)).toEqual({ kind: "card", key: "DEMO-2", epic: "DEMO-1" });
});

test("a Card without a parent Epic picks without an epic", () => {
  const orphan = { key: "DEMO-7", summary: "Loose story" };
  const row = commandCatalog({
    presets: [],
    query: "loose",
    cards: [orphan],
  }).find((group) => group.id === "cards")?.rows[0];
  expect(row && commandPick(row)).toEqual({ kind: "card", key: "DEMO-7" });
});

test("a miss is an empty list with no Issue rows", () => {
  expect(
    commandCatalog({
      presets: [],
      query: "DEMO-404",
      epics: [listedEpic],
      cards: [child],
      favouriteKeys: ["DEMO-1"],
    }),
  ).toEqual([]);
});
