import { expect, test } from "vitest";

import {
  acceptSuggestion,
  composerSuggestions,
  createAiSeed,
  dismissSuggestion,
  draftFromOpen,
  emptyCreateDraft,
  mergeOpenIntoDraft,
  removeLabel,
  type IssueComposerDraft,
} from "./issue-composer.ts";

function draft(overrides: Partial<IssueComposerDraft> = {}): IssueComposerDraft {
  return {
    mode: "create",
    title: "Ship a kanban view",
    description: "",
    labels: [],
    dismissed: [],
    ...overrides,
  };
}

test("composerSuggestions match title and description then drop dismissed", () => {
  const catalog = ["parser", "kanban", "write-back"];
  expect(composerSuggestions(draft(), catalog)).toEqual(["kanban"]);
  expect(composerSuggestions(draft({ dismissed: ["kanban"] }), catalog)).toEqual([]);
});

test("acceptSuggestion appends and is a no-op when already selected", () => {
  const once = acceptSuggestion(draft(), "kanban");
  expect(once.labels).toEqual(["kanban"]);
  expect(acceptSuggestion(once, "Kanban").labels).toEqual(["kanban"]);
});

test("dismissSuggestion hides a chip until the draft is new", () => {
  const dismissed = dismissSuggestion(draft(), "kanban");
  expect(composerSuggestions(dismissed, ["kanban"])).toEqual([]);
  expect(composerSuggestions(draft(), ["kanban"])).toEqual(["kanban"]);
});

test("removeLabel drops a selected label and does not un-dismiss", () => {
  const next = removeLabel(
    dismissSuggestion(acceptSuggestion(draft(), "kanban"), "kanban"),
    "kanban",
  );
  expect(next.labels).toEqual([]);
  expect(next.dismissed).toEqual(["kanban"]);
  expect(composerSuggestions(next, ["kanban"])).toEqual([]);
});

test("emptyCreateDraft starts create mode with optional column and Epic", () => {
  expect(emptyCreateDraft({ status: "To Do", epic: "DEMO-1" })).toEqual({
    mode: "create",
    title: "",
    description: "",
    labels: [],
    dismissed: [],
    status: "To Do",
    epic: "DEMO-1",
  });
});

test("draftFromOpen prefills edit fields from Open fields", () => {
  expect(
    draftFromOpen(
      "DEMO-2",
      [
        { label: "Summary", value: "Parse jira-cli" },
        { label: "Description", value: "Body" },
        { label: "Labels", value: "parser, kanban", pills: ["parser", "kanban"] },
      ],
      { status: "To Do", epic: "DEMO-1" },
    ),
  ).toEqual({
    mode: "edit",
    key: "DEMO-2",
    title: "Parse jira-cli",
    description: "Body",
    labels: ["parser", "kanban"],
    dismissed: [],
    status: "To Do",
    epic: "DEMO-1",
  });
});

test("mergeOpenIntoDraft fills empty description without clobbering typed title", () => {
  const current = draft({
    mode: "edit",
    key: "DEMO-2",
    title: "Typed title",
    description: "",
    labels: [],
  });
  expect(
    mergeOpenIntoDraft(current, [
      { label: "Summary", value: "Parse jira-cli" },
      { label: "Description", value: "From Jira" },
      { label: "Labels", value: "parser", pills: ["parser"] },
    ]),
  ).toEqual({
    mode: "edit",
    key: "DEMO-2",
    title: "Typed title",
    description: "From Jira",
    labels: ["parser"],
    dismissed: [],
  });
});

test("createAiSeed asks the Agent to call create_issue and includes a working draft", () => {
  const seed = createAiSeed(
    draft({ title: "Ship labels", description: "Chips", status: "To Do", epic: "DEMO-1" }),
  );
  expect(seed).toContain("create_issue");
  expect(seed).toContain("Working title: Ship labels");
  expect(seed).toContain("Create it in status To Do.");
  expect(seed).toContain("Parent Epic: DEMO-1");
});
