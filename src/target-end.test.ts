import { mkdtempSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import { issuesToBoard } from "./board.ts";
import { jiraCliConfigPath, readTargetEndFieldMap, writeTargetEndFieldMap } from "./field-map.ts";
import {
  issueTargetEnd,
  mergeViewIntoIssue,
  resolveTargetEndFieldId,
  targetEndFieldIdFromJiraConfig,
} from "./target-end.ts";

test("resolveTargetEndFieldId prefers exact Target End Date over alias and Target Start", () => {
  expect(
    resolveTargetEndFieldId({
      customfield_10101: "Target Start",
      customfield_10102: "Target end",
      customfield_10100: "Target End Date",
    }),
  ).toBe("customfield_10100");
  expect(
    resolveTargetEndFieldId({
      customfield_10101: "Target Start",
      customfield_10102: "Target End",
    }),
  ).toBe("customfield_10102");
  expect(resolveTargetEndFieldId({ customfield_10101: "Target Start" })).toBeUndefined();
});

test("list-shaped JSON without a Target End Date key hydrates from view-raw custom fields", () => {
  const listed = {
    key: "DEMO-2",
    fields: {
      summary: "Thin list",
      status: { name: "To Do" },
      created: "2026-09-01T10:00:00.000+0000",
    },
  };
  const viewRaw = {
    key: "DEMO-2",
    names: {
      customfield_10100: "Target End Date",
      customfield_10101: "Target Start",
    },
    fields: {
      summary: "Thin list",
      status: { name: "To Do" },
      created: "2026-09-01T10:00:00.000+0000",
      customfield_10100: "2026-10-20",
      customfield_10101: "2026-01-15",
    },
  };
  const merged = mergeViewIntoIssue(listed, viewRaw);
  const board = issuesToBoard([merged]);
  expect(board.columns[0].cards[0].targetEnd).toBe("2026-10-20");
});

test("persisted customfield id maps Target End without named keys", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pipe-kan-map-")), "field-map.json");
  writeTargetEndFieldMap(path, { targetEnd: "customfield_10100" });
  expect(readTargetEndFieldMap(path)).toEqual({ targetEnd: "customfield_10100" });
  expect(
    issueTargetEnd(
      {
        customfield_10100: "2026-10-20",
        customfield_10101: "2026-01-15",
      },
      { fieldId: readTargetEndFieldMap(path).targetEnd },
    ),
  ).toBe("2026-10-20");
});

test("jira-cli config custom fields resolve Target End Date by name", () => {
  const yaml = `
issue:
  fields:
    custom:
    - name: Target Start
      key: customfield_10101
    - name: Target End Date
      key: customfield_10100
    - name: Target end
      key: customfield_10999
`;
  expect(targetEndFieldIdFromJiraConfig(yaml)).toBe("customfield_10100");
});

test("viper nested custom arrays resolve quoted Target End Date over Target Start", () => {
  const yaml = `
issue:
    types:
        - name: Story
          handle: Story
    fields:
        custom:
            -
                name: "Target Start"
                key: "customfield_10101"
                schema:
                    datatype: date
            -
                name: "Target End Date"
                key: "customfield_10100"
                schema:
                    datatype: date
`;
  expect(targetEndFieldIdFromJiraConfig(yaml)).toBe("customfield_10100");
});

test("list without Target End Date key hydrates from view-raw without names via jira-cli config", () => {
  const yaml = `
issue:
    fields:
        custom:
            -
                name: Target Start
                key: customfield_10101
            -
                name: Target End Date
                key: customfield_10100
`;
  const listed = {
    key: "DEMO-2",
    fields: {
      summary: "Thin list",
      status: { name: "To Do" },
      created: "2026-09-01T10:00:00.000+0000",
    },
  };
  const viewRaw = {
    key: "DEMO-2",
    fields: {
      summary: "Thin list",
      status: { name: "To Do" },
      created: "2026-09-01T10:00:00.000+0000",
      customfield_10100: "2026-10-20",
      customfield_10101: "2026-01-15",
    },
  };
  const merged = mergeViewIntoIssue(listed, viewRaw);
  expect(merged && typeof merged === "object" && "names" in merged).toBe(false);
  const board = issuesToBoard([merged], {
    targetEndFieldId: targetEndFieldIdFromJiraConfig(yaml),
  });
  expect(board.columns[0].cards[0].targetEnd).toBe("2026-10-20");
});

test("jiraCliConfigPath prefers JIRA_CONFIG_FILE then XDG then ~/.config", () => {
  expect(jiraCliConfigPath({ JIRA_CONFIG_FILE: "/tmp/jira.yml" })).toBe("/tmp/jira.yml");
  expect(jiraCliConfigPath({ XDG_CONFIG_HOME: "/xdg" })).toBe("/xdg/.jira/.config.yml");
  expect(jiraCliConfigPath({})).toBe(join(homedir(), ".config", ".jira", ".config.yml"));
});
