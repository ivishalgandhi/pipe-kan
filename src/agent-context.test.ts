import { expect, test } from "vitest";

import { boardViewContext, pipedBoardContext, withPipedBoardContext } from "./agent-context.ts";

test("boardViewContext puts visible Jira cards in prompt text", () => {
  const blocks = boardViewContext({
    kind: "epics",
    selectedEpic: null,
    search: "",
    filter: {},
    sort: "payload",
    hide: ["Cancelled"],
    columns: [
      {
        title: "To Do",
        cards: [{ key: "DEMO-100", summary: "Ship agent panel", assignee: "Ada", priority: "High" }],
      },
    ],
    epics: [{ key: "DEMO-100", summary: "Ship agent panel", status: "To Do" }],
  });

  const text = blocks.find((block) => block.type === "text");
  expect(text?.type).toBe("text");
  if (text?.type !== "text") return;
  expect(text.text).toContain("DEMO-100");
  expect(text.text).toContain("Ship agent panel");
  expect(text.text).toContain("To Do");
  expect(text.text).toMatch(/Jira/i);

  const resource = blocks.find((block) => block.type === "resource");
  expect(resource?.type).toBe("resource");
  if (resource?.type !== "resource") return;
  expect(resource.resource.uri).toBe("pipe-kan://board");
  expect(JSON.parse(resource.resource.text)).toEqual(
    expect.objectContaining({
      kind: "epics",
      columns: [
        expect.objectContaining({
          title: "To Do",
          cards: [expect.objectContaining({ key: "DEMO-100", summary: "Ship agent panel" })],
        }),
      ],
    }),
  );
});

test("pipedBoardContext uses the full unfiltered Jira pipe, not GitHub", () => {
  const blocks = pipedBoardContext({
    columns: [
      {
        title: "To Do",
        cards: [{ key: "PIPE-1", summary: "Piped story" }],
      },
      {
        title: "Done",
        cards: [{ key: "PIPE-2", summary: "Finished story" }],
      },
    ],
    epics: [{ key: "PIPE-100", summary: "Piped epic", status: "To Do" }],
  });

  const text = blocks.find((block) => block.type === "text");
  expect(text?.type).toBe("text");
  if (text?.type !== "text") return;
  expect(text.text).toContain("PIPE-1");
  expect(text.text).toContain("PIPE-2");
  expect(text.text).toContain("PIPE-100");
  expect(text.text).toMatch(/piped/i);
  expect(text.text).toMatch(/Jira/i);
  expect(text.text).toMatch(/not GitHub/i);
  expect(text.text).toMatch(/not the local source/i);

  const resource = blocks.find((block) => block.type === "resource");
  expect(resource?.type).toBe("resource");
  if (resource?.type !== "resource") return;
  expect(resource.resource.uri).toBe("pipe-kan://board");
});

test("withPipedBoardContext keeps an attached board view instead of the full pipe", () => {
  const pipe = {
    columns: [{ title: "To Do", cards: [{ key: "PIPE-1", summary: "Hidden by view" }] }],
    epics: [],
  };
  const attached = boardViewContext({
    kind: "stories",
    selectedEpic: null,
    search: "",
    filter: {},
    sort: "payload",
    hide: [],
    columns: [{ title: "To Do", cards: [{ key: "VIEW-1", summary: "Visible card" }] }],
    epics: [],
  });

  const limited = withPipedBoardContext(pipe, attached);
  const text = limited.filter((block) => block.type === "text").map((block) => block.type === "text" ? block.text : "").join("\n");
  expect(text).toContain("VIEW-1");
  expect(text).not.toContain("PIPE-1");

  const fallback = withPipedBoardContext(pipe, []);
  const fallbackText = fallback.filter((block) => block.type === "text").map((block) => block.type === "text" ? block.text : "").join("\n");
  expect(fallbackText).toContain("PIPE-1");
});
