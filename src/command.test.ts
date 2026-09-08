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
