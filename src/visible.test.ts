import { expect, test } from "vitest";

import type { Card, Epic } from "./board.ts";
import {
  addFolder,
  addPreset,
  applyPreset,
  overwritePreset,
  removePreset,
  renamePreset,
  epicChildCount,
  favouriteGroup,
  filterEpics,
  filterFacets,
  filterValue,
  groupEpics,
  mergeSearchHits,
  listedFavourites,
  mergeValue,
  moveFavourite,
  priorityRank,
  removeFolder,
  renameFolder,
  rollbackColumns,
  stampEpic,
  toggleFavourite,
} from "./visible.ts";

const child: Card = { key: "DEMO-2", summary: "child", epic: "DEMO-1" };
const other: Card = { key: "DEMO-9", summary: "other", epic: "DEMO-8" };

test("rollback under an Epic keeps hidden Cards", () => {
  const current = {
    "To Do": [child, other],
    "In Progress": [],
  };
  const previousVisible = {
    "To Do": [child],
    "In Progress": [],
  };
  expect(rollbackColumns(previousVisible, current, "DEMO-1")).toEqual({
    "To Do": [other, child],
    "In Progress": [],
  });
});

test("rollback with no Epic restores the previous Board", () => {
  const previous = { "To Do": [child], "In Progress": [other] };
  expect(rollbackColumns(previous, { "To Do": [child, other], "In Progress": [] }, null)).toEqual(
    previous,
  );
});

test("merge under an Epic keeps hidden Cards", () => {
  expect(
    mergeValue(
      { "To Do": [], "In Progress": [child] },
      { "To Do": [child, other], "In Progress": [] },
      "DEMO-1",
    ),
  ).toEqual({
    "To Do": [other],
    "In Progress": [child],
  });
});

test("stamp Epic links children that jira-cli --raw dropped", () => {
  const orphan: Card = { key: "SQLJIRA-2", summary: "Work story" };
  expect(
    stampEpic(
      { Proposed: [orphan] },
      { Proposed: [{ key: "SQLJIRA-2", summary: "Work story" }] },
      "SQLJIRA-1",
    ),
  ).toEqual({
    Proposed: [{ key: "SQLJIRA-2", summary: "Work story", epic: "SQLJIRA-1" }],
  });
});

test("stamp Epic adds a child that was missing from Scope", () => {
  expect(
    stampEpic(
      { Proposed: [] },
      { "In Development": [{ key: "SQLJIRA-9", summary: "New" }] },
      "SQLJIRA-1",
    ),
  ).toEqual({
    Proposed: [],
    "In Development": [
      { key: "SQLJIRA-9", summary: "New", epic: "SQLJIRA-1" },
    ],
  });
});

const labeled: Card = {
  key: "DEMO-3",
  summary: "Drag a Card to Move",
  epic: "DEMO-1",
  labels: ["kanban"],
};
const epic: Epic = { key: "DEMO-1", summary: "Ship a local kanban" };
const otherEpic: Epic = { key: "DEMO-9", summary: "Other" };

test("Search hides Cards that do not match", () => {
  expect(
    filterValue(
      { "To Do": [child], "In Progress": [labeled] },
      null,
      "kanban",
    ),
  ).toEqual({ "In Progress": [labeled] });
});

test("Search adds a matching story that Scope missed", () => {
  const cached = { key: "DEMO-20", summary: "Work story", epic: "DEMO-1" };
  expect(
    mergeSearchHits(
      { "To Do": [child] },
      { "In Progress": [cached, labeled] },
      "work",
    ),
  ).toEqual({
    "To Do": [child],
    "In Progress": [cached],
  });
  expect(mergeSearchHits({ "To Do": [child] }, { "In Progress": [cached] }, "")).toEqual({
    "To Do": [child],
  });
});

test("Search under an Epic keeps only matching children", () => {
  expect(
    filterValue(
      { "To Do": [child, other], "In Progress": [labeled] },
      "DEMO-1",
      "drag",
    ),
  ).toEqual({ "In Progress": [labeled] });
});

