import { expect, test } from "vitest";

import { argvToFlags, commitWorkspaceSlug, DEFAULT_FLAGS, flagsToJql, parseFlags, setProjectsFlag, setWorkspaceFlag, wantsPlane } from "./flags.ts";

test("default Scope has no project clause", () => {
  expect(DEFAULT_FLAGS).toBe("");
  expect(flagsToJql("")).toBe("");
  expect(wantsPlane("")).toBe(false);
  expect(parseFlags("").plane).toBe(false);
});

test("Scope flags still add assignee and status", () => {
  expect(flagsToJql("-a user@test.com -s~Done")).toBe(
    'assignee="user@test.com" AND status!="Done"',
  );
});

test("Scope type flag lists Epics", () => {
  expect(flagsToJql("-tEpic")).toBe('type="Epic"');
});

test("--projects parses multiple projects into JQL", async () => {
  const parsed = parseFlags("--projects PROJ1,PROJ2 -a user@test.com");
  expect(parsed.projects).toEqual(["PROJ1", "PROJ2"]);
  expect(parsed.jql).toBe(
    'project in ("PROJ1", "PROJ2") AND assignee="user@test.com"',
  );
});

test("argvToFlags converts process.argv to flags string", () => {
  expect(argvToFlags(["node", "pipe-kan", "--projects", "SQLPOD"])).toBe(
    "--projects SQLPOD",
  );
  expect(argvToFlags(["node", "pipe-kan", "-a", "user@test.com"])).toBe(
    "-a user@test.com",
  );
  expect(argvToFlags(["node", "pipe-kan"])).toBe("");
  expect(argvToFlags(["node", "pipe-kan", "--plane", "--projects", "APH,PULSE"])).toBe(
    "--plane --projects APH,PULSE",
  );
});

test("--plane and --workspace stay out of JQL", () => {
  const parsed = parseFlags("--plane --workspace team --projects APH,PULSE");
  expect(parsed.plane).toBe(true);
  expect(parsed.workspace).toBe("team");
  expect(parsed.projects).toEqual(["APH", "PULSE"]);
  expect(parsed.jql).toBe('project in ("APH", "PULSE")');
});

test("--workspace=slug is accepted", () => {
  expect(parseFlags("--plane --workspace=personal").workspace).toBe("personal");
});

test("setWorkspaceFlag inserts one --workspace token", () => {
  expect(setWorkspaceFlag("--plane --projects APH,PULSE", "team")).toBe(
    "--plane --projects APH,PULSE --workspace team",
  );
});

test("setWorkspaceFlag replaces an existing --workspace token", () => {
  expect(setWorkspaceFlag("--plane --workspace personal --projects APH", "other")).toBe(
    "--plane --workspace other --projects APH",
  );
});

test("setWorkspaceFlag replaces --workspace= and does not leave a second token", () => {
  expect(setWorkspaceFlag("--workspace=personal --plane --workspace team", "other")).toBe(
    "--workspace other --plane",
  );
});

test("setWorkspaceFlag writes personal and trims the slug", () => {
  expect(setWorkspaceFlag("--plane", "personal")).toBe("--plane --workspace personal");
  expect(setWorkspaceFlag("--plane --workspace team", " other ")).toBe(
    "--plane --workspace other",
  );
});

test("setWorkspaceFlag leaves flags unchanged for an empty slug", () => {
  expect(setWorkspaceFlag("--plane --projects APH", "")).toBe("--plane --projects APH");
  expect(setWorkspaceFlag("--plane --projects APH", "   ")).toBe("--plane --projects APH");
});

test("commitWorkspaceSlug rejects an empty typed slug", () => {
  expect(commitWorkspaceSlug("personal", "")).toEqual({ action: "reject" });
  expect(commitWorkspaceSlug("personal", "   ")).toEqual({ action: "reject" });
});

test("commitWorkspaceSlug is a no-op for the live slug", () => {
  expect(commitWorkspaceSlug("personal", "personal")).toEqual({ action: "noop" });
  expect(commitWorkspaceSlug("team", " team ")).toEqual({ action: "noop" });
});

test("commitWorkspaceSlug trims and keeps typed case", () => {
  expect(commitWorkspaceSlug("personal", " other ")).toEqual({ action: "commit", slug: "other" });
  expect(commitWorkspaceSlug("personal", "Personal")).toEqual({ action: "commit", slug: "Personal" });
});

test("setProjectsFlag inserts one --projects token and keeps --plane", () => {
  expect(setProjectsFlag("--plane --workspace other", ["dec", "aph"])).toBe(
    "--plane --workspace other --projects DEC,APH",
  );
});

test("setProjectsFlag replaces an existing --projects token", () => {
  expect(setProjectsFlag("--plane --projects APH,PULSE --workspace other", ["dec"])).toBe(
    "--plane --projects DEC --workspace other",
  );
});

test("setProjectsFlag replaces --projects= and does not leave a second token", () => {
  expect(setProjectsFlag("--projects=APH --plane --projects PULSE", ["dec"])).toBe(
    "--projects DEC --plane",
  );
});

test("setProjectsFlag uppercases identifiers like parseFlags", () => {
  expect(parseFlags(setProjectsFlag("--plane", ["dec", " aph "])).projects).toEqual(["DEC", "APH"]);
});

test("setWorkspaceFlag then setProjectsFlag writes both and drops previous tenant ids", () => {
  expect(
    setProjectsFlag(setWorkspaceFlag("--plane --workspace personal --projects APH,PULSE", "other"), [
      "dec",
    ]),
  ).toBe("--plane --workspace other --projects DEC");
});

test("catalog failure empties --projects and keeps attempted --workspace", () => {
  expect(
    setProjectsFlag(setWorkspaceFlag("--plane --workspace personal --projects APH,PULSE", "other"), []),
  ).toBe("--plane --workspace other");
});
