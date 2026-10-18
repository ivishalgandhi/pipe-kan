import { useState, type ReactNode } from "react";
import { CheckIcon, StarIcon } from "lucide-react";

import { PriorityMark, StatusMark } from "~/components/linear-look.tsx";
import { cn } from "~/lib/utils";
import {
  HEALTH_COLOR,
  classifyHealth,
  groupRows,
  healthLabel,
  healthTone,
  initiativeGroup,
  orderRows,
  projectGroup,
  readJson,
  writeJson,
  type DisplayOptions,
  type Health,
  type Layout,
  type LinearFavorite,
  type ParityInitiative,
  type ParityProject,
} from "~/parity.ts";

const UPDATES_KEY = "linear-parity-updates";
const SCHEDULE_KEY = "linear-parity-update-schedule";

type UpdateNote = { body: string; health: Health; at: string };
type RoadTab = "active" | "planned" | "completed" | "all";

function statusTab(status: string): Exclude<RoadTab, "all"> {
  const value = status.toLowerCase();
  if (value.includes("done") || value.includes("complete") || value.includes("cancel")) return "completed";
  if (value.includes("progress") || value.includes("paused") || value.includes("active")) return "active";
  return "planned";
}

function HealthMark({ health, status, target }: { health: Health; status?: string; target?: string }) {
  const label = status ? classifyHealth(status, target) : healthLabel(health);
  const tone = status ? healthTone(classifyHealth(status, target)) : health;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: HEALTH_COLOR[tone] }} />
      <span>{label}</span>
    </span>
  );
}

function roadColumns(properties: string[] | undefined) {
  const shown = (name: string) => !properties || properties.includes(name);
  return {
    owner: shown("Assignee"),
    target: shown("Target date"),
    health: shown("Health"),
    projects: shown("Project"),
    active: shown("Project"),
  };
}

function roadTemplate(columns: ReturnType<typeof roadColumns>) {
  return [
    "minmax(0,1.5fr)",
    columns.owner ? "64px" : "",
    columns.target ? "88px" : "",
    columns.health ? "132px" : "",
    columns.projects ? "88px" : "",
    columns.active ? "120px" : "",
    "28px",
  ]
    .filter(Boolean)
    .join(" ");
}

function targetLabel(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function OwnerCell() {
  return (
    <span className="bg-muted text-muted-foreground inline-flex size-5 items-center justify-center rounded-full text-[10px]" title="No owner">
      —
    </span>
  );
}

function Star({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on}
      className="text-muted-foreground hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    >
      <StarIcon className={cn("size-3.5", on && "fill-current")} />
    </button>
  );
}

function RoadTabs({ tab, onTab, noun }: { tab: RoadTab; onTab: (tab: RoadTab) => void; noun: string }) {
  const tabs: { id: RoadTab; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "planned", label: "Planned" },
    { id: "completed", label: "Completed" },
    { id: "all", label: noun === "initiative" ? "All initiatives" : "All" },
  ];
  return (
    <div className="flex items-center gap-1 px-2 pb-2">
      {tabs.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={tab === item.id}
          className={cn(
            "h-7 rounded-lg px-2 text-[13px]",
            tab === item.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60",
          )}
          onClick={() => onTab(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ColumnHead({ columns, template }: { columns: ReturnType<typeof roadColumns>; template: string }) {
  return (
    <div className="text-muted-foreground grid items-center gap-2 px-2 py-1 text-[11px] font-medium" style={{ gridTemplateColumns: template }}>
      <span>Name</span>
      {columns.owner ? <span>Owner</span> : null}
      {columns.target ? <span>Target</span> : null}
      {columns.health ? <span>Health</span> : null}
      {columns.projects ? <span>Projects</span> : null}
      {columns.active ? <span>Active projects</span> : null}
      <span />
    </div>
  );
}

function ActiveMarks({ count }: { count: number }) {
  const shown = Math.max(0, Math.min(count, 4));
  if (!shown) return <span className="text-muted-foreground text-[12px]">—</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: shown }, (_, index) => (
        <span key={index} className="bg-primary/70 inline-block size-2 rounded-[2px]" />
      ))}
    </span>
  );
}

