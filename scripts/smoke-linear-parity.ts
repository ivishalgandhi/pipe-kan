import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { commandCatalog } from "../src/command.ts";
import { effectiveLayout, layoutTimeline, matchViewFilter, sourceOptions, viewFilterChips, DEFAULT_DISPLAY, EMPTY_VIEW_FILTER } from "../src/parity.ts";
import { rowMenuModel } from "../src/row-menu.ts";

const LOG = "docs/factory/plans/gbj-20261018-019-pipekan-linear-parity/smoke-logs/smoke.log";
const FLAGS = ["--plane", "--workspaces", "work,personal", "--scopes", "work/PULSE,personal/PULSE"];
const lines: string[] = [];

function note(line: string) {
  lines.push(line);
  console.log(line);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  note(`PASS ${message}`);
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(stream: NodeJS.ReadableStream, needle: string, child: { kill: (signal?: NodeJS.Signals) => void }) {
  let buffer = "";
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`server did not announce ${needle}\n${buffer}`));
    }, 15000);
    stream.on("data", (chunk) => {
      buffer += String(chunk);
      if (buffer.includes(needle)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

type BoardBody = {
  kind?: string;
  columns?: { cards?: { key?: string }[] }[];
  epics?: { key?: string }[];
  error?: string;
};

function keysOf(board: BoardBody): string[] {
  const cards = board.columns?.flatMap((column) => column.cards ?? []) ?? [];
  return [...cards, ...(board.epics ?? [])].map((item) => item.key ?? "").filter(Boolean);
}

async function exercise(origin: string, label: string) {
  note(`-- ${label}`);
  const board = (await (await fetch(`${origin}/api/board`)).json()) as BoardBody;
  const keys = keysOf(board);
  assert(board.kind === "plane", `${label} board kind is plane`);
  assert(!board.error, `${label} plane board has no error`);
  assert(keys.includes("work/PULSE-1"), `${label} merged view includes work/PULSE-1`);
  assert(keys.includes("personal/PULSE-1"), `${label} merged view includes personal/PULSE-1`);
  const parity = (await (await fetch(`${origin}/api/parity`)).json()) as {
    initiatives: { workspace: string; health: string }[];
    projects: { workspace: string; identifier: string }[];
  };
  assert(parity.initiatives.length >= 5, `${label} initiatives view has at least 5 rows`);
  assert(
    parity.projects.some((project) => project.workspace === "work" && project.identifier === "PULSE") &&
      parity.projects.some((project) => project.workspace === "personal" && project.identifier === "PULSE"),
    `${label} projects view lists PULSE from work and personal`,
  );
  assert(new Set(parity.initiatives.map((row) => row.health)).size >= 3, `${label} timeline health covers several states`);
  const sources = (await (await fetch(`${origin}/api/sources`)).json()) as {
    sources: { id: string; enabled: boolean; reason?: string }[];
  };
  assert(sources.sources.some((source) => source.id === "taskwarrior" && source.enabled === false), `${label} taskwarrior stays disabled`);
  const toJira = (await (
    await fetch(`${origin}/api/source`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "jira" }),
    })
  ).json()) as { ok: boolean; kind?: string; source?: string };
  assert(toJira.ok && toJira.kind === "store" && toJira.source === "jira", `${label} source switch plane to jira without restart`);
  const jiraBoard = (await (await fetch(`${origin}/api/board`)).json()) as BoardBody;
  const jiraKeys = keysOf(jiraBoard);
  assert(jiraBoard.kind === "store", `${label} jira source serves the fake board`);
  assert(jiraKeys.some((key) => key.startsWith("DEMO-")), `${label} fake jira board lists DEMO issues`);
  assert(!jiraKeys.includes("work/PULSE-1"), `${label} jira board is not the plane merge`);
  const back = (await (
    await fetch(`${origin}/api/source`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "plane" }),
    })
  ).json()) as { ok: boolean; kind?: string; error?: string };
  assert(back.ok && back.kind === "plane", `${label} source switch jira back to plane`);
  const again = keysOf((await (await fetch(`${origin}/api/board`)).json()) as BoardBody);
  assert(again.includes("work/PULSE-1") && again.includes("personal/PULSE-1"), `${label} merged view returns after source switch`);
  const blocked = (await (
    await fetch(`${origin}/api/source`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ source: "taskwarrior" }),
    })
  ).json()) as { ok: boolean; reason?: string };
  assert(blocked.ok === false && blocked.reason === "Taskwarrior is not connected", `${label} taskwarrior switch is refused`);
}

