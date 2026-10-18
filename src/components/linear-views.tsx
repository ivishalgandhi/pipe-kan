import { useState, type ReactNode } from "react";
import { workspacesEmptyMessage } from "~/command.ts";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, StarIcon } from "lucide-react";

import type { Card } from "~/board.ts";
import {
  DISPLAY_KEY,
  EMPTY_VIEW_FILTER,
  HEALTH_COLOR,
  LINEAR_FAVORITES_KEY,
  SAVED_VIEWS_KEY,
  VIEW_FILTER_KEY,
  HEALTH_FILTERS,
  effectiveLayout,
  filterParity,
  healthLabel,
  initiativeGroup,
  layoutTimeline,
  orderRows,
  projectGroup,
  readJson,
  toggleLinearFavorite,
  viewFilterChips,
  writeJson,
  type DisplayOptions,
  type Grouping,
  type Health,
  type Layout,
  type LinearFavorite,
  type Opener,
  type Ordering,
  type ParityInitiative,
  type ParityProject,
  type SavedView,
  type ScopePair,
  type SourceId,
  type SourceOption,
  type ViewFilter,
  type Zoom,
} from "~/parity.ts";
import { RoadmapTable } from "~/components/linear-chrome.tsx";
import { StatusMark } from "~/components/linear-look.tsx";
import { rowMenuModel, type RowMenuAction, type RowMenuSection } from "~/row-menu.ts";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";

export { effectiveLayout, DISPLAY_KEY, EMPTY_VIEW_FILTER, LINEAR_FAVORITES_KEY, SAVED_VIEWS_KEY, VIEW_FILTER_KEY, readJson, writeJson, toggleLinearFavorite };

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function HealthDot({ health }: { health: Health }) {
  return (
    <span
      className="inline-block size-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: HEALTH_COLOR[health] }}
      title={healthLabel(health)}
      aria-label={healthLabel(health)}
    />
  );
}

export type CatalogProject = { id: string; identifier: string; name: string; workspace: string };

function MenuRow({ label, shortcut, onClick }: { label: string; shortcut?: string; onClick?: () => void }) {
  return (
    <button type="button" className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]" onClick={onClick}>
      <span className="flex-1">{label}</span>
      {shortcut ? <span className="text-muted-foreground text-[11px]">{shortcut}</span> : null}
    </button>
  );
}

