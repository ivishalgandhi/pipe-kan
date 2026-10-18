import { describe, expect, test } from "vitest";

import { commandCatalog } from "./command.ts";
import { applyScopeSelection, parseFlags } from "./flags.ts";
import {
  clearViewChip,
  classifyHealth,
  computeHealth,
  dominantAssignee,
  effectiveLayout,
  isWorkspaceChord,
  layoutTimeline,
  matchViewFilter,
  saveView,
  setDefaultView,
  sourceOptions,
  toggleScope,
  viewFilterChips,
  EMPTY_VIEW_FILTER,
  DEFAULT_DISPLAY,
} from "./parity.ts";
import { createPlaneCli } from "./plane.ts";
import { planeFixtureFetch } from "./plane-fixture.ts";
import { rowMenuModel } from "./row-menu.ts";

const NOW = new Date("2026-06-01T00:00:00Z");

describe("linear parity", () => {
  test("health follows status and target date", () => {
    expect(computeHealth("done", "2020-01-01", NOW)).toBe("green");
    expect(computeHealth("cancelled", "2020-01-01", NOW)).toBe("red");
    expect(computeHealth("in_progress", "2020-01-01", NOW)).toBe("yellow");
    expect(computeHealth("in progress", "2026-12-01", NOW)).toBe("green");
    expect(computeHealth("paused", undefined, NOW)).toBe("yellow");
    expect(computeHealth("todo", undefined, NOW)).toBe("gray");
    expect(computeHealth("backlog", undefined, NOW)).toBe("gray");
    expect(computeHealth("in progress", undefined, NOW)).toBe("green");
    expect(classifyHealth("in progress", undefined, NOW)).toBe("Update missing");
    expect(classifyHealth("in progress", "2020-01-01", NOW)).toBe("At risk");
    expect(classifyHealth("in progress", "2026-12-01", NOW)).toBe("On track");
    expect(classifyHealth("todo", undefined, NOW)).toBe("No update expected");
    expect(classifyHealth("cancelled", undefined, NOW)).toBe("Off track");
    expect(dominantAssignee(["Ada", "Grace", "Ada"])).toBe("Ada");
    expect(matchViewFilter({ status: "In Progress", due: "2026-12-01", health: "green" }, { ...EMPTY_VIEW_FILTER, health: ["Update missing"] })).toBe(false);
    expect(matchViewFilter({ status: "In Progress", health: "green" }, { ...EMPTY_VIEW_FILTER, health: ["Update missing"] })).toBe(true);
    expect(matchViewFilter({ status: "Todo", health: "gray" }, { ...EMPTY_VIEW_FILTER, health: ["No update expected"] })).toBe(true);
  });

  test("multi-select scopes keep both workspaces and sync projects", () => {
    const scopes = toggleScope(
      [{ workspace: "work", project: "PULSE" }],
      { workspace: "personal", project: "PULSE" },
    );
    const flags = applyScopeSelection("--plane", { workspaces: ["work", "personal"], scopes });
    const parsed = parseFlags(flags);
    expect(parsed.plane).toBe(true);
    expect(parsed.workspaces).toEqual(["work", "personal"]);
    expect(parsed.workspace).toBe("work");
    expect(parsed.scopes).toEqual([
      { workspace: "work", project: "PULSE" },
      { workspace: "personal", project: "PULSE" },
    ]);
    expect(parsed.projects).toEqual(["PULSE"]);
  });

  test("synthetic plane merges work and personal PULSE", async () => {
    const flags = "--plane --workspaces work,personal --scopes work/PULSE,personal/PULSE";
    const cli = createPlaneCli({
      apiKey: "fake",
      host: "https://plane.test",
      flags,
      fetch: planeFixtureFetch(),
      retryDelayMs: 0,
    });
    const issues = JSON.parse(await cli.list(flags)) as { key: string }[];
    expect(issues.map((issue) => issue.key).sort()).toEqual(["personal/PULSE-1", "work/PULSE-1", "work/PULSE-2"]);
    const parity = await cli.parity?.(flags);
    expect(parity?.projects.map((project) => `${project.workspace}/${project.identifier}`).sort()).toEqual([
      "personal/PULSE",
      "work/PULSE",
    ]);
    expect(parity?.initiatives.length).toBeGreaterThanOrEqual(5);
    expect(new Set(parity?.initiatives.map((row) => row.health))).toEqual(new Set(["gray", "green", "yellow", "red"]));
  });

  test("command palette jumps to initiatives, sources, display, and ow", () => {
    expect(isWorkspaceChord("ow")).toBe(true);
    const ow = commandCatalog({
      presets: [],
      query: "ow",
      plane: true,
      workspaces: [{ id: "1", name: "Work", slug: "work" }],
    });
    expect(ow.map((group) => group.id)).toEqual(["workspace"]);
    expect(ow[0]?.rows.map((row) => row.label)).toContain("Work");
    const plane = commandCatalog({ presets: [], query: "", plane: true, workspaces: [] });
    expect(plane[0]?.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(["Initiatives", "Projects"]),
    );
    const source = commandCatalog({ presets: [], query: "plane" });
    expect(source.flatMap((group) => group.rows).map((row) => row.label)).toContain("Switch to Plane");
    const display = commandCatalog({ presets: [], query: "display" });
    expect(display.flatMap((group) => group.rows).some((row) => row.jump.kind === "display")).toBe(true);
    const status = commandCatalog({
      presets: [],
      query: "status",
      selectedKey: "DEMO-1",
      statuses: ["To Do"],
    });
    expect(status.flatMap((group) => group.rows).map((row) => row.label)).toContain("Status To Do");
  });

  test("view filters, saved views, timeline, and row menu", () => {
    const filter = {
      ...EMPTY_VIEW_FILTER,
      status: ["Done"],
      created: { from: "2026-01-01", to: "2026-02-01" },
    };
    expect(matchViewFilter({ status: "done", created: "2026-01-15" }, filter)).toBe(true);
    expect(matchViewFilter({ status: "todo", created: "2026-01-15" }, filter)).toBe(false);
    expect(viewFilterChips(filter).map((chip) => chip.id)).toEqual(["created", "status:Done"]);
    expect(clearViewChip(filter, "status:Done").status).toEqual([]);
    const saved = saveView([], "Pulse", filter);
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(setDefaultView(saved.views, "Pulse")[0]?.default).toBe(true);
    const timeline = layoutTimeline(
      [
        { id: "a", label: "Scheduled", group: "Pulse", health: "green", start: "2026-01-01", end: "2026-02-01" },
        { id: "b", label: "Loose", group: "Pulse", health: "gray" },
      ],
      "month",
      NOW,
    );
    expect(timeline.bars).toHaveLength(1);
    expect(timeline.unscheduled.map((item) => item.label)).toEqual(["Loose"]);
    expect(timeline.todayX).toBeGreaterThan(0);
    expect(effectiveLayout("initiatives", DEFAULT_DISPLAY, false)).toBe("list");
    expect(effectiveLayout("stories", DEFAULT_DISPLAY, false)).toBe("board");
    expect(rowMenuModel({ statuses: ["Todo"], assignees: ["Ada"], labels: ["roadmap"] }).map((section) => section.label)).toEqual([
      "Status",
      "Assignee",
      "Priority",
      "Labels",
      "Project",
      "Copy link",
    ]);
    const sources = sourceOptions({ planeKey: false, jiraBin: false });
    expect(sources.find((source) => source.id === "taskwarrior")).toMatchObject({
      enabled: false,
      reason: "Taskwarrior is not connected",
    });
    expect(sources.find((source) => source.id === "jira")?.enabled).toBe(true);
  });
});

import { workspacesEmptyMessage } from "./command.ts";

test("empty workspace switcher shows a connect state, never the old Jira wording", () => {
  expect(workspacesEmptyMessage("jira")).toBe("Connect the Plane source to see workspaces.");
  expect(workspacesEmptyMessage("plane")).toContain("No Plane workspaces found");
  expect(workspacesEmptyMessage("jira")).not.toContain("Jira has no");
});
