import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { accessSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { chromium, type Page } from "playwright";

const DIR = "docs/factory/plans/gbj-20261018-026-pipekan-sidebar-functional-fixes";
const LOG = `${DIR}/smoke-logs/clicks.log`;
const lines: string[] = [];
const noise = /favicon|fonts\.google|fonts\.gstatic|Failed to load resource|net::ERR/i;

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

type Source = "plane" | "jira" | "taskwarrior";

function commandFor(): { command: string; args: string[] } {
  try {
    accessSync("dist/pipe-kan.js");
    return { command: process.execPath, args: ["dist/pipe-kan.js"] };
  } catch {
    return { command: process.execPath, args: ["src/bin.ts"] };
  }
}

async function boot(source: Source): Promise<{ origin: string; child: ChildProcess }> {
  const port = await freePort();
  const spec = commandFor();
  const args = [...spec.args];
  if (source === "plane") args.push("--plane", "--workspaces", "work,personal");
  const child = spawn(spec.command, args, {
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      PATH: "/usr/bin:/bin",
      JIRA_BIN: "jira-missing",
      PLANE_API_KEY: source === "plane" ? "fake" : "",
      PLANE_FIXTURE: source === "plane" ? "synthetic" : "",
      TASKWARRIOR_FIXTURE: source === "taskwarrior" ? "fixtures/taskwarrior.json" : "",
      PIPE_KAN_SMOKE: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let buffer = "";
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`${source} server did not announce\n${buffer}\n${stderr}`));
    }, 20000);
    child.stdout?.on("data", (chunk) => {
      buffer += String(chunk);
      if (buffer.includes("pipe-kan http")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`${source} server exited ${code}\n${buffer}\n${stderr}`));
    });
  });
  return { origin: `http://127.0.0.1:${port}`, child };
}

async function expand(page: Page) {
  for (const name of ["Workspace", "Favorites", "Your teams", "Board"]) {
    const button = page.getByRole("button", { name, exact: true });
    if ((await button.count()) === 0) continue;
    if ((await button.first().getAttribute("aria-expanded")) === "false") await button.first().click();
  }
  const more = page.getByRole("button", { name: "Toggle More" });
  if ((await more.count()) && (await more.first().getAttribute("aria-expanded")) !== "true") {
    await more.first().click();
  }
  for (const name of ["Issues", "Cycles", "Views"]) {
    const toggles = page.getByRole("button", { name: `Toggle ${name}` });
    const count = await toggles.count();
    for (let index = 0; index < count; index += 1) {
      if ((await toggles.nth(index).getAttribute("aria-expanded")) === "false") await toggles.nth(index).click();
    }
  }
}

async function assertAligned(page: Page, source: Source) {
  const groups = await page.evaluate(() => {
    const buckets = new Map<string, { icons: number[]; labels: number[]; counts: number[] }>();
    for (const row of document.querySelectorAll<HTMLElement>("[data-nav-level]")) {
      const level = row.getAttribute("data-nav-level") ?? "";
      const icon = row.querySelector<HTMLElement>("[data-nav-icon]")?.getBoundingClientRect();
      const label = row.querySelector<HTMLElement>("[data-nav-label]")?.getBoundingClientRect();
      const count = row.querySelector<HTMLElement>("[data-nav-count]")?.getBoundingClientRect();
      if (!icon || !label || !count) continue;
      const bucket = buckets.get(level) ?? { icons: [], labels: [], counts: [] };
      bucket.icons.push(icon.x);
      bucket.labels.push(label.x);
      bucket.counts.push(count.right);
      buckets.set(level, bucket);
    }
    return [...buckets.entries()].map(([level, bucket]) => ({ level, ...bucket }));
  });
  assert(groups.length >= 2, `${source} sidebar has at least two row levels`);
  for (const group of groups) {
    const iconSpread = Math.max(...group.icons) - Math.min(...group.icons);
    const labelSpread = Math.max(...group.labels) - Math.min(...group.labels);
    const countSpread = Math.max(...group.counts) - Math.min(...group.counts);
    assert(group.icons.length >= 2, `${source} level ${group.level} has multiple rows`);
    assert(iconSpread <= 1, `${source} level ${group.level} icons share x (${iconSpread.toFixed(2)})`);
    assert(labelSpread <= 1, `${source} level ${group.level} labels share x (${labelSpread.toFixed(2)})`);
    assert(countSpread <= 1, `${source} level ${group.level} counts share right edge (${countSpread.toFixed(2)})`);
  }
}