export function RoadmapTable({
  kind,
  initiatives,
  projects,
  display,
  layout,
  favorites,
  onOpenInitiative,
  onOpenProject,
  onContext,
  onToggleFavorite,
}: {
  kind: "initiatives" | "projects";
  initiatives: ParityInitiative[];
  projects: ParityProject[];
  display: DisplayOptions;
  layout: Layout;
  favorites: LinearFavorite[];
  onOpenInitiative: (key: string) => void;
  onOpenProject: (row: ParityProject) => void;
  onContext: (event: { clientX: number; clientY: number; preventDefault: () => void }, key: string, kind: "initiative" | "project") => void;
  onToggleFavorite: (item: LinearFavorite) => void;
}) {
  const [tab, setTab] = useState<RoadTab>("all");
  const [inspected, setInspected] = useState<string | null>(null);
  const [schedule, setSchedule] = useState(false);
  const initiativeName = new Map(initiatives.map((row) => [`${row.workspace}/${row.project}`, row.name]));
  const columns = roadColumns(display.properties);
  const template = roadTemplate(columns);

  if (schedule) {
    return <UpdateSchedule onClose={() => setSchedule(false)} />;
  }

  if (kind === "initiatives" && inspected) {
    const row = initiatives.find((item) => item.key === inspected);
    if (row) {
      return (
        <InitiativeOverview
          row={row}
          onBack={() => setInspected(null)}
          onOpenIssues={() => onOpenInitiative(row.key)}
        />
      );
    }
  }

  if (kind === "projects" && inspected) {
    const row = projects.find((item) => `${item.workspace}/${item.identifier}` === inspected);
    if (row) {
      return (
        <ProjectOverview
          row={row}
          initiative={initiativeName.get(`${row.workspace}/${row.identifier}`)}
          onBack={() => setInspected(null)}
          onSchedule={() => setSchedule(true)}
          onOpenIssues={() => onOpenProject(row)}
        />
      );
    }
  }

  if (kind === "projects") {
    const rows = orderRows(projects, display.ordering, (row) => ({
      status: row.status,
      updated: row.updated,
      target: row.targetDate,
    })).filter((row) => tab === "all" || statusTab(row.status) === tab);
    if (layout === "board") {
      const groups = groupRows(
        rows,
        (row) => projectGroup(row, display.grouping, initiativeName.get(`${row.workspace}/${row.identifier}`)),
        display.showEmptyGroups,
        display.grouping === "status" ? ["backlog", "in_progress", "done"] : [],
      );
      return (
        <div data-smoke="projects">
          <RoadTabs tab={tab} onTab={setTab} noun="project" />
          <div className="flex items-start gap-3">
            {groups.map((group) => (
              <section key={group.key} className="bg-muted/40 w-72 shrink-0 rounded-lg p-2">
                <h3 className="text-muted-foreground px-2 py-1 text-[11px] font-medium">{group.key}</h3>
                {group.rows.map((row) => (
                  <TableRowButton
                    key={`${row.workspace}/${row.id}`}
                    template={template}
                    onClick={() => setInspected(`${row.workspace}/${row.identifier}`)}
                    onContext={(event) => onContext(event, `${row.workspace}/${row.identifier}`, "project")}
                  >
                    <ProjectCells
                      row={row}
                      columns={columns}
                      favorite={favorites.some((item) => item.kind === "project" && item.id === `${row.workspace}/${row.identifier}`)}
                      onToggleFavorite={() =>
                        onToggleFavorite({ kind: "project", id: `${row.workspace}/${row.identifier}`, label: row.name })
                      }
                    />
                  </TableRowButton>
                ))}
              </section>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div data-smoke="projects">
        <RoadTabs tab={tab} onTab={setTab} noun="project" />
        <ColumnHead columns={columns} template={template} />
        {rows.map((row) => (
          <TableRowButton
            key={`${row.workspace}/${row.id}`}
            template={template}
            onClick={() => setInspected(`${row.workspace}/${row.identifier}`)}
            onContext={(event) => onContext(event, `${row.workspace}/${row.identifier}`, "project")}
          >
            <ProjectCells
              row={row}
              columns={columns}
              favorite={favorites.some((item) => item.kind === "project" && item.id === `${row.workspace}/${row.identifier}`)}
              onToggleFavorite={() =>
                onToggleFavorite({ kind: "project", id: `${row.workspace}/${row.identifier}`, label: row.name })
              }
            />
          </TableRowButton>
        ))}
      </div>
    );
  }

  const rows = orderRows(initiatives, display.ordering, (row) => ({
    status: row.status,
    priority: row.priority,
    updated: row.updated,
    target: row.targetDate,
  })).filter((row) => tab === "all" || statusTab(row.status) === tab);

  if (layout === "board") {
    const groups = groupRows(
      rows,
      (row) => initiativeGroup(row, display.grouping),
      display.showEmptyGroups,
      display.grouping === "status" ? ["Backlog", "Planned", "In Progress", "Done", "Cancelled"] : [],
    );
    return (
      <div className="flex items-start gap-3" data-smoke="initiatives">
        {groups.map((group) => (
          <section key={group.key} className="bg-muted/40 w-80 shrink-0 rounded-lg p-2">
            <h3 className="text-muted-foreground px-2 py-1 text-[11px] font-medium">{group.key}</h3>
            {group.rows.map((row) => (
              <TableRowButton
                key={row.key}
                template={template}
                onClick={() => setInspected(row.key)}
                onContext={(event) => onContext(event, row.key, "initiative")}
              >
                <InitiativeCells
                  row={row}
                  columns={columns}
                  favorite={favorites.some((item) => item.kind === "initiative" && item.id === row.key)}
                  onToggleFavorite={() => onToggleFavorite({ kind: "initiative", id: row.key, label: row.name })}
                />
              </TableRowButton>
            ))}
          </section>
        ))}
      </div>
    );
  }

  const nested = display.showSubIssues !== false;
  const byProject = new Map<string, ParityInitiative[]>();
  for (const row of rows) {
    const key = nested ? `${row.workspace}/${row.project}` : row.key;
    const list = byProject.get(key) ?? [];
    list.push(row);
    byProject.set(key, list);
  }

  return (
    <div data-smoke="initiatives">
      <RoadTabs tab={tab} onTab={setTab} noun="initiative" />
      <ColumnHead columns={columns} template={template} />
      {[...byProject.entries()].map(([projectKey, list]) => (
        <div key={projectKey}>
          {nested && list.length > 1 ? (
            <div className="text-muted-foreground px-2 pt-2 text-[12px] font-medium">{list[0]?.project}</div>
          ) : null}
          {list.map((row, index) => (
            <TableRowButton
              key={row.key}
              template={template}
              className={nested && list.length > 1 && index > 0 ? "pl-6" : undefined}
              onClick={() => setInspected(row.key)}
              onContext={(event) => onContext(event, row.key, "initiative")}
            >
              <InitiativeCells
                row={row}
                columns={columns}
                favorite={favorites.some((item) => item.kind === "initiative" && item.id === row.key)}
                onToggleFavorite={() => onToggleFavorite({ kind: "initiative", id: row.key, label: row.name })}
              />
            </TableRowButton>
          ))}
        </div>
      ))}
    </div>
  );
}

function TableRowButton({
  children,
  className,
  template,
  onClick,
  onContext,
}: {
  children: ReactNode;
  className?: string;
  template: string;
  onClick: () => void;
  onContext: (event: { clientX: number; clientY: number; preventDefault: () => void }) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "hover:bg-muted grid w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px]",
        className,
      )}
      style={{ gridTemplateColumns: template }}
      onClick={onClick}
      onContextMenu={(event) => onContext(event)}
    >
      {children}
    </button>
  );
}

function InitiativeCells({
  row,
  favorite,
  columns,
  onToggleFavorite,
}: {
  row: ParityInitiative;
  favorite: boolean;
  columns: ReturnType<typeof roadColumns>;
  onToggleFavorite: () => void;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <StatusMark status={row.status} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="text-muted-foreground flex items-center gap-1 truncate text-[11px]">
            {row.priority ? <PriorityMark priority={row.priority} /> : null}
            {row.project}
          </span>
        </span>
      </span>
      {columns.owner ? <OwnerCell /> : null}
      {columns.target ? <span className="text-muted-foreground truncate text-[12px]">{targetLabel(row.targetDate)}</span> : null}
      {columns.health ? <HealthMark health={row.health} status={row.status} target={row.targetDate} /> : null}
      {columns.projects ? <span className="text-muted-foreground tabular-nums">{row.activeProjects ? "1/1" : "0/1"}</span> : null}
      {columns.active ? <ActiveMarks count={row.activeProjects} /> : null}
      <Star on={favorite} label={`Favorite ${row.name}`} onToggle={onToggleFavorite} />
    </>
  );
}

function ProjectCells({
  row,
  favorite,
  columns,
  onToggleFavorite,
}: {
  row: ParityProject;
  favorite: boolean;
  columns: ReturnType<typeof roadColumns>;
  onToggleFavorite: () => void;
}) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <StatusMark status={row.status} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{row.name}</span>
          <span className="text-muted-foreground block truncate text-[11px]">{row.identifier}</span>
        </span>
      </span>
      {columns.owner ? <OwnerCell /> : null}
      {columns.target ? <span className="text-muted-foreground truncate text-[12px]">{targetLabel(row.targetDate)}</span> : null}
      {columns.health ? <HealthMark health={row.health} status={row.status} target={row.targetDate} /> : null}
      {columns.projects ? (
        <span className="text-muted-foreground tabular-nums">
          {row.completed}/{row.total}
        </span>
      ) : null}
      {columns.active ? <ActiveMarks count={row.total - row.completed} /> : null}
      <Star on={favorite} label={`Favorite ${row.name}`} onToggle={onToggleFavorite} />
    </>
  );
}

