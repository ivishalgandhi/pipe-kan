import { expect, test } from "vitest";

import { argvToFlags, DEFAULT_FLAGS, flagsToJql, parseFlags, setWorkspaceFlag, wantsPlane } from "./flags.ts";

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
