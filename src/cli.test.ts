import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

import type { RawIssue } from "./board.ts";
import { createBoardApp, refreshFromJira } from "./boot.ts";
import { createJiraCli, resolveJiraBin } from "./cli.ts";

const fixture = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../fixtures/issues.json"),
    "utf8",
  ),
) as RawIssue[];

function fakeJira() {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-"));
  const bin = join(dir, "jira");
  const log = join(dir, "calls.jsonl");
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(log)}, JSON.stringify({
  args: process.argv.slice(2),
  config: process.env.JIRA_CONFIG_FILE ?? null,
  token: process.env.JIRA_API_TOKEN ?? null,
}) + "\\n");
const [cmd, sub, key, status] = process.argv.slice(2);
if (cmd === "issue" && sub === "list") {
  if (process.argv.slice(2).some((arg) => String(arg).includes("EMPTY"))) {
    console.error('✗ No result found for given query in project "SQLJIRA"');
    process.exit(1);
  }
  console.log(JSON.stringify([{
    key: "DEMO-1",
    fields: { summary: "from jira", status: { name: "To Do" } },
  }]));
  process.exit(0);
}
if (cmd === "issue" && sub === "move") {
  if (key === "DEMO-4" && status === "Done") {
    console.error("✗ invalid transition state \\"Done\\"");
    process.exit(1);
  }
  process.exit(0);
}
if (cmd === "issue" && sub === "view") {
  console.log(JSON.stringify({
    key,
    fields: { summary: "from jira", status: { name: "To Do" }, description: "viewed" },
  }));
  process.exit(0);
}
if (cmd === "open") {
  console.log("opening...");
  console.log("http://127.0.0.1:5173/browse/" + sub);
  process.exit(0);
}
process.exit(1);
`,
  );
  chmodSync(bin, 0o755);
  return {
    bin,
    calls() {
      try {
        return readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as {
            args: string[];
            config: string | null;
            token: string | null;
          });
      } catch {
        return [];
      }
    },
  };
}


function rateLimitJira(fails: number) {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-"));
  const bin = join(dir, "jira");
  const log = join(dir, "calls.jsonl");
  const count = join(dir, "count");
  writeFileSync(count, "0");
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2) }) + "\\n");
const countPath = ${JSON.stringify(count)};
const n = Number(readFileSync(countPath, "utf8")) + 1;
writeFileSync(countPath, String(n));
if (n <= ${fails}) {
  console.error("✗ Unexpected response '429' from jira. Received following response: Rate limit exceeded");
  process.exit(1);
}
console.log(JSON.stringify([{
  key: "DEMO-1",
  fields: { summary: "from jira", status: { name: "To Do" } },
}]));
`,
  );
  chmodSync(bin, 0o755);
  return {
    bin,
    calls() {
      try {
        return readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as { args: string[] });
      } catch {
        return [];
      }
    },
  };
}

function pagingJira(total: number) {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-"));
  const bin = join(dir, "jira");
  const log = join(dir, "calls.jsonl");
  writeFileSync(
    bin,
    `#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
appendFileSync(${JSON.stringify(log)}, JSON.stringify({ args: process.argv.slice(2) }) + "\\n");
const args = process.argv.slice(2);
const i = args.indexOf("--paginate");
const spec = i >= 0 ? args[i + 1] ?? "0:100" : "0:100";
const [from, limit] = spec.split(":").map(Number);
const issues = Array.from({ length: ${total} }, (_, n) => ({
  key: "DEMO-" + n,
  fields: { summary: "Epic " + n, status: { name: "To Do" }, issuetype: { name: "Epic" } },
}));
const page = issues.slice(from, from + limit);
if (!page.length) {
  console.error('✗ No result found for given query in project "DEMO"');
  process.exit(1);
}
console.log(JSON.stringify(page));
`,
  );
  chmodSync(bin, 0o755);
  return {
    bin,
    calls() {
      try {
        return readFileSync(log, "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line) as { args: string[] });
      } catch {
        return [];
      }
    },
  };
}

test("resolveJiraBin finds an explicit path and misses a missing name", () => {
  const { bin } = fakeJira();
  expect(resolveJiraBin(bin)).toBe(bin);
  expect(resolveJiraBin("no-such-jira-bin", "/tmp")).toBeUndefined();
});

test("createJiraCli lists with flags and --raw", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({ bin });
  const raw = await cli.list("-a user@test.com -s~Done");
  expect(JSON.parse(raw)[0].key).toBe("DEMO-1");
  expect(calls()[0].args).toEqual([
    "issue",
    "list",
    "-a",
    "user@test.com",
    "-s~Done",
    "--raw",
  ]);
});

