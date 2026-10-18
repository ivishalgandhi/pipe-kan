import { describe, expect, test } from "vitest";

import { ADD_FILTER_ROWS, EMPTY_VIEW_DRAFT, ICON_SPEC, addFavoriteFolder, assignIssueProject, createNamedView, fileLinearFavorite, filterPickerProjects, groupLinearFavorites, inboxBadgeCount, inboxNotifications, issueProjectId, projectChip, statusMark, type PickerProject } from "./linear-look.ts";
import { EMPTY_VIEW_FILTER, matchViewFilter } from "./parity.ts";

const ROWS = [
  "AI filter",
  "Advanced filter",
  "Status",
  "Status type",
  "Assignee",
  "Agent",
  "Creator",
  "Priority",
  "Estimate",
  "Labels",
  "Relations",
  "Suggested label",
  "Dates",
  "Project",
  "Project properties",
  "Initiative",
  "Cycle",
  "Added to cycle",
  "Subscribers",
  "Auto-closed",
  "Content",
  "Links",
  "Template",
];

const BACKEND = ["status", "statusType", "assignee", "priority", "labels", "dates", "project", "projectProperties", "initiative"];

describe("linear look", () => {
  test("add filter rows keep the named order", () => {
    expect(ADD_FILTER_ROWS.map((row) => row.label)).toEqual(ROWS);
    expect(ADD_FILTER_ROWS.filter((row) => row.kind === "backend").map((row) => row.id)).toEqual(BACKEND);
    expect(ADD_FILTER_ROWS.filter((row) => row.kind === "soon").map((row) => row.label)).toEqual([
      "Agent",
      "Creator",
      "Estimate",
      "Relations",
      "Suggested label",
      "Cycle",
      "Added to cycle",
      "Subscribers",
      "Auto-closed",
      "Content",
      "Links",
      "Template",
    ]);
    expect(ADD_FILTER_ROWS.find((row) => row.id === "ai")?.kind).toBe("prompt");
    expect(ADD_FILTER_ROWS.find((row) => row.id === "advanced")?.kind).toBe("advanced");
  });

  test("named views store icon, description, scope, and kind", () => {
    const created = createNamedView([], { ...EMPTY_VIEW_DRAFT, title: "Acme Demo", description: "Launch", scope: "team", kind: "projects", icon: "Bug" }, EMPTY_VIEW_FILTER);
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.views[0]).toMatchObject({ name: "Acme Demo", description: "Launch", scope: "team", kind: "projects", icon: "Bug" });
    expect(createNamedView(created.views, { ...EMPTY_VIEW_DRAFT, title: "acme demo" }, EMPTY_VIEW_FILTER)).toEqual({
      ok: false,
      reason: "View names must be unique",
    });
    expect(createNamedView([], EMPTY_VIEW_DRAFT, EMPTY_VIEW_FILTER)).toEqual({ ok: false, reason: "Title is required" });
  });

  test("status type filters and placeholder keys do not", () => {
    const started = { ...EMPTY_VIEW_FILTER, statusType: ["Started"], agent: ["soon"] };
    expect(matchViewFilter({ status: "In Progress" }, started)).toBe(true);
    expect(matchViewFilter({ status: "Todo" }, started)).toBe(false);
    expect(matchViewFilter({ status: "Todo", initiative: "Acme Demo" }, { ...EMPTY_VIEW_FILTER, initiative: ["Acme Demo"] })).toBe(true);
    expect(matchViewFilter({ status: "Todo", initiative: "Other" }, { ...EMPTY_VIEW_FILTER, initiative: ["Acme Demo"] })).toBe(false);
  });

  test("inbox badge caps at 9+ and the list has at least five rows", () => {
    const cards = Array.from({ length: 10 }, (_, index) => ({ key: `DEMO-${index + 1}`, labels: ["needs-input"] }));
    expect(inboxBadgeCount(cards, false)).toBe("9+");
    expect(inboxBadgeCount(cards, true)).toBe("");
    expect(inboxBadgeCount([{ key: "DEMO-12", labels: ["roadmap"] }], false)).toBe("");
    const notes = inboxNotifications([]);
    expect(notes.length).toBeGreaterThanOrEqual(5);
    expect(new Set(notes.map((note) => note.kind))).toEqual(new Set(["update", "assign", "mention"]));
    expect(notes.some((note) => note.issueKey === "DEMO-12")).toBe(true);
  });

  test("favorite folders collapse, reject duplicates, and accept a filed issue", () => {
    expect(addFavoriteFolder(["Launch"], " launch ").ok).toBe(false);
    const added = addFavoriteFolder([], "Launch");
    expect(added).toEqual({ ok: true, folders: ["Launch"] });
    const filed = fileLinearFavorite([{ kind: "issue", id: "DEMO-12", label: "Acme Demo" }], { kind: "issue", id: "DEMO-12" }, "Launch");
    const grouped = groupLinearFavorites(filed, ["Launch", "Empty"]);
    expect(grouped.groups.map((group) => [group.name, group.items.length])).toEqual([
      ["Launch", 1],
      ["Empty", 0],
    ]);
    expect(grouped.loose).toEqual([]);
  });

  test("icon spec sizes and status marks", () => {
    expect(ICON_SPEC).toMatchObject({ status: 14, priority: 12, project: 14, cycle: 12, labelDot: 8, avatar: 20, nav: 16, statusStroke: 1.5, navStroke: 1.5 });
    expect(statusMark("Backlog")).toEqual({ hollow: true, token: "--status-backlog" });
    expect(statusMark("Todo")).toEqual({ hollow: true, token: "--status-todo" });
    expect(statusMark("Paused")).toEqual({ hollow: true, token: "--status-paused" });
    expect(statusMark("In Progress")).toEqual({ hollow: false, token: "--status-active" });
    expect(statusMark("Done")).toEqual({ hollow: false, token: "--status-done" });
    expect(statusMark("Cancelled")).toEqual({ hollow: false, token: "--status-cancelled" });
  });

  test("project search, chip, and assignment", () => {
    const projects: PickerProject[] = [
      { id: "acme/DEMO", identifier: "DEMO", name: "Acme Demo", workspace: "acme", status: "Started", owner: "Ada", priority: "High", progress: 40, issues: 12 },
      { id: "acme/OTHER", identifier: "OTHER", name: "Other", workspace: "acme", status: "Backlog", owner: "Grace", priority: "None", progress: 0, issues: 1 },
    ];
    expect(filterPickerProjects(projects, "demo").map((project) => project.identifier)).toEqual(["DEMO"]);
    expect(projectChip("DEMO")).toBe("P-DEMO");
    expect(assignIssueProject({}, "DEMO-12", "DEMO")).toEqual({ "DEMO-12": "DEMO" });
    expect(issueProjectId("DEMO-12", { "DEMO-12": "" })).toBe("");
    expect(issueProjectId("DEMO-12", {})).toBe("DEMO");
  });
});