function ProgressGraph({ health, start, end }: { health: Health; start?: string; end?: string }) {
  return (
    <section className="max-w-xl py-4">
      <h2 className="pb-2 text-[13px] font-medium">Progress</h2>
      <svg viewBox="0 0 320 88" className="h-24 w-full" role="img" aria-label="Progress">
        <polyline
          points="0,72 40,68 80,60 120,58 160,46 200,34 240,28 280,18 320,14"
          fill="none"
          stroke={HEALTH_COLOR[health]}
          strokeWidth="2"
        />
      </svg>
      <div className="text-muted-foreground flex justify-between text-[11px]">
        <span>{targetLabel(start)}</span>
        <span>{targetLabel(end)}</span>
      </div>
    </section>
  );
}

function UpdateComposer({
  id,
  health,
}: {
  id: string;
  health: Health;
}) {
  const [notes, setNotes] = useState<Record<string, UpdateNote>>(() => readJson(UPDATES_KEY, {}));
  const [body, setBody] = useState("");
  const [picked, setPicked] = useState<Health>(health === "gray" ? "green" : health);
  const note = notes[id];
  function post() {
    const text = body.trim();
    if (!text) return;
    const next = { ...notes, [id]: { body: text, health: picked, at: new Date().toISOString() } };
    setNotes(next);
    writeJson(UPDATES_KEY, next);
    setBody("");
  }
  return (
    <section className="flex max-w-2xl flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-1">
        {(
          [
            ["green", "On track"],
            ["yellow", "At risk"],
            ["red", "Off track"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={picked === value}
            className={cn("h-7 rounded-lg px-2 text-[12px]", picked === value ? "bg-muted" : "text-muted-foreground")}
            onClick={() => setPicked(value)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="text-muted-foreground ml-auto h-7 px-2 text-[12px]" onClick={() => setBody("")}>
          Cancel
        </button>
        <button type="button" className="bg-primary text-primary-foreground h-7 rounded-lg px-2 text-[12px]" onClick={post}>
          Post update
        </button>
      </div>
      <textarea
        aria-label="Write update"
        className="bg-muted min-h-24 rounded-lg px-3 py-2 text-[13px] outline-none"
        placeholder="Write update"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      {note ? (
        <article className="rounded-lg border border-[var(--bg-border-color)] px-3 py-2 text-[13px]">
          <div className="text-muted-foreground pb-1 text-[12px]">
            <HealthMark health={note.health} />
            <span> · {note.at.slice(0, 10)}</span>
          </div>
          <p>{note.body}</p>
        </article>
      ) : (
        <p className="text-muted-foreground text-[12px]">No updates yet</p>
      )}
    </section>
  );
}

export function InitiativeOverview({
  row,
  onBack,
  onOpenIssues,
}: {
  row: ParityInitiative;
  onBack: () => void;
  onOpenIssues: () => void;
}) {
  return (
    <div className="flex flex-col px-3" data-smoke="initiative-overview">
      <div className="flex items-center gap-2 py-2">
        <button type="button" className="text-muted-foreground text-[12px]" onClick={onBack}>
          Initiatives
        </button>
        <h1 className="text-[18px] font-medium">{row.name}</h1>
        <button type="button" className="bg-muted ml-auto h-7 rounded-lg px-2 text-[12px]" onClick={onOpenIssues}>
          Open issues
        </button>
      </div>
      <p className="text-muted-foreground text-[13px]">{row.project} · {row.status}</p>
      <div className="flex flex-wrap gap-6 py-3 text-[13px]">
        <div>
          <div className="text-muted-foreground text-[11px]">Initiative health</div>
          <HealthMark health={row.health} status={row.status} target={row.targetDate} />
        </div>
        <div>
          <div className="text-muted-foreground text-[11px]">Projects</div>
          <div>{row.activeProjects ? "1/1" : "0/1"}</div>
        </div>
        <div>
          <div className="text-muted-foreground text-[11px]">Active projects</div>
          <ActiveMarks count={row.activeProjects} />
        </div>
        <div>
          <div className="text-muted-foreground text-[11px]">Target</div>
          <div>{targetLabel(row.targetDate)}</div>
        </div>
      </div>
      <ProgressGraph health={row.health} start={row.startDate} end={row.targetDate} />
      <h2 className="text-[13px] font-medium">Latest update</h2>
      <UpdateComposer id={row.key} health={row.health} />
    </div>
  );
}

export function ProjectOverview({
  row,
  initiative,
  onBack,
  onSchedule,
  onOpenIssues,
}: {
  row: ParityProject;
  initiative?: string;
  onBack: () => void;
  onSchedule: () => void;
  onOpenIssues: () => void;
}) {
  return (
    <div className="flex flex-col px-3" data-smoke="project-overview">
      <div className="flex items-center gap-2 py-2">
        <button type="button" className="text-muted-foreground text-[12px]" onClick={onBack}>
          Projects
        </button>
        <h1 className="text-[18px] font-medium">{row.name}</h1>
        <button type="button" className="bg-muted ml-auto h-7 rounded-lg px-2 text-[12px]" onClick={onOpenIssues}>
          Open issues
        </button>
      </div>
      <p className="text-muted-foreground max-w-2xl text-[13px]">
        {row.identifier} in {row.workspace}. Status {row.status}. {row.completed} of {row.total} completed.
      </p>
      <div className="flex flex-wrap gap-4 py-3 text-[13px]">
        <span className="bg-muted rounded-lg px-2 py-1">{row.status}</span>
        <HealthMark health={row.health} status={row.status} target={row.targetDate} />
        <span>{targetLabel(row.startDate)} – {targetLabel(row.targetDate)}</span>
        <button type="button" className="text-muted-foreground underline" onClick={onSchedule}>
          Update schedule
        </button>
      </div>
      <section className="py-1 text-[13px]">
        <h2 className="text-muted-foreground text-[11px] font-medium">Initiatives</h2>
        <p>{initiative ?? "None"}</p>
      </section>
      <section className="py-1 text-[13px]">
        <h2 className="text-muted-foreground text-[11px] font-medium">Labels</h2>
        <p className="text-muted-foreground">None</p>
      </section>
      <section className="py-1 text-[13px]">
        <h2 className="text-muted-foreground text-[11px] font-medium">Resources</h2>
        <p className="text-muted-foreground">Add document or link</p>
      </section>
      <section className="py-1 text-[13px]">
        <h2 className="text-muted-foreground text-[11px] font-medium">Customers</h2>
        <p className="text-muted-foreground">Add customer request</p>
      </section>
      <h2 className="pt-3 text-[13px] font-medium">Latest update</h2>
      <UpdateComposer id={`${row.workspace}/${row.identifier}`} health={row.health} />
    </div>
  );
}

export function TeamsPage({
  projects,
  onOpen,
}: {
  projects: ParityProject[];
  onOpen: (row: ParityProject) => void;
}) {
  return (
    <div className="px-3" data-smoke="teams">
      <h1 className="py-3 text-[18px] font-medium">Teams</h1>
      <div className="text-muted-foreground grid grid-cols-[minmax(0,1.4fr)_120px_120px] gap-2 px-2 py-1 text-[11px] font-medium">
        <span>Name</span>
        <span>Membership</span>
        <span>Identifier</span>
      </div>
      {projects.map((row) => (
        <button
          key={`${row.workspace}/${row.id}`}
          type="button"
          className="hover:bg-muted grid w-full grid-cols-[minmax(0,1.4fr)_120px_120px] gap-2 rounded-md px-2 py-2 text-left text-[13px]"
          onClick={() => onOpen(row)}
        >
          <span className="truncate font-medium">{row.name}</span>
          <span>Joined</span>
          <span className="text-muted-foreground">{row.identifier}</span>
        </button>
      ))}
    </div>
  );
}

export function TeamHome({
  project,
  onSchedule,
  onBack,
}: {
  project: ParityProject;
  onSchedule: () => void;
  onBack: () => void;
}) {
  return (
    <div className="px-3" data-smoke="team-home">
      <button type="button" className="text-muted-foreground py-2 text-[12px]" onClick={onBack}>
        Teams
      </button>
      <h1 className="text-[18px] font-medium">{project.name}</h1>
      <div className="text-muted-foreground flex gap-3 py-2 text-[13px]">
        <span>Overview</span>
        <span>Documents</span>
        <span>Members</span>
      </div>
      <p className="max-w-xl text-[13px]">Main team for projects and intake in {project.workspace}.</p>
      <section className="py-3">
        <h2 className="text-[13px] font-medium">Pinned resources</h2>
        <p className="text-muted-foreground text-[13px]">Team sync notes</p>
      </section>
      <section className="py-1">
        <h2 className="text-[13px] font-medium">Processes</h2>
        <p className="text-muted-foreground text-[13px]">Triage · Issues · Projects</p>
      </section>
      <button type="button" className="bg-muted mt-3 h-7 rounded-lg px-2 text-[12px]" onClick={onSchedule}>
        Update schedule
      </button>
    </div>
  );
}

export function HomeOverview({
  scope,
  issues,
  epics,
  needsInput,
  recent,
  onOpen,
}: {
  scope: string;
  issues: number;
  epics: number;
  needsInput: number;
  recent: { key: string; summary: string }[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3 px-3 py-3" data-smoke="home-overview">
      <h1 className="text-[18px] font-medium">Home</h1>
      <p className="text-muted-foreground text-[13px]">Overview for {scope}.</p>
      <div className="grid max-w-xl grid-cols-3 gap-2">
        <OverviewStat label="Issues" value={issues} />
        <OverviewStat label="Epics" value={epics} />
        <OverviewStat label="Needs input" value={needsInput} />
      </div>
      <section>
        <h2 className="py-1 text-[13px] font-medium">Recent</h2>
        {recent.length ? (
          <ul className="flex flex-col">
            {recent.map((row) => (
              <li key={row.key}>
                <button type="button" className="hover:bg-muted flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]" onClick={() => onOpen(row.key)}>
                  <span className="text-muted-foreground w-24 shrink-0 truncate">{row.key}</span>
                  <span className="truncate">{row.summary}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-[13px]">No issues in this scope.</p>
        )}
      </section>
    </div>
  );
}

function OverviewStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-[var(--border)] px-3 py-2">
      <div className="text-muted-foreground text-[11px]">{label}</div>
      <div className="text-[18px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

export function PulseFeed({
  rows,
  onOpen,
}: {
  rows: { key: string; summary: string; detail: string }[];
  onOpen: (key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1 px-3 py-3" data-smoke="pulse">
      <h1 className="text-[18px] font-medium">Pulse</h1>
      <p className="text-muted-foreground pb-2 text-[13px]">Recent updates in this scope.</p>
      {rows.length ? (
        rows.map((row) => (
          <button
            key={row.key}
            type="button"
            className="hover:bg-muted flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]"
            onClick={() => onOpen(row.key)}
          >
            <span className="w-28 shrink-0 truncate font-medium">{row.key}</span>
            <span className="min-w-0 flex-1 truncate">{row.summary}</span>
            <span className="text-muted-foreground shrink-0 text-[12px]">{row.detail}</span>
          </button>
        ))
      ) : (
        <p className="text-muted-foreground text-[13px]">No recent updates.</p>
      )}
    </div>
  );
}

export function CycleList({
  phase,
  cycles,
  onOpen,
}: {
  phase: "current" | "upcoming";
  cycles: { id: string; name: string; start_date?: string; end_date?: string }[];
  onOpen: (key: string) => void;
}) {
  const title = phase === "current" ? "Current" : "Upcoming";
  return (
    <div className="flex flex-col gap-2 px-3 py-3" data-smoke="cycles" data-cycle-phase={phase}>
      <h1 className="text-[18px] font-medium">{title}</h1>
      {cycles.length ? (
        <ul className="flex flex-col">
          {cycles.map((cycle) => (
            <li key={cycle.id}>
              <button type="button" className="hover:bg-muted flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]" onClick={() => onOpen(cycle.id)}>
                <span className="min-w-0 flex-1 truncate font-medium">{cycle.name}</span>
                <span className="text-muted-foreground text-[12px]">
                  {[cycle.start_date, cycle.end_date].filter(Boolean).join(" – ") || "No dates"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground text-[13px]">No {title.toLowerCase()} cycles.</p>
      )}
    </div>
  );
}

export function SettingsPage({
  scope,
  theme,
  viewer,
  onTheme,
  onViewer,
}: {
  scope: string;
  theme: "light" | "dark";
  viewer: string;
  onTheme: () => void;
  onViewer: (name: string) => void;
}) {
  return (
    <div className="flex max-w-md flex-col gap-3 px-3 py-3" data-smoke="settings">
      <h1 className="text-[18px] font-medium">Settings</h1>
      <p className="text-muted-foreground text-[13px]">Scope is {scope}. Display options stay on Shift+V.</p>
      <label className="flex items-center gap-2 text-[13px]">
        Viewer
        <input
          aria-label="Viewer name"
          className="bg-muted h-7 flex-1 rounded px-2"
          value={viewer}
          onChange={(event) => onViewer(event.target.value)}
        />
      </label>
      <button type="button" className="bg-muted h-7 w-fit rounded-lg px-2 text-[13px]" onClick={onTheme}>
        Theme: {theme}
      </button>
    </div>
  );
}

export function UpdateSchedule({ onClose }: { onClose: () => void }) {
  const stored = readJson<{ mode: "default" | "custom" | "never"; frequency: string; day: string; time: string }>(SCHEDULE_KEY, {
    mode: "default",
    frequency: "Every week",
    day: "Monday",
    time: "11:00 - 12:00",
  });
  const [mode, setMode] = useState(stored.mode);
  const [frequency, setFrequency] = useState(stored.frequency);
  const [day, setDay] = useState(stored.day);
  const [time, setTime] = useState(stored.time);
  function save(next: typeof stored) {
    writeJson(SCHEDULE_KEY, next);
  }
  return (
    <div className="max-w-md px-3 py-3" data-smoke="update-schedule">
      <div className="flex items-center gap-2">
        <h1 className="text-[16px] font-medium">Update schedule</h1>
        <button type="button" className="text-muted-foreground ml-auto text-[12px]" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="text-muted-foreground py-2 text-[13px]">Configure how often updates are expected on this project.</p>
      <label className="flex items-center gap-2 py-1 text-[13px]">
        <input
          type="radio"
          name="schedule"
          checked={mode === "default"}
          onChange={() => {
            setMode("default");
            save({ mode: "default", frequency, day, time });
          }}
        />
        Default
      </label>
      <p className="text-muted-foreground pl-6 text-[12px]">Every week on Monday 11am - 12 pm</p>
      <label className="flex items-center gap-2 py-1 text-[13px]">
        <input
          type="radio"
          name="schedule"
          checked={mode === "custom"}
          onChange={() => {
            setMode("custom");
            save({ mode: "custom", frequency, day, time });
          }}
        />
        Custom schedule
      </label>
      {mode === "custom" ? (
        <div className="flex flex-col gap-2 pl-6 text-[13px]">
          <label className="flex items-center gap-2">
            Frequency
            <select
              aria-label="Frequency"
              className="bg-muted h-7 rounded px-2"
              value={frequency}
              onChange={(event) => {
                setFrequency(event.target.value);
                save({ mode, frequency: event.target.value, day, time });
              }}
            >
              <option>Every week</option>
              <option>Every 2 weeks</option>
              <option>Every month</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            Day
            <select
              aria-label="Day"
              className="bg-muted h-7 rounded px-2"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                save({ mode, frequency, day: event.target.value, time });
              }}
            >
              {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            Time
            <input
              aria-label="Time"
              className="bg-muted h-7 rounded px-2"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                save({ mode, frequency, day, time: event.target.value });
              }}
            />
          </label>
        </div>
      ) : null}
      <label className="flex items-center gap-2 py-1 text-[13px]">
        <input
          type="radio"
          name="schedule"
          checked={mode === "never"}
          onChange={() => {
            setMode("never");
            save({ mode: "never", frequency, day, time });
          }}
        />
        Never
      </label>
    </div>
  );
}