test("merge under Search keeps hidden Cards", () => {
  expect(
    mergeValue(
      { "In Progress": [labeled] },
      { "To Do": [child], "In Progress": [labeled] },
      null,
      "kanban",
    ),
  ).toEqual({
    "To Do": [child],
    "In Progress": [labeled],
  });
});

test("Search keeps an Epic that matches or has a matching Card", () => {
  expect(filterEpics([epic, otherEpic], [child, labeled], "kanban")).toEqual([
    epic,
  ]);
  expect(filterEpics([epic, otherEpic], [child, labeled], "other")).toEqual([
    otherEpic,
  ]);
  expect(filterEpics([epic, otherEpic], [child, labeled], "")).toEqual([
    epic,
    otherEpic,
  ]);
});

test("Search keeps an Epic whose labels match", () => {
  const labeledEpic: Epic = { key: "DEMO-1", summary: "Ship", labels: ["kanban"] };
  expect(filterEpics([labeledEpic, otherEpic], [child], "kanban")).toEqual([labeledEpic]);
});

test("Filter keeps an Epic whose own labels match", () => {
  const labeledEpic: Epic = { key: "DEMO-1", summary: "Ship", labels: ["kanban"] };
  const otherChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(
    filterEpics([labeledEpic, otherEpic], [child, otherChild], "", { labels: ["kanban"] }),
  ).toEqual([labeledEpic]);
});

test("Filter keeps an Epic when a remaining child matches", () => {
  const parent: Epic = { key: "DEMO-1", summary: "Ship" };
  const otherChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(filterEpics([parent, otherEpic], [labeled, otherChild], "", { labels: ["kanban"] })).toEqual([
    parent,
  ]);
});

test("Filter hides an Epic when neither self nor child matches", () => {
  const parent: Epic = { key: "DEMO-1", summary: "Ship" };
  const otherChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(
    filterEpics([parent, otherEpic], [child, otherChild], "", { labels: ["kanban"] }),
  ).toEqual([]);
});

test("Filter keeps an Epic with no children", () => {
  const bare: Epic = { key: "DEMO-8", summary: "Bare" };
  expect(filterEpics([bare], [], "", { labels: ["kanban"] })).toEqual([bare]);
});

test("Filter keeps an Epic whose own priority or assignee matches", () => {
  const highEpic: Epic = { key: "DEMO-1", summary: "Ship", priority: "High" };
  const assignedEpic: Epic = { key: "DEMO-9", summary: "Other", assignee: "Pat" };
  const highChild: Card = { key: "DEMO-2", summary: "low", epic: "DEMO-1", priority: "Low" };
  const patChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9", assignee: "Ada" };
  expect(filterEpics([highEpic, assignedEpic], [highChild, patChild], "", { priority: ["High"] })).toEqual([
    highEpic,
  ]);
  expect(filterEpics([highEpic, assignedEpic], [highChild, patChild], "", { assignee: ["Pat"] })).toEqual([
    assignedEpic,
  ]);
});

test("epicAssignee Filter hides an Epic that misses and has no remaining child", () => {
  const patEpic: Epic = { key: "DEMO-1", summary: "Ship", assignee: "Pat" };
  const adaEpic: Epic = { key: "DEMO-9", summary: "Other", assignee: "Ada" };
  const patChild: Card = { key: "DEMO-2", summary: "child", epic: "DEMO-1" };
  const adaChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(
    filterEpics([patEpic, adaEpic], [patChild, adaChild], "", { epicAssignee: ["Pat"] }),
  ).toEqual([patEpic]);
});

test("Epic row count is remaining children after Search and Filter", () => {
  const kids: Card[] = [
    { key: "DEMO-2", summary: "parse", epic: "DEMO-1", labels: ["kanban"] },
    { key: "DEMO-3", summary: "drag", epic: "DEMO-1", labels: ["scope"] },
    { key: "DEMO-4", summary: "other", epic: "DEMO-8" },
  ];
  expect(epicChildCount(kids, "DEMO-1")).toBe(2);
  expect(epicChildCount(kids, "DEMO-1", "parse")).toBe(1);
  expect(epicChildCount(kids, "DEMO-1", "", { labels: ["kanban"] })).toBe(1);
});

