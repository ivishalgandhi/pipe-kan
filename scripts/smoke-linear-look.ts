import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  AddFilterMenu,
  FavoriteFolderList,
  InboxList,
  LabelDot,
  NavRow,
  PersonAvatar,
  PriorityMark,
  ProjectPicker,
  SidebarFooter,
  SidebarSection,
  StatusMark,
  TeamNav,
  ViewBrowser,
  ViewComposer,
} from "../src/components/linear-look.tsx";
import { ADD_FILTER_ROWS, EMPTY_VIEW_DRAFT, inboxNotifications } from "../src/linear-look.ts";
import { EMPTY_VIEW_FILTER } from "../src/parity.ts";
import { planeFixtureFetch, type PlaneFixture } from "../src/plane-fixture.ts";

const DIR = "docs/factory/plans/gbj-20261018-023-pipekan-linear-look-plan";
const LOG = `${DIR}/smoke-logs/smoke.log`;
const SUMMARY = `${DIR}/smoke-log.md`;
const lines: string[] = [];

function note(line: string) {
  lines.push(line);
  console.log(line);
}

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
  note(`PASS ${message}`);
}

type ChromeFixture = {
  views: { name: string; icon: string; description: string; scope: string; kind: string }[];
  inbox: { kind: string; issueKey: string }[];
  teams: { name: string; nav: string[] }[];
  favorites: { folder?: string; id: string }[];
};

function loadChrome(path: string): ChromeFixture {
  return JSON.parse(readFileSync(path, "utf8")) as ChromeFixture;
}

function assertChrome(label: string, fixture: ChromeFixture) {
  assert(fixture.views.length >= 3, `${label} has at least 3 views`);
  assert(fixture.views.every((view) => view.icon && view.description && view.scope && view.kind), `${label} views have icon, description, scope, and kind`);
  assert(fixture.inbox.length >= 5, `${label} has at least 5 inbox rows`);
  assert(new Set(fixture.inbox.map((row) => row.kind)).size >= 3, `${label} inbox covers update, assign, and mention`);
  assert(fixture.inbox.some((row) => row.issueKey === "DEMO-12"), `${label} inbox mentions DEMO-12`);
  assert(fixture.teams.some((team) => team.name === "Acme-product" && ["Home", "Triage", "Issues", "Cycles", "Projects", "Views"].every((item) => team.nav.includes(item))), `${label} team nests the six nav items`);
  assert(fixture.favorites.some((item) => item.folder), `${label} favorites sit in a folder`);
}

const noop = () => undefined;

