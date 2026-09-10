import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import { IssueStore } from "./store.ts";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/issues.json"),
    "utf8",
  ),
);

test("create assigns the next DEMO key and stores fields", () => {
  const store = IssueStore.fromRaw(fixture);
  const result = store.create({
    summary: "New card",
    description: "Body",
    labels: ["kanban"],
    status: "To Do",
  });
  expect(result).toEqual({ ok: true, key: "DEMO-9" });
  if (!result.ok) return;
  const issue = store.get("DEMO-9");
  expect(issue?.fields.summary).toBe("New card");
  expect(issue?.fields.description).toBe("Body");
  expect(issue?.fields.labels).toEqual(["kanban"]);
  expect(issue?.fields.status.name).toBe("To Do");
});

test("create rejects an empty summary", () => {
  const store = IssueStore.fromRaw(fixture);
  expect(store.create({ summary: "  " })).toEqual({
    ok: false,
    error: "summary is required",
  });
});

test("edit changes summary description and labels", () => {
  const store = IssueStore.fromRaw(fixture);
  expect(store.edit("DEMO-2", {
    summary: "Edited",
    description: "New body",
    labels: ["parser"],
  })).toEqual({ ok: true });
  const issue = store.get("DEMO-2");
  expect(issue?.fields.summary).toBe("Edited");
  expect(issue?.fields.description).toBe("New body");
  expect(issue?.fields.labels).toEqual(["parser"]);
});

test("edit fails for a missing key", () => {
  const store = IssueStore.fromRaw(fixture);
  expect(store.edit("DEMO-404", { summary: "Nope" })).toEqual({
    ok: false,
    error: "Issue DEMO-404 not found",
  });
});

test("create stores parent Epic and does not write when summary is empty", () => {
  const store = IssueStore.fromRaw(fixture);
  const keys = store.all().map((issue) => issue.key);
  expect(store.create({ summary: "  " }).ok).toBe(false);
  expect(store.all().map((issue) => issue.key)).toEqual(keys);
  const created = store.create({ summary: "Child", parent: "DEMO-1", status: "To Do" });
  expect(created).toEqual({ ok: true, key: "DEMO-9" });
  expect(store.get("DEMO-9")?.fields.parent).toEqual({ key: "DEMO-1" });
});