test("left pane keeps In Progress, Completed, and Cancelled Epics", () => {
  const open: Epic = { key: "DEMO-1", summary: "Open", status: "To Do" };
  const progress: Epic = { key: "DEMO-8", summary: "Busy", status: "In Progress" };
  const done: Epic = { key: "DEMO-9", summary: "Finished", status: "Completed" };
  const cancelled: Epic = { key: "DEMO-10", summary: "Dropped", status: "Cancelled" };
  const unknown: Epic = { key: "DEMO-11", summary: "Parent only" };
  expect(filterEpics([open, progress, done, cancelled, unknown], [], "")).toEqual([
    open,
    progress,
    done,
    cancelled,
    unknown,
  ]);
});

test("Epics group by first-seen status", () => {
  const open: Epic = { key: "DEMO-1", summary: "Open", status: "To Do" };
  const progress: Epic = { key: "DEMO-8", summary: "Busy", status: "In Progress" };
  const done: Epic = { key: "DEMO-9", summary: "Finished", status: "Completed" };
  const alsoOpen: Epic = { key: "DEMO-12", summary: "More", status: "To Do" };
  const unknown: Epic = { key: "DEMO-11", summary: "Parent only" };
  expect(groupEpics([open, progress, done, alsoOpen, unknown])).toEqual([
    { status: "To Do", epics: [open, alsoOpen] },
    { status: "In Progress", epics: [progress] },
    { status: "Completed", epics: [done] },
    { status: "", epics: [unknown] },
  ]);
});

const high: Card = {
  key: "DEMO-2",
  summary: "high work",
  epic: "DEMO-1",
  priority: "High",
  assignee: "Person A",
  created: "2026-08-01T00:00:00.000Z",
  dueDate: "Sep 20, 2026",
};
const medium: Card = {
  key: "DEMO-3",
  summary: "medium work",
  epic: "DEMO-1",
  priority: "P3",
  created: "2026-07-01T00:00:00.000Z",
  dueDate: "Sep 10, 2026",
};
const critical: Card = {
  key: "DEMO-4",
  summary: "critical work",
  priority: "Critical",
  assignee: "Person B",
  created: "2026-09-01T00:00:00.000Z",
};
const columns = {
  "To Do": [high, medium],
  "In Progress": [critical],
};

test("Filter by priority keeps matching Cards", () => {
  expect(
    filterValue(columns, null, "", { filter: { priority: ["High", "Critical"] } }),
  ).toEqual({
    "To Do": [high],
    "In Progress": [critical],
  });
});

test("Filter Unassigned keeps Cards with no person", () => {
  expect(
    filterValue(columns, null, "", { filter: { assignee: ["Unassigned"] } }),
  ).toEqual({ "To Do": [medium] });
});

test("Filter ANDs with Search and the selected Epic", () => {
  expect(
    filterValue(columns, "DEMO-1", "high", { filter: { priority: ["High"] } }),
  ).toEqual({ "To Do": [high] });
});

test("Filter omits a Column with no remaining Cards", () => {
  expect(
    filterValue(columns, null, "", { filter: { assignee: ["Person B"] } }),
  ).toEqual({ "In Progress": [critical] });
});

test("Filter facets come from Card values", () => {
  expect(filterFacets([
    { key: "A", summary: "a", priority: "P1", assignee: "Ada" },
    { key: "B", summary: "b", priority: "P4" },
    { key: "C", summary: "c", priority: "P2", assignee: "Ada" },
    { key: "D", summary: "d", priority: "P3" },
  ])).toEqual([
    { key: "priority", label: "Priority", group: "Priority", values: ["P1", "P2", "P3", "P4"] },
    { key: "assignee", label: "Stories", group: "Assignee", values: ["Ada", "Unassigned"] },
  ]);
  expect(filterFacets([
    { key: "T1", summary: "t", priority: "H" },
    { key: "T2", summary: "t", priority: "L" },
    { key: "T3", summary: "t", priority: "M" },
  ])).toEqual([
    { key: "priority", label: "Priority", group: "Priority", values: ["H", "M", "L"] },
  ]);
});