async function boot(command: string, args: string[], label: string) {
  const port = await freePort();
  const child = spawn(command, args, {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PLANE_API_KEY: "fake",
      PLANE_FIXTURE: "synthetic",
      PIPE_KAN_SMOKE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  try {
    await waitFor(child.stdout!, "pipe-kan http", child);
    await exercise(`http://127.0.0.1:${port}`, label);
  } catch (err) {
    note(stderr.trim());
    throw err;
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

function pureChecks() {
  note("-- filters, context menu, command palette, timeline");
  const filter = { ...EMPTY_VIEW_FILTER, status: ["In Progress"], priority: ["High"] };
  assert(matchViewFilter({ status: "in progress", priority: "high" }, filter), "view filter matches status and priority");
  assert(viewFilterChips(filter).length === 2, "view filter chips render status and priority");
  assert(rowMenuModel({ statuses: ["Todo"], assignees: ["Ada"], labels: ["roadmap"] }).some((section) => section.label === "Copy link"), "context menu includes copy link");
  const catalog = commandCatalog({
    presets: [],
    query: "ow",
    plane: true,
    workspaces: [
      { id: "work", name: "Work", slug: "work" },
      { id: "personal", name: "Personal", slug: "personal" },
    ],
  });
  assert(catalog[0]?.id === "workspace" && catalog[0].rows.length >= 2, "command palette ow lists workspaces");
  const jumps = commandCatalog({ presets: [], query: "", plane: true, workspaces: [] });
  assert(jumps.flatMap((group) => group.rows).some((row) => row.jump.kind === "initiatives"), "command palette includes Initiatives");
  assert(commandCatalog({ presets: [], query: "display" }).flatMap((group) => group.rows).some((row) => row.jump.kind === "display"), "command palette includes Display");
  const timeline = layoutTimeline(
    [{ id: "pulse", label: "Pulse", group: "work", health: "green", start: "2026-01-01", end: "2026-03-01" }],
    "month",
    new Date("2026-02-01T00:00:00Z"),
  );
  assert(timeline.bars.length === 1 && timeline.ticks.length > 0, "timeline view lays out bars and ticks");
  assert(effectiveLayout("initiatives", DEFAULT_DISPLAY, false) === "list", "initiatives default to list");
  assert(effectiveLayout("projects", { ...DEFAULT_DISPLAY, layout: "timeline" }, true) === "timeline", "projects can switch to timeline");
  const sources = sourceOptions({ planeKey: true, jiraBin: false });
  assert(sources.find((source) => source.id === "jira")?.reason?.includes("Fake Jira"), "jira without jira-cli explains Fake Jira");
}

async function main() {
  note("pipe-kan linear parity smoke");
  note("fixture: synthetic Plane work+personal, both contain PULSE");
  pureChecks();
  await boot(process.execPath, ["src/bin.ts", ...FLAGS], "source server");
  const dist = "dist/pipe-kan.js";
  try {
    await import("node:fs").then((fs) => fs.accessSync(dist));
    await boot(process.execPath, [dist, ...FLAGS], "built artifact");
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "ENOENT") {
      note("built artifact: skipped (dist/pipe-kan.js not present)");
    } else {
      throw err;
    }
  }
  note("smoke ok");
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, `${lines.join("\n")}\n`);
}

main().catch((err) => {
  note(`FAIL ${err instanceof Error ? err.message : String(err)}`);
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, `${lines.join("\n")}\n`);
  process.exit(1);
});