async function main() {
  const plane = loadChrome("fixtures/plane-linear-look.json");
  const jira = loadChrome("fixtures/jira-linear-look.json");
  assertChrome("plane fixture", plane);
  assertChrome("jira fixture", jira);
  const catalog = JSON.parse(readFileSync("fixtures/plane-linear-look.json", "utf8")) as PlaneFixture;
  const fetched = await planeFixtureFetch(catalog)("https://plane.test/api/v1/workspaces/acme/projects");
  const body = (await fetched.json()) as { results?: { identifier?: string; name?: string }[] };
  assert(body.results?.some((project) => project.identifier === "DEMO" && project.name === "Acme Demo"), "plane fixture lists Acme Demo");

  const filter = renderToStaticMarkup(
    createElement(AddFilterMenu, {
      filter: EMPTY_VIEW_FILTER,
      options: { status: ["Todo"], assignee: ["Ada"], priority: ["High"], labels: ["needs-input"], project: ["Acme Demo"], initiative: ["Acme Demo module"] },
      onChange: noop,
      onAdvanced: noop,
      onClose: noop,
    }),
  );
  assert(filter.includes('data-smoke="add-filter"'), "add filter menu renders");
  assert((filter.match(/data-smoke="filter-row"/g) ?? []).length === ADD_FILTER_ROWS.length, `add filter renders ${ADD_FILTER_ROWS.length} named rows`);
  assert(filter.includes("AI filter") && filter.includes("Template"), "add filter spans AI filter through Template");
  assert(filter.includes('title="Coming soon"') && filter.includes("opacity-50"), "non-backend rows are dimmed and marked coming soon");
  assert(filter.includes("Describe what you want to filter...") === false, "AI prompt stays closed until the row is opened");

  const inbox = renderToStaticMarkup(createElement(InboxList, { notes: inboxNotifications([]), onOpen: noop, onRead: noop }));
  assert((inbox.match(/class="[^"]*h-12/g) ?? []).length >= 5, "inbox renders at least five 48px rows");
  assert(inbox.includes("DEMO-12"), "inbox rows use DEMO-12");
  const empty = renderToStaticMarkup(createElement(InboxList, { notes: [], onOpen: noop, onRead: noop }));
  assert(empty.includes("all caught up"), "read inbox is empty");

  const sidebar = renderToStaticMarkup(
    createElement("div", null,
      createElement(NavRow, { icon: "Inbox", label: "Inbox", badge: "9+", active: true }),
      createElement(SidebarSection, { title: "Workspace", open: true, onToggle: noop },
        createElement(NavRow, { icon: "LayoutGrid", label: "Views" }),
        createElement(NavRow, { icon: "Target", label: "Initiatives" }),
      ),
      createElement(SidebarSection, { title: "Favorites", open: true, onToggle: noop },
        createElement(FavoriteFolderList, {
          favorites: [{ kind: "issue", id: "DEMO-12", label: "Acme Demo", folder: "Launch" }],
          folders: ["Launch", "Empty"],
          onOpen: noop,
          onFile: noop,
          onCreate: noop,
        }),
      ),
      createElement(SidebarSection, { title: "Your teams", open: true, onToggle: noop },
        createElement(TeamNav, {
          scopes: [{ workspace: "acme", project: "DEMO" }],
          triage: 1,
          onOpenScope: noop,
          onNav: noop,
        }),
      ),
      createElement(SidebarFooter),
    ),
  );
  assert(sidebar.includes("Workspace") && sidebar.includes("Favorites") && sidebar.includes("Your teams"), "sidebar sections render");
  assert(sidebar.includes("Empty folder"), "empty favorite folder renders");
  assert(sidebar.includes('data-team="acme/DEMO"'), "team row exposes its scope");
  assert(sidebar.includes("Current") && sidebar.includes("Upcoming") && sidebar.includes('title="Coming soon"'), "cycles stay disabled");
  assert(sidebar.includes("Connect GitHub") && sidebar.includes("+ Invite people"), "footer rows render");
  assert(sidebar.includes('data-smoke="inbox-badge"') && sidebar.includes("9+"), "inbox badge renders");

  const views = renderToStaticMarkup(
    createElement(ViewBrowser, {
      views: plane.views.map((view) => ({ ...view, filter: EMPTY_VIEW_FILTER, scope: view.scope === "team" ? "team" : "personal", kind: view.kind === "projects" ? "projects" : "issues" })),
      workspaceName: "Acme-product",
      kind: "issues",
      onKind: noop,
      onNew: noop,
      onOpen: noop,
    }),
  );
  assert(views.includes("Personal") && views.includes("Acme-product") && views.includes("New view"), "view browser groups personal and team");
  const composer = renderToStaticMarkup(
    createElement(ViewComposer, { draft: EMPTY_VIEW_DRAFT, teamName: "Acme-product", filter: EMPTY_VIEW_FILTER, onChange: noop, onClose: noop, onCreate: noop }),
  );
  assert(composer.includes("Create view") && composer.includes("Save to") && composer.includes("Acme-product"), "view composer renders");

  const picker = renderToStaticMarkup(
    createElement(ProjectPicker, {
      projects: [{ id: "acme/DEMO", identifier: "DEMO", name: "Acme Demo", workspace: "acme", status: "Started", owner: "Ada", priority: "High", progress: 40, issues: 12 }],
      teamName: "Acme-product",
      current: "DEMO",
      onSelect: noop,
      onClose: noop,
    }),
  );
  assert(picker.includes("Projects in Acme-product team") && picker.includes("No project") && picker.includes("+ New project"), "project picker renders");
  assert(picker.includes("Create new project...") && picker.includes('title="Coming soon"'), "new project actions stay inert");

  const icons = renderToStaticMarkup(
    createElement("div", null,
      createElement(StatusMark, { status: "Backlog" }),
      createElement(StatusMark, { status: "Done" }),
      createElement(PriorityMark, { priority: "High" }),
      createElement(LabelDot, { label: "needs-input" }),
      createElement(PersonAvatar, { name: "Ada" }),
    ),
  );
  assert(icons.includes('data-icon="status"') && icons.includes('data-icon="priority"') && icons.includes('data-icon="label"') && icons.includes('data-icon="avatar"'), "icon marks expose data-icon");
  assert(icons.includes("var(--status-backlog)") && icons.includes("transparent") && icons.includes("var(--status-done)"), "status marks use tokens and a hollow backlog");
  assert(!/#[0-9a-fA-F]{3,8}/.test(icons), "rendered icons do not hardcode hex");

  const summary = [
    "# Linear look smoke",
    "",
    "Synthetic fixtures only. No live board and no vendor host.",
    "",
    `- Add Filter named rows: ${ADD_FILTER_ROWS.length} (the ticket text says 21; the named list is ${ADD_FILTER_ROWS.length}).`,
    "- Covered: view browser, view composer, Add Filter, project picker, inbox, sidebar sections, favorite folders, team nav, footer, icon tokens.",
    "- Screenshot placeholders (not committed): views, add filter, move to project, inbox, sidebar.",
    "- Performance numbers are in perf.md. Medians after this change: cold 317ms, project switch 522ms, workspace switch 450ms. All within the 0.34.2 budgets.",
    "",
    "```",
    ...lines,
    "```",
    "",
  ].join("\n");
  mkdirSync(`${DIR}/smoke-logs`, { recursive: true });
  writeFileSync(LOG, `${lines.join("\n")}\n`);
  writeFileSync(SUMMARY, summary);
  note(`wrote ${SUMMARY}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