test("Filter facets include Labels and Epic assignee", () => {
  expect(filterFacets(
    [
      { key: "A", summary: "a", epic: "E1", labels: ["kanban", "scope"], assignee: "Ada" },
      { key: "B", summary: "b", epic: "E2", labels: ["scope"] },
    ],
    [
      { key: "E1", summary: "One", assignee: "Pat" },
      { key: "E2", summary: "Two" },
    ],
  )).toEqual([
    {
      key: "epicAssignee",
      label: "Epic",
      group: "Assignee",
      values: ["Pat", "Unassigned"],
    },
    { key: "assignee", label: "Stories", group: "Assignee", values: ["Ada", "Pat", "Unassigned"] },
    { key: "labels", label: "Labels", group: "Labels", values: ["kanban", "scope"] },
  ]);
});

test("Filter facets union Card values with listed Epic values", () => {
  expect(
    filterFacets(
      [{ key: "A", summary: "a", priority: "Low", assignee: "Ada", labels: ["scope"] }],
      [
        { key: "E1", summary: "One", priority: "High", assignee: "Pat", labels: ["kanban"] },
        { key: "E2", summary: "Two" },
      ],
    ),
  ).toEqual([
    { key: "priority", label: "Priority", group: "Priority", values: ["High", "Low"] },
    { key: "assignee", label: "Stories", group: "Assignee", values: ["Ada", "Pat", "Unassigned"] },
    { key: "labels", label: "Labels", group: "Labels", values: ["kanban", "scope"] },
  ]);
});

test("Filter by labels keeps Cards with any selected label", () => {
  const tagged: Card = { key: "A", summary: "a", labels: ["kanban"] };
  const both: Card = { key: "B", summary: "b", labels: ["scope", "error"] };
  const plain: Card = { key: "C", summary: "c" };
  expect(
    filterValue({ "To Do": [tagged, both, plain] }, null, "", {
      filter: { labels: ["scope", "kanban"] },
    }),
  ).toEqual({ "To Do": [tagged, both] });
});

test("Filter by Epic assignee keeps children of those Epics", () => {
  const patChild: Card = { key: "A", summary: "a", epic: "E1" };
  const adaChild: Card = { key: "B", summary: "b", epic: "E2" };
  expect(
    filterValue({ "To Do": [patChild, adaChild] }, null, "", {
      filter: { epicAssignee: ["Pat"] },
      epics: [
        { key: "E1", summary: "One", assignee: "Pat" },
        { key: "E2", summary: "Two", assignee: "Ada" },
      ],
    }),
  ).toEqual({ "To Do": [patChild] });
});

test("Filter Unassigned Epic assignee keeps Cards whose Epic has no person", () => {
  const assigned: Card = { key: "A", summary: "a", epic: "E1" };
  const bareEpic: Card = { key: "B", summary: "b", epic: "E2" };
  const orphan: Card = { key: "C", summary: "c" };
  expect(
    filterValue({ "To Do": [assigned, bareEpic, orphan] }, null, "", {
      filter: { epicAssignee: ["Unassigned"] },
      epics: [
        { key: "E1", summary: "One", assignee: "Pat" },
        { key: "E2", summary: "Two" },
      ],
    }),
  ).toEqual({ "To Do": [bareEpic, orphan] });
});

test("Filter keeps Jira P-numbers and Taskwarrior names", () => {
  const p2: Card = { key: "J-2", summary: "p2", priority: "P2" };
  const p4: Card = { key: "J-4", summary: "p4", priority: "P4" };
  const high: Card = { key: "T-H", summary: "hi", priority: "high" };
  expect(
    filterValue({ "To Do": [p2, p4, high] }, null, "", { filter: { priority: ["P2", "high"] } }),
  ).toEqual({ "To Do": [p2, high] });
});