async function assertRow(page: Page, source: Source, mode: string) {
  const main = page.locator("main");
  if (mode === "Inbox") await main.locator('[data-smoke="inbox"]').waitFor();
  else if (mode === "Pulse") {
    await main.locator('[data-smoke="pulse"]').waitFor();
    if (source === "plane") await main.getByText("Work pulse story").waitFor();
    if (source === "jira") await main.getByText("DEMO-2", { exact: true }).waitFor();
    if (source === "taskwarrior") await main.getByText("TW-1").waitFor();
  } else if (mode === "Agent") await page.locator('[data-smoke="agent-panel"]').waitFor();
  else if (mode === "Projects") await main.locator('[data-smoke="projects"]').waitFor();
  else if (mode === "Views") await main.locator('[data-smoke="view-browser"]').waitFor();
  else if (mode === "Initiatives") await main.locator('[data-smoke="initiatives"]').waitFor();
  else if (mode === "Teams") await main.locator('[data-smoke="teams"]').waitFor();
  else if (mode === "Settings") await main.locator('[data-smoke="settings"]').waitFor();
  else if (mode === "Home") {
    await main.locator('[data-smoke="home-overview"]').waitFor();
    assert((await main.locator('[data-smoke="issue-board"]').count()) === 0, `${source} Home is not the issue board`);
  } else if (mode === "Triage") {
    await page.locator('[data-smoke="ephemeral-filter"]').waitFor();
    const saved = await page.evaluate(() => localStorage.getItem("board-view-filter") ?? "");
    assert(!saved.includes("needs-input"), `${source} Triage does not persist needs-input`);
    if (source === "plane") {
      await main.getByText("Personal pulse story").waitFor();
      assert((await main.getByText("Work pulse story").count()) === 0, "plane Triage hides stories that do not need input");
    }
    if (source === "jira") {
      await main.getByText("DEMO-13", { exact: true }).waitFor();
      assert((await main.getByText("DEMO-2", { exact: true }).count()) === 0, "jira Triage hides DEMO-2");
    }
    if (source === "taskwarrior") {
      await main.getByText("TW-2").waitFor();
      assert((await main.getByText("TW-1").count()) === 0, "taskwarrior Triage hides TW-1");
    }
  } else if (mode === "All stories") {
    assert((await page.locator('[data-smoke="ephemeral-filter"]').count()) === 0, `${source} All stories clears the ephemeral lens`);
    if (source === "plane") await main.getByText("Work pulse story").waitFor();
    if (source === "jira") await main.getByText("DEMO-2", { exact: true }).waitFor();
    if (source === "taskwarrior") await main.getByText("TW-1").waitFor();
  } else if (mode === "My issues" || mode === "All epics" || mode === "Combined" || mode === "Calendar") {
    await page.locator('[data-smoke="breadcrumb"]').waitFor();
    await page.getByText(mode, { exact: true }).first().waitFor();
  } else if (mode === "Current" || mode === "Upcoming") {
    await main.locator('[data-smoke="cycles"]').waitFor();
    if (mode === "Current") await main.getByText("Current cycle").waitFor();
    if (mode === "Upcoming") await main.getByText("Upcoming cycle").waitFor();
  }
}

async function exercise(page: Page, source: Source, ready: string, errors: string[]) {
  note(`-- ${source}`);
  await page.getByText(ready).first().waitFor({ timeout: 20000 });
  if (source === "taskwarrior") await page.getByText("Tasks", { exact: true }).first().waitFor();
  if (source === "plane") await page.getByText("Work", { exact: true }).first().waitFor();
  await expand(page);
  await assertAligned(page, source);
  if (source !== "plane") {
    assert((await page.locator('[data-mode="Cycles"]').count()) === 0, `${source} hides Cycles`);
    assert((await page.locator('[data-mode="Initiatives"]').count()) === 0, `${source} hides Initiatives`);
    assert((await page.locator('[data-mode="Projects"]').count()) === 0, `${source} hides Projects`);
  } else {
    assert((await page.locator('[data-mode="Cycles"]').count()) > 0, "plane shows Cycles");
    await page.locator('[data-smoke="scope-chip"]').waitFor();
    assert((await page.locator('[data-smoke="scope-chip"]').innerText()).includes("All projects"), "plane scope chip is the whole workspace");
  }
  const ids = await page.locator("[data-nav-level]").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-nav-id") ?? "").filter(Boolean),
  );
  assert(ids.length > 8, `${source} sidebar exposes its rows`);
  for (const id of ids) {
    const mode = id.includes(":") ? id.slice(id.indexOf(":") + 1) : id;
    if (mode === "More") continue;
    const row = page.locator(`[data-nav-id="${id.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`);
    const teamHeader = (await row.locator("button[data-team]").count()) > 0;
    await row.locator("button").first().click();
    if (teamHeader) {
      assert(
        (await page.locator('[data-smoke="scope-chip"]').innerText()).includes("All projects"),
        `${source} team click keeps every project`,
      );
    }
    await assertRow(page, source, mode);
    note(`PASS ${source} clicked ${id}`);
  }
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  });
  await page.keyboard.press("g");
  await page.keyboard.press("i");
  await page.locator('[data-smoke="inbox"]').waitFor();
  note(`PASS ${source} G then I opens Inbox`);
  await page.keyboard.press("Control+k");
  await page.getByPlaceholder("Jump to Epic, Card, or Action").waitFor();
  await page.keyboard.press("Escape");
  note(`PASS ${source} Ctrl+K opens the command overlay`);
  const workspaceSection = page.getByRole("button", { name: "Workspace", exact: true });
  await workspaceSection.click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await workspaceSection.waitFor();
  assert((await workspaceSection.getAttribute("aria-expanded")) === "false", `${source} collapsed Workspace stays collapsed`);
  assert(errors.length === 0, `${source} console stayed quiet${errors.length ? `: ${errors.join(" | ")}` : ""}`);
}

async function runSource(source: Source, ready: string) {
  const { origin, child } = await boot(source);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.setDefaultTimeout(15000);
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !noise.test(message.text())) errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await exercise(page, source, ready, errors);
  } finally {
    await browser.close();
    child.kill("SIGTERM");
    await new Promise((resolve) => child.once("exit", resolve));
  }
}

async function main() {
  note("pipe-kan sidebar click smoke");
  try {
    accessSync("dist/ui/index.html");
  } catch {
    throw new Error("dist/ui is missing. Run bun run build before this smoke.");
  }
  await runSource("plane", "Work pulse story");
  await runSource("jira", "DEMO-2");
  await runSource("taskwarrior", "TW-1");
  note("sidebar click smoke ok");
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, `${lines.join("\n")}\n`);
}

main().catch((err) => {
  note(`FAIL ${err instanceof Error ? err.message : String(err)}`);
  mkdirSync(dirname(LOG), { recursive: true });
  writeFileSync(LOG, `${lines.join("\n")}\n`);
  process.exit(1);
});
