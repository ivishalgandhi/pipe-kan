import { expect, test } from "vitest";

import { argvToFlags, DEFAULT_FLAGS, flagsToJql, parseFlags } from "./flags.ts";

test("default Scope has no assignee and no Done hide", () => {
  expect(DEFAULT_FLAGS).toBe("");
  expect(flagsToJql("")).toBe('project="DEMO"');
});

test("Scope flags still add assignee and status", () => {
  expect(flagsToJql("-a user@test.com -s~Done")).toBe(
    'project="DEMO" AND assignee="user@test.com" AND status!="Done"',
  );
});

test("Scope type flag lists Epics", () => {
  expect(flagsToJql("-tEpic")).toBe('project="DEMO" AND type="Epic"');
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
});