test("createJiraCli treats an empty jira list as no Issues", async () => {
  const { bin } = fakeJira();
  const cli = createJiraCli({ bin });
  expect(JSON.parse(await cli.list("-q EMPTY"))).toEqual([]);
});

test("createJiraCli retries a 429 list until Jira answers", async () => {
  const { bin, calls } = rateLimitJira(2);
  const cli = createJiraCli({ bin, retryDelayMs: 0 });
  expect(JSON.parse(await cli.list("")).map((issue: { key: string }) => issue.key)).toEqual(["DEMO-1"]);
  expect(calls()).toHaveLength(3);
});

test("createJiraCli still fails a 429 that does not recover", async () => {
  const { bin, calls } = rateLimitJira(99);
  const cli = createJiraCli({ bin, retryDelayMs: 0 });
  await expect(cli.list("")).rejects.toThrow(/429/);
  expect(calls()).toHaveLength(5);
});


test("createJiraCli lists every Epic with -tEpic", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({ bin });
  const raw = await cli.listEpics();
  expect(JSON.parse(raw)[0].key).toBe("DEMO-1");
  expect(calls()[0].args).toEqual(["issue", "list", "-tEpic", "--paginate", "0:100", "--raw"]);
});

test("createJiraCli lists every Epic past jira-cli's 100-item page", async () => {
  const { bin, calls } = pagingJira(101);
  const cli = createJiraCli({ bin });
  expect(JSON.parse(await cli.listEpics()).map((issue: { key: string }) => issue.key)).toEqual(
    Array.from({ length: 101 }, (_, n) => `DEMO-${n}`),
  );
  expect(calls().map((call) => call.args)).toEqual([
    ["issue", "list", "-tEpic", "--paginate", "0:100", "--raw"],
    ["issue", "list", "-tEpic", "--paginate", "100:100", "--raw"],
  ]);
});

test("createJiraCli list is one jira-cli page", async () => {
  const { bin, calls } = pagingJira(101);
  const cli = createJiraCli({ bin });
  expect(JSON.parse(await cli.list("")).map((issue: { key: string }) => issue.key)).toEqual(
    Array.from({ length: 100 }, (_, n) => `DEMO-${n}`),
  );
  expect(calls().map((call) => call.args)).toEqual([["issue", "list", "--raw"]]);
});

test("createJiraCli list keeps a Scope --paginate", async () => {
  const { bin, calls } = pagingJira(101);
  const cli = createJiraCli({ bin });
  expect(JSON.parse(await cli.list("--paginate 0:50")).map((issue: { key: string }) => issue.key)).toEqual(
    Array.from({ length: 50 }, (_, n) => `DEMO-${n}`),
  );
  expect(calls().map((call) => call.args)).toEqual([
    ["issue", "list", "--paginate", "0:50", "--raw"],
  ]);
});

test("createJiraCli lists Epic children with parent or Epic Link", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({ bin });
  const raw = await cli.listEpic("DEMO-1");
  expect(JSON.parse(raw)[0].key).toBe("DEMO-1");
  expect(calls()[0].args).toEqual([
    "issue",
    "list",
    "-q",
    '(parent="DEMO-1" OR "Epic Link"="DEMO-1")',
    "--paginate",
    "0:100",
    "--raw",
  ]);
});

test("createJiraCli lists children of every Epic in one call", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({ bin });
  await cli.listChildren(["DEMO-1", "DEMO-8"]);
  expect(calls()[0].args).toEqual([
    "issue",
    "list",
    "-q",
    '(parent in ("DEMO-1", "DEMO-8") OR "Epic Link" in ("DEMO-1", "DEMO-8"))',
    "--paginate",
    "0:100",
    "--raw",
  ]);
});

