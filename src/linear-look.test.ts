import { describe, expect, test } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TeamNav } from "./components/linear-look.tsx";
import { ADD_FILTER_ROWS, EMPTY_VIEW_DRAFT, ICON_SPEC, addFavoriteFolder, assignIssueProject, createNamedView, fileLinearFavorite, filterPickerProjects, groupLinearFavorites, inboxBadgeCount, inboxNotifications, issueProjectId, projectChip, sidebarSelection, statusMark, type PickerProject } from "./linear-look.ts";
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

  test("sidebar selection keeps a single row", () => {
    const base = {
      sidebarPage: "board" as const,
      boardKind: "stories" as const,
      issueLens: "all" as const,
      canvasTab: "board" as const,
      epicSelected: false,
      plane: false,
      intent: null,
    };
    expect(sidebarSelection(base)).toEqual({ kind: "team", item: "All stories" });
    expect(sidebarSelection({ ...base, issueLens: "mine" })).toEqual({ kind: "team", item: "My issues" });
    expect(sidebarSelection({ ...base, boardKind: "epics" })).toEqual({ kind: "team", item: "All epics" });
    expect(sidebarSelection({ ...base, boardKind: "combined" })).toEqual({ kind: "team", item: "Combined" });
    expect(sidebarSelection({ ...base, canvasTab: "calendar" })).toEqual({ kind: "team", item: "Calendar" });
    expect(sidebarSelection({ ...base, canvasTab: "calendar", intent: "all-stories" })).toEqual({ kind: "team", item: "All stories" });
    expect(sidebarSelection({ ...base, boardKind: "epics", canvasTab: "calendar", intent: "calendar" })).toEqual({ kind: "team", item: "Calendar" });
    expect(sidebarSelection({ ...base, boardKind: "epics", intent: "all-epics", canvasTab: "calendar" })).toEqual({ kind: "team", item: "All epics" });
    expect(sidebarSelection({ ...base, sidebarPage: "inbox", boardKind: "epics" })).toEqual({ kind: "inbox" });
    expect(sidebarSelection({ ...base, sidebarPage: "views", intent: "team-views" })).toEqual({ kind: "team", item: "Views" });
    expect(sidebarSelection({ ...base, sidebarPage: "views" })).toEqual({ kind: "workspace", item: "views" });
    expect(sidebarSelection({ ...base, boardKind: "projects", plane: true })).toEqual({ kind: "workspace", item: "projects" });
    expect(sidebarSelection({ ...base, boardKind: "projects", plane: true, intent: "team-projects" })).toEqual({ kind: "team", item: "Projects" });
    expect(sidebarSelection({ ...base, boardKind: "projects" })).toEqual({ kind: "team", item: "Projects" });
    expect(sidebarSelection({ ...base, boardKind: "initiatives", plane: true })).toEqual({ kind: "workspace", item: "initiatives" });
    expect(sidebarSelection({ ...base, epicSelected: true })).toEqual({ kind: "epic" });
    expect(sidebarSelection({ ...base, intent: "pulse" })).toEqual({ kind: "pulse" });
    expect(sidebarSelection({ ...base, intent: "home" })).toEqual({ kind: "team", item: "Home" });
    expect(sidebarSelection({ ...base, intent: "triage" })).toEqual({ kind: "team", item: "Triage" });
    expect(sidebarSelection({ ...base, sidebarPage: "teams" })).toEqual({ kind: "workspace", item: "teams" });
  });
});

test("team nav is a vertical list with one current row", () => {
  const html = renderToStaticMarkup(
    createElement(TeamNav, {
      scopes: [{ workspace: "acme", project: "DEMO" }],
      triage: 3,
      current: { item: "All stories", scope: "acme/DEMO" },
      mineTitle: "Assigned to you",
      onOpenScope: () => undefined,
      onNav: () => undefined,
    }),
  );
  expect(html).toContain('role="tree"');
  expect(html).toContain('data-orientation="vertical"');
  expect(html).toContain('data-team="acme/DEMO"');
  expect(html).not.toContain("flex-wrap");
  for (const label of ["Home", "Triage", "Issues", "All stories", "My issues", "All epics", "Cycles", "Current", "Upcoming", "Projects", "Views", "Combined", "Calendar"]) {
    expect(html).toContain(label);
  }
  expect(html).toContain('data-smoke="cycle-guide"');
  expect(html).toContain('data-depth="2"');
  expect(html).toContain('data-depth="3"');
  expect(html).toContain('title="Coming soon"');
  expect(html).toContain("Team menu acme/DEMO");
  expect(html).toContain(">3<");
  expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  expect(html).toContain('data-mode="All stories"');
  expect(html).toContain("w-full");
});
