import { mkdirSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { TeamNav } from "../src/components/linear-look.tsx";

const DIR = "docs/factory/plans/gbj-20261018-024-pipekan-sidebar-vertical";
const LOG = `${DIR}/smoke-logs/smoke.log`;
const lines: string[] = [];

function note(line: string) {
  lines.push(line);
  console.log(line);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  note(`PASS ${message}`);
}

const MODES = ["All stories", "My issues", "All epics", "Combined", "Calendar"] as const;
const TOP = ["Home", "Triage", "Issues", "Cycles", "Projects", "Views"] as const;

function render(current: { item: string; scope?: string }) {
  return renderToStaticMarkup(
    createElement(TeamNav, {
      scopes: [
        { workspace: "acme", project: "DEMO" },
        { workspace: "acme", project: "OTHER" },
      ],
      triage: 2,
      current,
      mineTitle: "Assigned to you",
      showCycles: true,
      preset: createElement("button", { type: "button" }, "Presets"),
      onOpenScope: () => undefined,
      onNav: () => undefined,
    }),
  );
}

const html = render({ item: "All stories", scope: "acme/DEMO" });
assert(html.includes('role="tree"') && html.includes('data-orientation="vertical"'), "sidebar team list is a vertical tree");
assert(!html.includes("flex-wrap"), "sidebar team list has no horizontal pill row");
assert(html.includes('data-team="acme/DEMO"') && html.includes('data-team="acme/OTHER"'), "each team exposes its scope");
for (const label of TOP) assert(html.includes(`data-mode="${label}"`), `${label} is a nested row`);
assert(html.includes("Current") && html.includes("Upcoming") && !html.includes('data-smoke="cycle-guide"'), "cycles nest Current and Upcoming");
assert(html.includes('data-depth="2"') && html.includes('data-depth="3"'), "nested rows are indented");
assert(!html.includes('title="Coming soon"'), "cycle rows are enabled");
assert(html.includes("Team menu acme/DEMO"), "team row has a menu");
for (const mode of MODES) assert(html.includes(`data-mode="${mode}"`), `${mode} is reachable in the team tree`);
assert(html.includes('data-smoke="team-presets"') && html.includes("Presets"), "presets nest under Views");
assert((html.match(/aria-current="page"/g) ?? []).length === 1, "exactly one selected row");
assert(html.includes('data-mode="All stories" aria-current="page"') || html.includes('aria-current="page"'), "selected row is marked current");

const currentRow = html.match(/data-mode="([^"]+)"[^>]*aria-current="page"|aria-current="page"[^>]*data-mode="([^"]+)"/);
assert(currentRow?.[1] === "All stories" || currentRow?.[2] === "All stories", "All stories is the selected row");

for (const mode of ["My issues", "All epics", "Combined", "Calendar", "Home", "Triage", "Projects", "Views"] as const) {
  const marked = render({ item: mode, scope: "acme/OTHER" });
  const hit = marked.match(/data-mode="([^"]+)"[^>]*aria-current="page"|aria-current="page"[^>]*data-mode="([^"]+)"/);
  assert((hit?.[1] ?? hit?.[2]) === mode, `${mode} can be the only selected row`);
  assert((marked.match(/aria-current="page"/g) ?? []).length === 1, `${mode} does not select a second row`);
}

mkdirSync(`${DIR}/smoke-logs`, { recursive: true });
writeFileSync(LOG, `${lines.join("\n")}\n`);
note(`wrote ${LOG}`);
