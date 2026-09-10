import { expect, test } from "vitest";

import { commandCatalog, commandPick, type CommandJump } from "./command.ts";
import {
  acceptSuggestion,
  buildCreatePayload,
  buildEditPayload,
  canSubmitComposer,
  commandComposerAction,
  composerHotkey,
  composerSuggestions,
  createAiSeed,
  discardComposer,
  dismissSuggestion,
  openCreateAiFromCommand,
  openCreateFromColumn,
  openCreateFromCommand,
  openEditFromCard,
} from "./issue-composer.ts";

const catalog = ["parser", "kanban", "write-back"];

test("column + opens create composer with that Column status", () => {
  expect(openCreateFromColumn("In Progress")).toMatchObject({
    mode: "create",
    title: "",
    status: "In Progress",
  });
});

test("Cmd+K Create issue opens create composer", () => {
  const jump = commandPick(
    commandCatalog({ presets: [], query: "create" })[0]!.rows.find((row) => row.jump.kind === "create")!,
  );
  expect(commandComposerAction(jump)).toBe("create");
  expect(openCreateFromCommand()).toMatchObject({ mode: "create", title: "" });
});

test("Cmd+K Create with AI seeds Agent", () => {
  const jump = commandPick(
    commandCatalog({ presets: [], query: "ai" })[0]!.rows[0]!,
  );
  expect(commandComposerAction(jump)).toBe("create-ai");
  const { draft, seed } = openCreateAiFromCommand({ status: "To Do", selectedEpic: "DEMO-1" });
  expect(draft).toMatchObject({ mode: "create", status: "To Do", epic: "DEMO-1" });
  expect(seed).toContain("create_issue");
  expect(seed).toContain("Create it in status To Do.");
  expect(seed).toContain("Parent Epic: DEMO-1");
});

test("submit create payload writes title description labels status and parent", () => {
  const draft = {
    ...openCreateFromColumn("To Do", { selectedEpic: "DEMO-1" }),
    title: " New card ",
    description: "Body",
    labels: ["kanban"],
  };
  expect(buildCreatePayload(draft)).toEqual({
    summary: "New card",
    description: "Body",
    labels: ["kanban"],
    status: "To Do",
    parent: "DEMO-1",
  });
});

test("empty title blocks create write", () => {
  const draft = openCreateFromColumn("To Do");
  expect(canSubmitComposer(draft)).toBe(false);
  expect(buildCreatePayload(draft)).toBeNull();
  expect(canSubmitComposer({ ...draft, title: "  " })).toBe(false);
  expect(canSubmitComposer({ ...draft, title: "Ready" }, true)).toBe(false);
});

test("label suggestions from typed title accept and dismiss chips", () => {
  const draft = { ...openCreateFromCommand(), title: "Ship a kanban view" };
  expect(composerSuggestions(draft, catalog)).toEqual(["kanban"]);
  const accepted = acceptSuggestion(draft, "kanban");
  expect(accepted.labels).toEqual(["kanban"]);
  expect(composerSuggestions(accepted, catalog)).toEqual([]);
  const dismissed = dismissSuggestion(draft, "kanban");
  expect(composerSuggestions(dismissed, catalog)).toEqual([]);
});

test("AI-assisted create path asks Agent to call create_issue", () => {
  const seed = createAiSeed(openCreateFromColumn("Done", { selectedEpic: "DEMO-1" }));
  expect(seed).toContain("create_issue");
  expect(seed).toContain("after I approve");
  expect(commandComposerAction({ kind: "create-ai" })).toBe("create-ai");
  expect(commandComposerAction({ kind: "agent" })).toBeNull();
});

test("column create keeps selected Epic as parent except on All epics", () => {
  expect(openCreateFromColumn("To Do", { selectedEpic: "DEMO-1", boardKind: "stories" }).epic).toBe(
    "DEMO-1",
  );
  expect(openCreateFromColumn("To Do", { selectedEpic: "DEMO-1", boardKind: "combined" }).epic).toBe(
    "DEMO-1",
  );
  const epicColumn = openCreateFromColumn("To Do", { selectedEpic: "DEMO-1", boardKind: "epics" });
  expect(epicColumn.type).toBe("Epic");
  expect(epicColumn.epic).toBeUndefined();
});

test("open edit from a Card uses the same composer in edit mode", () => {
  const draft = openEditFromCard({
    key: "DEMO-2",
    summary: "Parse jira-cli",
    description: "Body",
    labels: ["parser"],
    status: "To Do",
    epic: "DEMO-1",
  });
  expect(draft.mode).toBe("edit");
  expect(draft.key).toBe("DEMO-2");
});

test("edit prefills title description and labels from the Issue", () => {
  expect(
    openEditFromCard({
      key: "DEMO-2",
      fields: [
        { label: "Summary", value: "Parse jira-cli" },
        { label: "Description", value: "Turn the payload into Columns." },
        { label: "Labels", value: "parser, kanban", pills: ["parser", "kanban"] },
      ],
    }),
  ).toMatchObject({
    mode: "edit",
    title: "Parse jira-cli",
    description: "Turn the payload into Columns.",
    labels: ["parser", "kanban"],
  });
});

test("save edit payload writes key summary description and labels", () => {
  expect(
    buildEditPayload(
      openEditFromCard({
        key: "DEMO-2",
        summary: "Edited",
        description: "New body",
        labels: ["parser"],
      }),
    ),
  ).toEqual({
    key: "DEMO-2",
    summary: "Edited",
    description: "New body",
    labels: ["parser"],
  });
});

test("Escape and cancel discard without a write payload", () => {
  const draft = { ...openCreateFromColumn("To Do"), title: "Would write" };
  expect(composerHotkey({ key: "Escape" }, draft)).toBe("close");
  expect(discardComposer()).toBeNull();
  expect(buildCreatePayload(discardComposer())).toBeNull();
  expect(buildEditPayload(discardComposer())).toBeNull();
  expect(composerHotkey({ key: "Enter", metaKey: true }, draft)).toBe("submit");
  expect(composerHotkey({ key: "Enter" }, draft)).toBeNull();
});

test("label suggest works in edit mode too", () => {
  const draft = openEditFromCard({
    key: "DEMO-2",
    summary: "Ship a kanban view",
    description: "",
    labels: [],
  });
  expect(composerSuggestions(draft, catalog)).toEqual(["kanban"]);
  expect(acceptSuggestion(draft, "kanban").labels).toEqual(["kanban"]);
  expect(composerSuggestions(dismissSuggestion(draft, "kanban"), catalog)).toEqual([]);
});

test("empty title blocks edit write", () => {
  const draft = openEditFromCard({ key: "DEMO-2", summary: "  " });
  expect(canSubmitComposer(draft)).toBe(false);
  expect(buildEditPayload(draft)).toBeNull();
});

test("command catalog Create actions are the Cmd+K entry points", () => {
  const kinds = commandCatalog({ presets: [], query: "" })[0]!.rows.map(
    (row) => commandPick(row).kind,
  );
  expect(kinds).toContain("create");
  expect(kinds).toContain("create-ai");
  const jumps: CommandJump[] = [{ kind: "create" }, { kind: "create-ai" }, { kind: "refresh" }];
  expect(jumps.map(commandComposerAction)).toEqual(["create", "create-ai", null]);
});