test("priority rank is P-numbers then named scales, missing last", () => {
  expect(["P4", "P1", "P3", "P2"].sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b))).toEqual([
    "P1",
    "P2",
    "P3",
    "P4",
  ]);
  expect(["low", "H", "medium"].sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b))).toEqual([
    "H",
    "medium",
    "low",
  ]);
  expect(priorityRank(undefined)).toBeGreaterThan(priorityRank("P4"));
});

test("Sort by priority uses the shared rank and missing last", () => {
  const missing: Card = { key: "DEMO-9", summary: "none" };
  const low: Card = { key: "DEMO-8", summary: "low", priority: "Low" };
  expect(
    filterValue(
      { "To Do": [medium, missing, critical, low, high] },
      null,
      "",
      { sort: "priority" },
    )["To Do"]?.map((card) => card.key),
  ).toEqual(["DEMO-4", "DEMO-2", "DEMO-3", "DEMO-8", "DEMO-9"]);
});

test("Sort by age is oldest first and due is soonest first", () => {
  expect(
    filterValue(columns, null, "", { sort: "age" })["To Do"]?.map((card) => card.key),
  ).toEqual(["DEMO-3", "DEMO-2"]);
  expect(
    filterValue(columns, null, "", { sort: "due" })["To Do"]?.map((card) => card.key),
  ).toEqual(["DEMO-3", "DEMO-2"]);
});

test("Sort by key is A-Z and missing Sort field is last", () => {
  expect(
    filterValue(columns, null, "", { sort: "key" })["To Do"]?.map((card) => card.key),
  ).toEqual(["DEMO-2", "DEMO-3"]);
  expect(
    filterValue(
      { "To Do": [high, critical] },
      null,
      "",
      { sort: "due" },
    )["To Do"]?.map((card) => card.key),
  ).toEqual(["DEMO-2", "DEMO-4"]);
});

test("Hide omits a Column while Cards remain in the input", () => {
  const input = { "To Do": [high], "In Progress": [critical] };
  expect(filterValue(input, null, "", { hide: ["In Progress"] })).toEqual({
    "To Do": [high],
  });
  expect(input["In Progress"]).toEqual([critical]);
});

test("a Hidden Column is not a drop target", () => {
  expect(
    Object.keys(filterValue(columns, null, "", { hide: ["To Do"] })),
  ).toEqual(["In Progress"]);
});

test("merge under Filter keeps hidden Cards", () => {
  expect(
    mergeValue(
      { "In Progress": [critical] },
      columns,
      null,
      "",
      { filter: { assignee: ["Person B"] } },
    ),
  ).toEqual(columns);
});

test("merge under Hide keeps the Hidden Column", () => {
  expect(
    mergeValue(
      { "To Do": [high, medium] },
      columns,
      null,
      "",
      { hide: ["In Progress"] },
    ),
  ).toEqual(columns);
});

test("Favourites order by priority rank then Issue key", () => {
  const p1: Epic = { key: "DEMO-8", summary: "Later", priority: "Highest" };
  const p1b: Epic = { key: "DEMO-2", summary: "First", priority: "P1" };
  const p3: Epic = { key: "DEMO-3", summary: "Mid", priority: "Medium" };
  const none: Epic = { key: "DEMO-9", summary: "None" };
  expect(
    favouriteGroup([p3, none, p1, p1b], ["DEMO-9", "DEMO-3", "DEMO-8", "DEMO-2"]).map(
      (epic) => epic.key,
    ),
  ).toEqual(["DEMO-2", "DEMO-8", "DEMO-3", "DEMO-9"]);
});

test("Favourites hide when empty and ignore stale keys", () => {
  const listed: Epic = { key: "DEMO-1", summary: "Ship", priority: "High" };
  expect(favouriteGroup([listed], [])).toEqual([]);
  expect(favouriteGroup([listed], ["DEMO-1", "DEMO-99"])).toEqual([listed]);
});