export function ScopeMenuList({
  source,
  sources,
  workspaces,
  selectedWorkspaces,
  projects,
  selectedScopes,
  onSource,
  onToggleWorkspace,
  onToggleProject,
  onPreferences,
  onWorkspaceSettings,
}: {
  source: SourceId;
  sources: SourceOption[];
  workspaces: { slug: string; name: string }[];
  selectedWorkspaces: string[];
  projects: CatalogProject[];
  selectedScopes: ScopePair[];
  onSource: (id: SourceId) => void;
  onToggleWorkspace: (slug: string) => void;
  onToggleProject: (scope: ScopePair) => void;
  onPreferences?: () => void;
  onWorkspaceSettings?: () => void;
}) {
  const [workspacesOpen, setWorkspacesOpen] = useState(false);
  return (
    <div className="flex max-h-[min(70vh,28rem)] flex-col gap-0.5 overflow-auto p-1" data-smoke="scope-menu">
      <MenuRow label="Preferences" shortcut="G then S" onClick={onPreferences} />
      <MenuRow label="Workspace settings" onClick={onWorkspaceSettings} />
      <MenuRow label="Invite and manage members" />
      <button
        type="button"
        className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
        aria-expanded={workspacesOpen}
        onClick={() => setWorkspacesOpen((open) => !open)}
      >
        <span className="flex-1">Switch workspace</span>
        <span className="text-muted-foreground text-[11px]">O then W</span>
        <ChevronRightIcon className="text-muted-foreground size-3.5" />
      </button>
      {workspacesOpen ? (
        workspaces.length ? (
          workspaces.map((workspace) => {
            const checked = selectedWorkspaces.includes(workspace.slug);
            return (
              <button
                key={workspace.slug}
                type="button"
                className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 pl-4 text-left text-[13px]"
                aria-checked={checked}
                onClick={() => onToggleWorkspace(workspace.slug)}
              >
                <CheckIcon className={cn("size-3.5", checked ? "opacity-100" : "opacity-0")} />
                <span>{workspace.name}</span>
                <span className="text-muted-foreground ml-auto text-[11px]">{workspace.slug}</span>
              </button>
            );
          })
        ) : (
          <p className="text-muted-foreground px-4 py-1 text-[12px]" data-smoke="workspaces-empty">
            {workspacesEmptyMessage(source)}
          </p>
        )
      ) : null}
      <MenuRow label="Log out" />
      <div className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium">Source</div>
      {sources.map((option) => (
        <button
          key={option.id}
          type="button"
          className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] disabled:opacity-50"
          aria-checked={source === option.id}
          disabled={!option.enabled}
          title={option.reason}
          onClick={() => onSource(option.id)}
        >
          <CheckIcon className={cn("size-3.5", source === option.id ? "opacity-100" : "opacity-0")} />
          <span>{option.label}</span>
        </button>
      ))}
      <div className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium">Projects</div>
      {projects.map((project) => {
        const checked = selectedScopes.some(
          (scope) => scope.workspace === project.workspace && scope.project === project.identifier,
        );
        return (
          <button
            key={`${project.workspace}/${project.identifier}`}
            type="button"
            className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
            aria-checked={checked}
            onClick={() => onToggleProject({ workspace: project.workspace, project: project.identifier })}
          >
            <CheckIcon className={cn("size-3.5", checked ? "opacity-100" : "opacity-0")} />
            <span className="truncate">{project.name}</span>
            <span className="text-muted-foreground ml-auto text-[11px]">
              {project.workspace}/{project.identifier}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ScopeSwitcher(props: {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: ReactNode;
}) {
  return (
    <DropdownMenu open={props.open} onOpenChange={props.onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted flex h-9 w-full items-center rounded-lg px-2 text-left text-[13px] font-medium"
          aria-label="Switch workspace"
          title="Switch workspace (O then W)"
        >
          <span className="truncate">{props.label}</span>
          <ChevronDownIcon className="text-muted-foreground ml-1 size-3.5 shrink-0" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        {props.menu}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function JoinedProjects({
  scopes,
  onOpen,
}: {
  scopes: ScopePair[];
  onOpen: (scope: ScopePair) => void;
}) {
  if (!scopes.length) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium">Your teams</div>
      {scopes.map((scope) => (
        <button
          key={`${scope.workspace}/${scope.project}`}
          type="button"
          className="hover:bg-muted rounded-md px-3 py-1.5 text-left text-[13px]"
          onClick={() => onOpen(scope)}
        >
          {scope.workspace}/{scope.project}
        </button>
      ))}
    </div>
  );
}

export function FavoriteRows({
  favorites,
  onOpen,
}: {
  favorites: LinearFavorite[];
  onOpen: (item: LinearFavorite) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium">Favorites</div>
      {favorites.length ? (
        favorites.map((item) => (
          <button
            key={`${item.kind}:${item.id}`}
            type="button"
            className="hover:bg-muted flex items-center gap-2 rounded-md px-3 py-1.5 text-left text-[13px]"
            onClick={() => onOpen(item)}
          >
            <StarIcon className="size-3.5 fill-current" />
            <span className="truncate">{item.label}</span>
          </button>
        ))
      ) : (
        <p className="text-muted-foreground px-3 py-1 text-[12px]">No favorites yet</p>
      )}
    </div>
  );
}

export function RoadmapCanvas({
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
  onZoom,
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
  onZoom: (zoom: Zoom) => void;
}) {
  const initiativeName = new Map(initiatives.map((row) => [`${row.workspace}/${row.project}`, row.name]));
  if (kind === "projects") {
    const rows = orderRows(filterParity(projects, display.completed), display.ordering, (row) => ({
      status: row.status,
      updated: row.updated,
      target: row.targetDate,
    }));
    const filtered = rows;
    if (layout === "timeline") {
      return (
        <TimelinePane
          zoom={display.zoom}
          onZoom={onZoom}
          items={filtered.map((row) => ({
            id: `${row.workspace}/${row.identifier}`,
            label: row.name,
            group: projectGroup(row, display.grouping, initiativeName.get(`${row.workspace}/${row.identifier}`)),
            health: row.health,
            start: row.startDate,
            end: row.targetDate,
          }))}
          onOpen={(id) => {
            const row = filtered.find((item) => `${item.workspace}/${item.identifier}` === id);
            if (row) onOpenProject(row);
          }}
        />
      );
    }
    return (
      <RoadmapTable
        kind="projects"
        initiatives={initiatives}
        projects={filtered}
        display={display}
        layout={layout}
        favorites={favorites}
        onOpenInitiative={onOpenInitiative}
        onOpenProject={onOpenProject}
        onContext={onContext}
        onToggleFavorite={onToggleFavorite}
      />
    );
  }

  const rows = orderRows(filterParity(initiatives, display.completed), display.ordering, (row) => ({
    status: row.status,
    priority: row.priority,
    updated: row.updated,
    target: row.targetDate,
  }));
  if (layout === "timeline") {
    return (
      <TimelinePane
        zoom={display.zoom}
        onZoom={onZoom}
        items={rows.map((row) => ({
          id: row.key,
          label: row.name,
          group: initiativeGroup(row, display.grouping),
          health: row.health,
          start: row.startDate,
          end: row.targetDate,
        }))}
        onOpen={onOpenInitiative}
      />
    );
  }
  return (
    <RoadmapTable
      kind="initiatives"
      initiatives={rows}
      projects={projects}
      display={display}
      layout={layout}
      favorites={favorites}
      onOpenInitiative={onOpenInitiative}
      onOpenProject={onOpenProject}
      onContext={onContext}
      onToggleFavorite={onToggleFavorite}
    />
  );
}

function TimelinePane({
  items,
  zoom,
  onZoom,
  onOpen,
}: {
  items: { id: string; label: string; group: string; health: Health; start?: string; end?: string }[];
  zoom: Zoom;
  onZoom: (zoom: Zoom) => void;
  onOpen: (id: string) => void;
}) {
  const groups = [...new Set(items.map((item) => item.group))];
  return (
    <div className="flex flex-col gap-4" data-smoke="timeline">
      <div className="flex items-center gap-1">
        {(["week", "month", "quarter", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={zoom === value}
            className={cn(
              "h-7 rounded-lg px-2 text-[12px] capitalize",
              zoom === value ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
            onClick={() => onZoom(value)}
          >
            {value}
          </button>
        ))}
      </div>
      {groups.map((group) => {
        const layout = layoutTimeline(items.filter((item) => item.group === group), zoom);
        return (
          <section key={group}>
            <h3 className="mb-1 text-[12px] font-medium">{group}</h3>
            <div className="relative h-28 overflow-auto rounded-lg border border-[var(--bg-border-color)]">
              <div className="relative h-full" style={{ width: layout.width }}>
                {layout.ticks.map((tick) => (
                  <span
                    key={`${group}-${tick.label}`}
                    className="text-muted-foreground absolute top-1 text-[10px]"
                    style={{ left: tick.x }}
                  >
                    {tick.label}
                  </span>
                ))}
                <span className="absolute top-0 bottom-0 w-px bg-red-500" style={{ left: layout.todayX }} />
                {layout.bars.map((bar, index) => (
                  <button
                    key={bar.id}
                    type="button"
                    className="bg-muted absolute flex h-7 items-center gap-1 overflow-hidden rounded px-1 text-left text-[12px]"
                    style={{ left: bar.x, width: bar.width, top: 28 + (index % 2) * 32 }}
                    onClick={() => onOpen(bar.id)}
                  >
                    <HealthDot health={bar.health} />
                    <span className="truncate">{bar.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {layout.unscheduled.length ? (
              <p className="text-muted-foreground mt-1 text-[12px]">
                Unscheduled: {layout.unscheduled.map((item) => item.label).join(", ")}
              </p>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export function IssueGroupList({
  groups,
  onOpen,
  onContext,
}: {
  groups: { key: string; cards: Card[] }[];
  onOpen: (key: string) => void;
  onContext: (event: { clientX: number; clientY: number; preventDefault: () => void }, key: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3" data-smoke="issue-groups">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="text-muted-foreground flex items-center gap-2 px-2 py-1 text-[11px] font-medium">
            <StatusMark status={group.key} />
            {group.key} {group.cards.length}
          </h3>
          {group.cards.map((card) => (
            <button
              key={card.key}
              type="button"
              className="hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
              onClick={() => onOpen(card.key)}
              onContextMenu={(event) => onContext(event, card.key)}
            >
              <span className="w-28 shrink-0 font-medium">{card.key}</span>
              <span className="truncate">{card.summary}</span>
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

export function ViewFilterChips({
  filter,
  onClear,
}: {
  filter: ViewFilter;
  onClear: (id: string) => void;
}) {
  const chips = viewFilterChips(filter);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap gap-1 px-3 pb-2" data-smoke="filter-chips">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          className="bg-muted inline-flex h-6 items-center gap-1 rounded-full px-2 text-[11px]"
          onClick={() => onClear(chip.id)}
        >
          {chip.label}
          <span aria-hidden>×</span>
        </button>
      ))}
    </div>
  );
}

export function ViewFilterEditor({
  filter,
  options,
  views,
  viewName,
  onViewName,
  onChange,
  onSave,
  onApply,
  onMakeDefault,
}: {
  filter: ViewFilter;
  options: { status: string[]; assignee: string[]; priority: string[]; labels: string[]; project: string[] };
  views: SavedView[];
  viewName: string;
  onViewName: (value: string) => void;
  onChange: (next: ViewFilter) => void;
  onSave: () => void;
  onApply: (name: string) => void;
  onMakeDefault: (name: string) => void;
}) {
  function toggleHealth(value: string) {
    const current = filter.health ?? [];
    const health = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onChange({ ...filter, ...(health.length ? { health } : { health: undefined }) });
  }
  function toggle(key: "status" | "assignee" | "priority" | "labels" | "project", value: string) {
    const current = filter[key];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    onChange({ ...filter, [key]: next });
  }
  function setRange(key: "created" | "updated" | "due", edge: "from" | "to", value: string) {
    const range = { ...(filter[key] ?? {}) };
    if (value) range[edge] = value;
    else delete range[edge];
    const next = { ...filter };
    if (range.from || range.to) next[key] = range;
    else delete next[key];
    onChange(next);
  }
  return (
    <div className="flex flex-col gap-2 p-2" data-smoke="view-filter">
      <div className="text-muted-foreground text-[11px] font-medium">View filters</div>
      {(["created", "updated", "due"] as const).map((key) => (
        <label key={key} className="flex items-center gap-1 text-[12px] capitalize">
          {key}
          <input
            type="date"
            aria-label={`${key} from`}
            className="bg-muted h-6 rounded px-1"
            value={filter[key]?.from ?? ""}
            onChange={(event) => setRange(key, "from", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
          <input
            type="date"
            aria-label={`${key} to`}
            className="bg-muted h-6 rounded px-1"
            value={filter[key]?.to ?? ""}
            onChange={(event) => setRange(key, "to", event.target.value)}
            onKeyDown={(event) => event.stopPropagation()}
          />
        </label>
      ))}
      <div className="flex flex-col">
        <span className="text-muted-foreground text-[11px]">Health</span>
        {HEALTH_FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            className="hover:bg-muted flex items-center gap-2 rounded px-1 py-0.5 text-left text-[12px]"
            aria-checked={(filter.health ?? []).includes(value)}
            onClick={() => toggleHealth(value)}
          >
            <CheckIcon className={cn("size-3", (filter.health ?? []).includes(value) ? "opacity-100" : "opacity-0")} />
            {value}
          </button>
        ))}
      </div>
      {(
        [
          ["status", options.status],
          ["assignee", options.assignee],
          ["priority", options.priority],
          ["labels", options.labels],
          ["project", options.project],
        ] as const
      ).map(([key, values]) =>
        values.length ? (
          <div key={key} className="flex flex-col">
            <span className="text-muted-foreground text-[11px] capitalize">{key}</span>
            {values.map((value) => (
              <button
                key={value}
                type="button"
                className="hover:bg-muted flex items-center gap-2 rounded px-1 py-0.5 text-left text-[12px]"
                aria-checked={filter[key].includes(value)}
                onClick={() => toggle(key, value)}
              >
                <CheckIcon className={cn("size-3", filter[key].includes(value) ? "opacity-100" : "opacity-0")} />
                {value}
              </button>
            ))}
          </div>
        ) : null,
      )}
      <div className="flex items-center gap-1">
        <input
          aria-label="Saved view name"
          className="bg-muted h-7 min-w-0 flex-1 rounded px-2 text-[12px]"
          value={viewName}
          placeholder="Save view"
          onChange={(event) => onViewName(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <button type="button" className="bg-muted h-7 rounded px-2 text-[12px]" onClick={onSave}>
          Save
        </button>
      </div>
      {views.map((view) => (
        <div key={view.name} className="flex items-center gap-1 text-[12px]">
          <button type="button" className="hover:bg-muted flex-1 rounded px-1 py-0.5 text-left" onClick={() => onApply(view.name)}>
            {view.name}
            {view.default ? " · default" : ""}
          </button>
          <button type="button" className="text-muted-foreground" onClick={() => onMakeDefault(view.name)}>
            Default
          </button>
        </div>
      ))}
    </div>
  );
}

const DISPLAY_PROPERTIES = ["Status", "Priority", "Assignee", "Labels", "Project", "Due date", "Health", "Target date"];

export function DisplayOptionItems({
  display,
  onChange,
}: {
  display: DisplayOptions;
  onChange: (next: DisplayOptions) => void;
}) {
  const [listOpen, setListOpen] = useState(false);
  const properties = display.properties ?? [...DISPLAY_PROPERTIES];
  function toggleProperty(name: string) {
    const next = properties.includes(name) ? properties.filter((item) => item !== name) : [...properties, name];
    onChange({ ...display, properties: next });
  }
  return (
    <div className="flex flex-col gap-2 p-2" data-smoke="display-options">
      <div className="bg-muted flex gap-1 rounded-lg p-1">
        {(["list", "board", "timeline"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={display.layout === value}
            className={cn(
              "h-7 flex-1 rounded-md text-[12px] capitalize",
              display.layout === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
            )}
            onClick={() => onChange({ ...display, layout: value })}
          >
            {value === "list" ? "List" : value === "board" ? "Board" : "Timeline"}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="hover:bg-muted flex items-center justify-between rounded-md px-1 py-1 text-left text-[13px]"
        aria-pressed={display.ordering === "updated"}
        onClick={() => onChange({ ...display, ordering: display.ordering === "updated" ? "manual" : "updated" })}
      >
        <span>Order completed by recency</span>
        <span className={cn("h-4 w-7 rounded-full", display.ordering === "updated" ? "bg-primary" : "bg-muted")} />
      </button>
      <button
        type="button"
        className="hover:bg-muted flex items-center justify-between rounded-md px-1 py-1 text-left text-[13px]"
        aria-pressed={display.showSubIssues !== false}
        onClick={() => onChange({ ...display, showSubIssues: display.showSubIssues === false })}
      >
        <span>Show sub-issues</span>
        <span className={cn("h-4 w-7 rounded-full", display.showSubIssues === false ? "bg-muted" : "bg-primary")} />
      </button>
      <button type="button" className="hover:bg-muted rounded-md px-1 py-1 text-left text-[13px]" onClick={() => setListOpen((open) => !open)}>
        List options
      </button>
      {listOpen ? (
        <div className="flex flex-col gap-1 pl-1">
          <DropdownMenuLabel>Grouping</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={display.grouping} onValueChange={(value) => onChange({ ...display, grouping: value as Grouping })}>
            {["status", "assignee", "project", "priority", "label", "health", "target", "initiative"].map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel>Ordering</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={display.ordering} onValueChange={(value) => onChange({ ...display, ordering: value as Ordering })}>
            {["manual", "status", "priority", "updated", "created", "target"].map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel>Zoom</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={display.zoom} onValueChange={(value) => onChange({ ...display, zoom: value as Zoom })}>
            {["week", "month", "quarter", "year"].map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel>Completed</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={display.completed}
            onValueChange={(value) => onChange({ ...display, completed: value as DisplayOptions["completed"] })}
          >
            {["week", "month", "year", "all", "none"].map((value) => (
              <DropdownMenuRadioItem key={value} value={value}>
                {value}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </div>
      ) : null}
      <button
        type="button"
        className="hover:bg-muted flex items-center justify-between rounded-md px-1 py-1 text-left text-[13px]"
        aria-pressed={display.showEmptyGroups}
        onClick={() => onChange({ ...display, showEmptyGroups: !display.showEmptyGroups })}
      >
        <span>Show empty groups</span>
        <span className={cn("h-4 w-7 rounded-full", display.showEmptyGroups ? "bg-primary" : "bg-muted")} />
      </button>
      <div className="text-muted-foreground px-1 text-[11px] font-medium">Display properties</div>
      <div className="flex flex-wrap gap-1 px-1">
        {DISPLAY_PROPERTIES.map((name) => {
          const on = properties.includes(name);
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              className={cn("h-6 rounded-full px-2 text-[11px]", on ? "bg-muted text-foreground" : "text-muted-foreground border border-[var(--bg-border-color)]")}
              onClick={() => toggleProperty(name)}
            >
              {name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RowContextMenu({
  x,
  y,
  sections,
  onPick,
  onClose,
}: {
  x: number;
  y: number;
  sections: RowMenuSection[];
  onPick: (action: RowMenuAction) => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50" onMouseDown={onClose} data-smoke="row-menu">
      <div
        role="menu"
        className="bg-popover absolute max-h-80 w-56 overflow-auto rounded-lg border border-[var(--bg-border-color)] p-1 shadow-md"
        style={{ left: x, top: y }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {sections.map((section) => (
          <div key={section.id} className="py-1">
            <div className="text-muted-foreground px-2 py-1 text-[11px] font-medium">{section.label}</div>
            {section.actions.map((action) => (
              <button
                key={`${action.type}:${"value" in action ? action.value : "copy"}`}
                type="button"
                role="menuitem"
                className="hover:bg-muted block w-full rounded px-2 py-1 text-left text-[13px]"
                onClick={() => onPick(action)}
              >
                {action.type === "copy" ? "Copy link" : action.type === "move-project" ? "Move to project" : action.value}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function rowMenuFor(input: { statuses: string[]; assignees: string[]; labels: string[] }) {
  return rowMenuModel(input);
}

export function openerLayout(kind: Opener, display: DisplayOptions, touched: boolean) {
  return effectiveLayout(kind, display, touched);
}
