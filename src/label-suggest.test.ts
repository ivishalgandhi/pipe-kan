import { expect, test } from "vitest";

import { suggestLabels, uniqueLabels } from "./label-suggest.ts";

test("uniqueLabels keeps first-seen order and dedupes case-insensitively", () => {
  expect(
    uniqueLabels([
      { labels: ["kanban", "parser"] },
      { labels: ["Kanban", "write-back"] },
      undefined,
      { labels: [""] },
    ]),
  ).toEqual(["kanban", "parser", "write-back"]);
});

test.each([
  {
    name: "substring match",
    text: "kanban board",
    labels: ["parser", "kanban", "write-back"],
    selected: undefined,
    expected: ["kanban"],
  },
  {
    name: "case-insensitive",
    text: "KANBAN",
    labels: ["kanban"],
    selected: undefined,
    expected: ["kanban"],
  },
  {
    name: "hyphen token write hits write-back",
    text: "write the move",
    labels: ["write-back"],
    selected: undefined,
    expected: ["write-back"],
  },
  {
    name: "selected excluded",
    text: "kanban board",
    labels: ["parser", "kanban", "write-back"],
    selected: ["kanban"],
    expected: [],
  },
  {
    name: "empty text",
    text: "   ",
    labels: ["kanban"],
    selected: undefined,
    expected: [],
  },
  {
    name: "one-char tokens do not match",
    text: "a",
    labels: ["kanban"],
    selected: undefined,
    expected: [],
  },
  {
    name: "stable catalog order not relevance",
    text: "kanban parser",
    labels: ["parser", "kanban"],
    selected: undefined,
    expected: ["parser", "kanban"],
  },
])("suggestLabels $name", ({ text, labels, selected, expected }) => {
  expect(suggestLabels({ text, labels, selected })).toEqual(expected);
});

test("suggestLabels caps at 5 and preserves catalog order", () => {
  const labels = ["a1", "a2", "a3", "a4", "a5", "a6", "a7"];
  expect(suggestLabels({ text: "a1 a2 a3 a4 a5 a6 a7", labels })).toEqual([
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
  ]);
});