test("Search omits a Favourite that does not match", () => {
  const listed: Epic = { key: "DEMO-1", summary: "Ship a local kanban" };
  const otherFav: Epic = { key: "DEMO-9", summary: "Other" };
  expect(favouriteGroup([listed, otherFav], ["DEMO-1", "DEMO-9"], "ship")).toEqual([
    listed,
  ]);
});

test("Search keeps a Favourite that has a matching Card", () => {
  const listed: Epic = { key: "DEMO-1", summary: "Ship a local kanban" };
  const child: Card = { key: "DEMO-2", summary: "Parse jira-cli", epic: "DEMO-1" };
  expect(favouriteGroup([listed], ["DEMO-1"], "parse", [child])).toEqual([listed]);
});

test("Folders keep one home and unfile on delete", () => {
  let state = { keys: ["DEMO-1", "DEMO-2"], folders: [] as { name: string; keys: string[] }[] };
  const created = addFolder(state, "Now");
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  state = moveFavourite(created.state, "DEMO-1", "Now");
  expect(listedFavourites(
    [
      { key: "DEMO-1", summary: "Ship", priority: "High" },
      { key: "DEMO-2", summary: "Parse", priority: "Medium" },
    ],
    state,
  )).toEqual({
    unfiled: [{ key: "DEMO-2", summary: "Parse", priority: "Medium" }],
    folders: [
      {
        name: "Now",
        epics: [{ key: "DEMO-1", summary: "Ship", priority: "High" }],
      },
    ],
  });
  state = removeFolder(state, "Now");
  expect(state.folders).toEqual([]);
  expect(state.keys).toEqual(["DEMO-1", "DEMO-2"]);
});

test("Folder name collision is rejected and Search omits a miss", () => {
  const created = addFolder({ keys: ["DEMO-1"], folders: [] }, "Now");
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  expect(addFolder(created.state, "now").ok).toBe(false);
  expect(renameFolder(created.state, "Now", "NOW").ok).toBe(false);
  const empty = addFolder(created.state, "Later");
  expect(empty.ok).toBe(true);
  if (!empty.ok) return;
  const epics: Epic[] = [{ key: "DEMO-1", summary: "Ship" }];
  expect(listedFavourites(epics, empty.state, "later")).toEqual({
    unfiled: [],
    folders: [{ name: "Later", epics: [] }],
  });
  expect(listedFavourites(epics, empty.state, "missing")).toEqual({
    unfiled: [],
    folders: [],
  });
});

test("unfiled Favourites paint before Folders", () => {
  const created = addFolder({ keys: ["DEMO-2", "DEMO-1"], folders: [] }, "Alpha");
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const state = moveFavourite(created.state, "DEMO-1", "Alpha");
  expect(
    listedFavourites(
      [
        { key: "DEMO-1", summary: "Ship", priority: "High" },
        { key: "DEMO-2", summary: "Parse", priority: "Low" },
      ],
      state,
    ).unfiled.map((epic) => epic.key),
  ).toEqual(["DEMO-2"]);
  expect(
    listedFavourites(
      [
        { key: "DEMO-1", summary: "Ship", priority: "High" },
        { key: "DEMO-2", summary: "Parse", priority: "Low" },
      ],
      state,
    ).folders.map((folder) => folder.name),
  ).toEqual(["Alpha"]);
});

test("toggleFavourite does not invent a Folder home", () => {
  expect(toggleFavourite({ keys: [], folders: [] }, "DEMO-1")).toEqual({
    keys: ["DEMO-1"],
    folders: [],
  });
  expect(
    toggleFavourite({ keys: ["DEMO-1"], folders: [{ name: "Now", keys: ["DEMO-1"] }] }, "DEMO-1"),
  ).toEqual({ keys: [], folders: [{ name: "Now", keys: [] }] });
});

test("Favourites hide under the same Filter as status-group Epics", () => {
  const labeledEpic: Epic = { key: "DEMO-1", summary: "Ship", labels: ["kanban"] };
  const otherFav: Epic = { key: "DEMO-9", summary: "Other" };
  const otherChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(
    favouriteGroup(
      [labeledEpic, otherFav],
      ["DEMO-1", "DEMO-9"],
      "",
      [child, otherChild],
      { labels: ["kanban"] },
    ),
  ).toEqual([labeledEpic]);
});