test("createJiraCli does not force Fake Jira config or token", async () => {
  const { bin, calls } = fakeJira();
  const prevConfig = process.env.JIRA_CONFIG_FILE;
  const prevToken = process.env.JIRA_API_TOKEN;
  delete process.env.JIRA_CONFIG_FILE;
  delete process.env.JIRA_API_TOKEN;
  try {
    const cli = createJiraCli({ bin });
    await cli.list("");
    expect(calls()[0].config).toBeNull();
    expect(calls()[0].token).toBeNull();
  } finally {
    if (prevConfig === undefined) delete process.env.JIRA_CONFIG_FILE;
    else process.env.JIRA_CONFIG_FILE = prevConfig;
    if (prevToken === undefined) delete process.env.JIRA_API_TOKEN;
    else process.env.JIRA_API_TOKEN = prevToken;
  }
});

test("createJiraCli passes config and token when given", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({
    bin,
    configPath: "/tmp/jira.config.yml",
    token: "fake",
  });
  await cli.list("");
  expect(calls()[0].config).toBe("/tmp/jira.config.yml");
  expect(calls()[0].token).toBe("fake");
});

test("createJiraCli move and open shell jira-cli", async () => {
  const { bin, calls } = fakeJira();
  const cli = createJiraCli({ bin });
  expect(await cli.move("DEMO-3", "Done")).toEqual({ ok: true });
  expect(await cli.move("DEMO-4", "Done")).toEqual({
    ok: false,
    error: '✗ invalid transition state "Done"',
  });
  expect(await cli.open("DEMO-1")).toBe("http://127.0.0.1:5173/browse/DEMO-1");
  expect(JSON.parse(await cli.view("DEMO-1")).fields.description).toBe("viewed");
  expect(calls().map((call) => call.args)).toEqual([
    ["issue", "move", "DEMO-3", "Done"],
    ["issue", "move", "DEMO-4", "Done"],
    ["open", "DEMO-1", "--no-browser"],
    ["issue", "view", "DEMO-1", "--raw"],
  ]);
});

test("boot without jira uses the store", async () => {
  const { kind, app } = await createBoardApp({
    raw: fixture,
    env: { PATH: "/tmp", JIRA_BIN: "jira" },
  });
  expect(kind).toBe("store");
  expect(
    app.board().columns.flatMap((column) => column.cards.map((card) => card.key)),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);
});

test("boot with jira first-paints from the store then Refresh shells jira", async () => {
  const { bin } = fakeJira();
  const { kind, app } = await createBoardApp({
    raw: fixture,
    env: { PATH: "/tmp", JIRA_BIN: bin },
  });
  expect(kind).toBe("jira");
  expect(
    app.board().columns.flatMap((column) => column.cards.map((card) => card.key)),
  ).toEqual(["DEMO-2", "DEMO-4", "DEMO-6", "DEMO-3", "DEMO-5"]);

  await refreshFromJira(app, kind);
  expect(
    app.board().columns.flatMap((column) =>
      column.cards.map((card) => ({ key: card.key, summary: card.summary })),
    ),
  ).toEqual([{ key: "DEMO-1", summary: "from jira" }]);
});

test("boot with Pipe and jira keeps the Pipe Board until Refresh", async () => {
  const { bin, calls } = fakeJira();
  const piped = [
    {
      key: "WORK-9",
      fields: { summary: "piped", status: { name: "To Do" } },
    },
  ];
  const { kind, app } = await createBoardApp({
    raw: piped,
    piped: true,
    env: { PATH: "/tmp", JIRA_BIN: bin },
  });
  expect(kind).toBe("jira");
  expect(app.board().columns[0]?.cards.map((card) => card.key)).toEqual(["WORK-9"]);

  await refreshFromJira(app, kind, { piped: true });
  expect(app.board().columns[0]?.cards.map((card) => card.key)).toEqual(["WORK-9"]);
  expect(calls().filter((call) => call.args[1] === "list")).toEqual([]);

  await refreshFromJira(app, kind);
  expect(app.board().columns[0]?.cards[0]).toMatchObject({
    key: "DEMO-1",
    summary: "from jira",
  });
});