test("an empty Folder stays after Filter hides its Favourites", () => {
  const created = addFolder({ keys: ["DEMO-9"], folders: [] }, "Later");
  expect(created.ok).toBe(true);
  if (!created.ok) return;
  const state = moveFavourite(created.state, "DEMO-9", "Later");
  const otherChild: Card = { key: "DEMO-10", summary: "plain", epic: "DEMO-9" };
  expect(
    listedFavourites(
      [{ key: "DEMO-9", summary: "Other" }],
      state,
      "",
      [otherChild],
      { labels: ["kanban"] },
    ),
  ).toEqual({
    unfiled: [],
    folders: [{ name: "Later", epics: [] }],
  });
});

const nowChrome = {
  filter: { priority: ["High"] },
  sort: "priority" as const,
  hide: ["Done"],
};

test("Save appends a Preset and Apply returns that chrome", () => {
  const saved = addPreset([], "Now", nowChrome);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(saved.presets.map((preset) => preset.name)).toEqual(["Now"]);
  expect(applyPreset(saved.presets, "Now")).toEqual({ ok: true, chrome: nowChrome });
});

test("empty or clashing Preset names fail", () => {
  expect(addPreset([], "   ", nowChrome).ok).toBe(false);
  const saved = addPreset([], "Now", nowChrome);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(addPreset(saved.presets, "now", nowChrome).ok).toBe(false);
  expect(applyPreset(saved.presets, "Later").ok).toBe(false);
});

test("two Preset names may hold the same chrome", () => {
  const first = addPreset([], "Now", nowChrome);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const second = addPreset(first.presets, "Later", nowChrome);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(second.presets.map((preset) => preset.name)).toEqual(["Now", "Later"]);
  expect(applyPreset(second.presets, "Later")).toEqual({ ok: true, chrome: nowChrome });
});

const laterChrome = {
  filter: { assignee: ["Ada"] },
  sort: "age" as const,
  hide: [],
};

test("Save over replaces Preset chrome and keeps the name", () => {
  const saved = addPreset([], "Now", nowChrome);
  expect(saved.ok).toBe(true);
  if (!saved.ok) return;
  expect(overwritePreset([], "Now", laterChrome).ok).toBe(false);
  const over = overwritePreset(saved.presets, "Now", laterChrome);
  expect(over.ok).toBe(true);
  if (!over.ok) return;
  expect(over.presets.map((preset) => preset.name)).toEqual(["Now"]);
  expect(applyPreset(over.presets, "Now")).toEqual({ ok: true, chrome: laterChrome });
});

test("Rename Preset uses the same uniqueness rule as Save", () => {
  const first = addPreset([], "Now", nowChrome);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const second = addPreset(first.presets, "Later", laterChrome);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  expect(renamePreset(second.presets, "Later", "   ").ok).toBe(false);
  expect(renamePreset(second.presets, "Later", "now").ok).toBe(false);
  expect(renamePreset(second.presets, "Later", "Later").ok).toBe(false);
  const renamed = renamePreset(second.presets, "Later", "Soon");
  expect(renamed.ok).toBe(true);
  if (!renamed.ok) return;
  expect(renamed.presets.map((preset) => preset.name)).toEqual(["Now", "Soon"]);
  expect(applyPreset(renamed.presets, "Soon")).toEqual({ ok: true, chrome: laterChrome });
});

test("Delete drops a Preset and leaves the others", () => {
  const first = addPreset([], "Now", nowChrome);
  expect(first.ok).toBe(true);
  if (!first.ok) return;
  const second = addPreset(first.presets, "Later", laterChrome);
  expect(second.ok).toBe(true);
  if (!second.ok) return;
  const remaining = removePreset(second.presets, "Later");
  expect(remaining.map((preset) => preset.name)).toEqual(["Now"]);
  expect(applyPreset(remaining, "Now")).toEqual({ ok: true, chrome: nowChrome });
});
