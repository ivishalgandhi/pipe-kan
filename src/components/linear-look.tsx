import { useState, type DragEvent, type ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Box,
  Bug,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock,
  Ellipsis,
  FileStack,
  FileText,
  Flag,
  Folder,
  FolderPlus,
  Gauge,
  GitBranch,
  GitFork,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link,
  List,
  Map,
  PlusCircle,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  Timer,
  User,
  UserPlus,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { HEALTH_FILTERS, type InboxNotification, type LinearFavorite, type SavedView, type ScopePair, type ViewFilter } from "~/parity.ts";
import {
  ADD_FILTER_ROWS,
  CYCLE_ITEMS,
  FOOTER_ITEMS,
  ICON_SPEC,
  PRIORITY_VALUES,
  STATUS_TYPES,
  TEAM_ITEMS,
  VIEW_ICONS,
  filterPickerProjects,
  groupLinearFavorites,
  groupSavedViews,
  initials,
  labelToken,
  priorityToken,
  projectChip,
  statusMark,
  toggleFilterList,
  type FilterOptions,
  type FilterRow,
  type PickerProject,
  type ViewDraft,
} from "~/linear-look.ts";
import { cn } from "~/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Activity,
  BarChart3,
  Bot,
  Box,
  Bug,
  Calendar,
  CalendarDays,
  CheckCircle2,
  MoreHorizontal: Ellipsis,
  CircleDot,
  Clock,
  FileStack,
  FileText,
  Flag,
  Folder,
  FolderPlus,
  Gauge,
  GitBranch,
  GitFork,
  Home,
  Inbox,
  Layers,
  LayoutGrid,
  Lightbulb,
  Link,
  List,
  Map,
  PlusCircle,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Target,
  Timer,
  User,
  UserPlus,
  Users,
  Zap,
};

function Glyph({ name, className, stroke = ICON_SPEC.navStroke }: { name: string; className?: string; stroke?: number }) {
  const Icon = ICONS[name] ?? CircleDot;
  return <Icon aria-hidden="true" className={className} strokeWidth={stroke} />;
}

export function StatusMark({ status }: { status?: string }) {
  const mark = statusMark(status ?? "");
  return (
    <span
      aria-hidden="true"
      data-icon="status"
      className="inline-block size-3.5 shrink-0 rounded-full"
      style={{
        backgroundColor: mark.hollow ? "transparent" : `var(${mark.token})`,
        boxShadow: `inset 0 0 0 ${ICON_SPEC.statusStroke}px var(${mark.token})`,
      }}
    />
  );
}

export function PriorityMark({ priority }: { priority?: string }) {
  return (
    <Flag
      aria-hidden="true"
      data-icon="priority"
      className="size-3 shrink-0"
      strokeWidth={ICON_SPEC.statusStroke}
      style={{ color: `var(${priorityToken(priority)})`, fill: `var(${priorityToken(priority)})` }}
    />
  );
}

export function LabelDot({ label }: { label: string }) {
  return (
    <span
      aria-hidden="true"
      data-icon="label"
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ backgroundColor: `var(${labelToken(label)})` }}
    />
  );
}

export function PersonAvatar({ name }: { name: string }) {
  return (
    <span
      data-icon="avatar"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--muted)] text-[10px] font-medium"
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function NavRow({
  icon,
  label,
  active,
  badge,
  disabled,
  title,
  indent,
  onClick,
  smoke,
}: {
  icon: string;
  label: string;
  active?: boolean;
  badge?: string;
  disabled?: boolean;
  title?: string;
  indent?: boolean;
  onClick?: () => void;
  smoke?: string;
}) {
  return (
    <button
      type="button"
      data-smoke={smoke}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium",
        indent && "pl-6",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground hover:bg-foreground/[0.05] dark:hover:bg-white/[0.05]",
        disabled && "cursor-not-allowed opacity-50",
      )}
      aria-current={active ? "page" : undefined}
      title={title}
      disabled={disabled}
      onClick={onClick}
    >
      <Glyph name={icon} className={cn("size-4 shrink-0", active ? "text-foreground" : "text-muted-foreground")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge ? (
        <span className="bg-primary text-primary-foreground inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium" data-smoke="inbox-badge">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export function SidebarSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section data-smoke="sidebar-section" data-section={title}>
      <button
        type="button"
        className="text-muted-foreground flex h-7 w-full items-center gap-1 px-2 text-left text-[11px] font-medium tracking-wide uppercase"
        aria-expanded={open}
        onClick={onToggle}
      >
        <ChevronDown className={cn("size-3 shrink-0", !open && "-rotate-90")} strokeWidth={ICON_SPEC.chevronStroke} aria-hidden="true" />
        {title}
      </button>
      {open ? children : null}
    </section>
  );
}

export function SidebarFooter() {
  return (
    <div className="flex flex-col gap-0.5 px-2 pb-2" data-smoke="sidebar-footer">
      {FOOTER_ITEMS.map((label) => (
        <button
          key={label}
          type="button"
          className="text-muted-foreground hover:bg-foreground/[0.05] flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[12px]"
          title="Coming soon"
          onClick={() => undefined}
        >
          <Glyph name={label === "Try" ? "Zap" : label === "Invite people" ? "UserPlus" : "GitFork"} className="size-4 shrink-0" />
          <span className="truncate">{label === "Invite people" ? "+ Invite people" : label}</span>
          {label === "Try" ? <ChevronDown className="ml-auto size-3" strokeWidth={ICON_SPEC.chevronStroke} aria-hidden="true" /> : null}
        </button>
      ))}
    </div>
  );
}

export function FavoriteFolderList({
  favorites,
  folders,
  onOpen,
  onFile,
  onCreate,
}: {
  favorites: LinearFavorite[];
  folders: string[];
  onOpen: (item: LinearFavorite) => void;
  onFile: (item: LinearFavorite, folder?: string) => void;
  onCreate: (name: string) => void;
}) {
  const grouped = groupLinearFavorites(favorites, folders);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  function allowDrop(event: DragEvent) {
    event.preventDefault();
  }
  function dropOn(folder: string | undefined, event: DragEvent) {
    event.preventDefault();
    const raw = event.dataTransfer.getData("text/plain");
    const [kind, id] = raw.split(":");
    const item = favorites.find((entry) => entry.kind === kind && entry.id === id);
    if (item) onFile(item, folder);
  }
  return (
    <div className="flex flex-col gap-0.5" data-smoke="favorite-folders">
      {grouped.groups.map((group) => (
        <div key={group.name} onDragOver={allowDrop} onDrop={(event) => dropOn(group.name, event)}>
          <button
            type="button"
            className="hover:bg-foreground/[0.05] flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]"
            aria-expanded={!closed[group.name]}
            onClick={() => setClosed((current) => ({ ...current, [group.name]: !current[group.name] }))}
          >
            <Folder className="text-muted-foreground size-4 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{group.name}</span>
            <span className="text-muted-foreground text-[11px]">{group.items.length}</span>
          </button>
          {!closed[group.name] ? (
            group.items.length ? (
              group.items.map((item) => (
                <FavoriteLeaf key={`${item.kind}:${item.id}`} item={item} indent onOpen={onOpen} />
              ))
            ) : (
              <p className="text-muted-foreground px-6 py-1 text-[12px]">Empty folder</p>
            )
          ) : null}
        </div>
      ))}
      {grouped.loose.map((item) => (
        <FavoriteLeaf key={`${item.kind}:${item.id}`} item={item} onOpen={onOpen} />
      ))}
      {adding ? (
        <input
          aria-label="Folder name"
          className="bg-muted h-7 rounded-lg px-2 text-[13px]"
          value={name}
          autoFocus
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              onCreate(name);
              setName("");
              setAdding(false);
            }
            if (event.key === "Escape") setAdding(false);
          }}
          onBlur={() => {
            if (name.trim()) onCreate(name);
            setName("");
            setAdding(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="text-muted-foreground hover:bg-foreground/[0.05] flex h-7 items-center gap-2 rounded-lg px-2 text-left text-[13px]"
          aria-label="Add folder"
          onClick={() => setAdding(true)}
        >
          <FolderPlus className="size-4" strokeWidth={1.5} aria-hidden="true" />
          Add folder
        </button>
      )}
    </div>
  );
}

function FavoriteLeaf({ item, indent, onOpen }: { item: LinearFavorite; indent?: boolean; onOpen: (item: LinearFavorite) => void }) {
  return (
    <button
      type="button"
      draggable
      className={cn(
        "hover:bg-foreground/[0.05] flex h-7 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]",
        indent && "pl-6",
      )}
      onDragStart={(event) => event.dataTransfer.setData("text/plain", `${item.kind}:${item.id}`)}
      onClick={() => onOpen(item)}
    >
      <Glyph name={item.kind === "project" ? "Box" : item.kind === "initiative" ? "Target" : "CircleDot"} className="text-muted-foreground size-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function TeamNav({
  scopes,
  triage,
  activeScope,
  onOpenScope,
  onNav,
}: {
  scopes: ScopePair[];
  triage: number;
  activeScope?: string;
  onOpenScope: (scope: ScopePair) => void;
  onNav: (scope: ScopePair, item: string) => void;
}) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const [cyclesClosed, setCyclesClosed] = useState<Record<string, boolean>>({});
  return (
    <div className="flex flex-col gap-0.5" data-smoke="team-nav">
      {scopes.map((scope) => {
        const id = `${scope.workspace}/${scope.project}`;
        const open = !closed[id];
        return (
          <div key={id}>
            <div className="flex items-center">
              <button
                type="button"
                data-smoke="team-scope"
                data-team={id}
                className={cn(
                  "flex h-7 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium",
                  activeScope === id ? "bg-sidebar-accent" : "hover:bg-foreground/[0.05]",
                )}
                onClick={() => onOpenScope(scope)}
              >
                <PersonAvatar name={scope.project} />
                <span className="truncate">{id}</span>
              </button>
              <button
                type="button"
                aria-label={`Toggle ${id}`}
                className="text-muted-foreground flex size-7 items-center justify-center rounded-lg"
                onClick={() => setClosed((current) => ({ ...current, [id]: !current[id] }))}
              >
                <ChevronDown className={cn("size-3", !open && "-rotate-90")} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            {open
              ? TEAM_ITEMS.map((item) =>
                  item === "Cycles" ? (
                    <div key={item}>
                      <button
                        type="button"
                        className="text-muted-foreground flex h-7 w-full items-center gap-2 rounded-lg pr-2 pl-6 text-left text-[13px] opacity-50"
                        title="Coming soon"
                        onClick={() => setCyclesClosed((current) => ({ ...current, [id]: !current[id] }))}
                      >
                        <Clock className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        Cycles
                        <ChevronDown className={cn("ml-auto size-3", cyclesClosed[id] && "-rotate-90")} strokeWidth={2} aria-hidden="true" />
                      </button>
                      {!cyclesClosed[id]
                        ? CYCLE_ITEMS.map((cycle) => (
                            <button
                              key={cycle}
                              type="button"
                              className="text-muted-foreground flex h-7 w-full items-center rounded-lg pr-2 pl-10 text-left text-[13px] opacity-50"
                              title="Coming soon"
                              disabled
                            >
                              {cycle}
                            </button>
                          ))
                        : null}
                    </div>
                  ) : (
                    <NavRow
                      key={item}
                      icon={item === "Home" ? "Home" : item === "Triage" ? "Inbox" : item === "Issues" ? "CircleDot" : item === "Projects" ? "Box" : "LayoutGrid"}
                      label={item}
                      indent
                      badge={item === "Triage" ? String(triage) : undefined}
                      onClick={() => onNav(scope, item)}
                    />
                  ),
                )
              : null}
          </div>
        );
      })}
    </div>
  );
}

export function ViewBrowser({
  views,
  workspaceName,
  kind,
  onKind,
  onNew,
  onOpen,
}: {
  views: SavedView[];
  workspaceName: string;
  kind: "issues" | "projects";
  onKind: (kind: "issues" | "projects") => void;
  onNew: () => void;
  onOpen: (view: SavedView) => void;
}) {
  const groups = groupSavedViews(views, kind);
  return (
    <div className="flex flex-col gap-3 p-4" data-smoke="view-browser">
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-medium">Views</h2>
        <span className="flex-1" />
        <button type="button" className="bg-primary text-primary-foreground h-7 rounded-lg px-2 text-[13px] font-medium" onClick={onNew}>
          New view
        </button>
      </div>
      <div role="tablist" aria-label="Issues or Projects" className="flex gap-1">
        {(["issues", "projects"] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            className={cn("h-7 rounded-lg px-2 text-[13px] capitalize", kind === value ? "bg-muted text-foreground" : "text-muted-foreground")}
            onClick={() => onKind(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <ViewGroup title="Personal" views={groups.personal} workspaceName={workspaceName} onOpen={onOpen} />
      <ViewGroup title={workspaceName} views={groups.team} workspaceName={workspaceName} onOpen={onOpen} />
    </div>
  );
}

function ViewGroup({
  title,
  views,
  workspaceName,
  onOpen,
}: {
  title: string;
  views: SavedView[];
  workspaceName: string;
  onOpen: (view: SavedView) => void;
}) {
  return (
    <section>
      <h3 className="text-muted-foreground px-2 py-1 text-[11px] font-medium tracking-wide uppercase">{title}</h3>
      {views.length ? (
        views.map((view) => (
          <button
            key={view.name}
            type="button"
            className="hover:bg-muted flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]"
            onClick={() => onOpen(view)}
          >
            <Glyph name={view.icon || "List"} className="text-muted-foreground size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{view.name}</span>
            <span className="text-muted-foreground text-[11px]">{view.scope === "team" ? workspaceName : "Personal"}</span>
          </button>
        ))
      ) : (
        <p className="text-muted-foreground px-2 py-1 text-[12px]">No views yet</p>
      )}
    </section>
  );
}

export function ViewComposer({
  draft,
  teamName,
  filter,
  onChange,
  onClose,
  onCreate,
}: {
  draft: ViewDraft;
  teamName: string;
  filter: ViewFilter;
  onChange: (next: ViewDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/20 p-8" data-smoke="view-composer" onMouseDown={onClose}>
      <div
        className="bg-popover w-full max-w-xl rounded-xl border border-[var(--border)] p-4 shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="text-muted-foreground text-[12px]">Views › New view</div>
        <div className="mt-3 flex flex-wrap gap-1" role="listbox" aria-label="View icon">
          {VIEW_ICONS.map((icon) => (
            <button
              key={icon}
              type="button"
              aria-label={icon}
              aria-selected={draft.icon === icon}
              className={cn(
                "flex size-8 items-center justify-center rounded-lg",
                draft.icon === icon ? "bg-sidebar-accent ring-1 ring-[var(--ring)]" : "hover:bg-muted",
              )}
              onClick={() => onChange({ ...draft, icon })}
            >
              <Glyph name={icon} className="size-4" />
            </button>
          ))}
        </div>
        <input
          aria-label="View title"
          className="mt-3 h-9 w-full bg-transparent text-[18px] font-medium outline-none"
          placeholder="All issues"
          value={draft.title}
          onChange={(event) => onChange({ ...draft, title: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <textarea
          aria-label="View description"
          className="mt-1 min-h-16 w-full resize-none bg-transparent text-[13px] outline-none"
          placeholder="Description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <div role="tablist" aria-label="Issues or Projects" className="mt-2 flex gap-1">
          {(["issues", "projects"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={draft.kind === value}
              className={cn("h-7 rounded-lg px-2 text-[13px] capitalize", draft.kind === value ? "bg-muted" : "text-muted-foreground")}
              onClick={() => onChange({ ...draft, kind: value })}
            >
              {value}
            </button>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-[12px]" data-smoke="composer-filters">
          {filter.status.length || filter.assignee.length || filter.priority.length || filter.labels.length || filter.project.length
            ? "Filters from the current bar are saved with this view."
            : "No filters yet. Add some from the filter bar."}
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <label className="text-muted-foreground mr-auto flex items-center gap-2 text-[13px]">
            Save to
            <select
              aria-label="Save to"
              className="bg-muted h-7 rounded-lg px-2"
              value={draft.scope}
              onChange={(event) => onChange({ ...draft, scope: event.target.value === "team" ? "team" : "personal" })}
            >
              <option value="personal">Personal</option>
              <option value="team">{teamName}</option>
            </select>
          </label>
          <button type="button" className="h-7 rounded-lg px-2 text-[13px]" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="bg-primary text-primary-foreground h-7 rounded-lg px-3 text-[13px] font-medium" onClick={onCreate}>
            Create view
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddFilterMenu({
  filter,
  options,
  onChange,
  onAdvanced,
  onClose,
}: {
  filter: ViewFilter;
  options: FilterOptions;
  onChange: (next: ViewFilter) => void;
  onAdvanced: () => void;
  onClose: () => void;
}) {
  const [row, setRow] = useState<string | null>(null);
  const [ai, setAi] = useState("");
  const active = ADD_FILTER_ROWS.find((item) => item.id === row);
  return (
    <div className="fixed inset-0 z-50" data-smoke="add-filter" onMouseDown={onClose}>
      <div
        role="menu"
        aria-label="Add filter"
        className="bg-popover absolute top-28 left-72 w-[280px] rounded-lg border border-[var(--border)] py-1 shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {ADD_FILTER_ROWS.map((item) => (
          <FilterMenuRow key={item.id} item={item} onPick={() => (item.kind === "advanced" ? onAdvanced() : setRow(item.id))} />
        ))}
        {active && active.kind !== "soon" ? (
          <div
            role="dialog"
            aria-label={active.label}
            className="bg-popover absolute top-0 left-full ml-1 max-h-80 w-56 overflow-auto rounded-lg border border-[var(--border)] p-1 shadow-md"
            data-smoke="filter-submenu"
          >
            {active.kind === "prompt" ? (
              <textarea
                aria-label="Describe what you want to filter..."
                className="bg-muted min-h-20 w-full rounded-md p-2 text-[13px] outline-none"
                placeholder="Describe what you want to filter..."
                value={ai}
                onChange={(event) => setAi(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
              />
            ) : null}
            {active.id === "status" ? <ValueList values={options.status} selected={filter.status} onToggle={(value) => onChange(toggleFilterList(filter, "status", value))} /> : null}
            {active.id === "statusType" ? (
              <ValueList values={[...STATUS_TYPES]} selected={filter.statusType ?? []} onToggle={(value) => onChange(toggleFilterList(filter, "statusType", value))} />
            ) : null}
            {active.id === "assignee" ? (
              <ValueList values={options.assignee} selected={filter.assignee} onToggle={(value) => onChange(toggleFilterList(filter, "assignee", value))} />
            ) : null}
            {active.id === "priority" ? (
              <ValueList values={[...PRIORITY_VALUES]} selected={filter.priority} onToggle={(value) => onChange(toggleFilterList(filter, "priority", value))} />
            ) : null}
            {active.id === "labels" ? <ValueList values={options.labels} selected={filter.labels} onToggle={(value) => onChange(toggleFilterList(filter, "labels", value))} /> : null}
            {active.id === "project" ? (
              <ValueList values={options.project} selected={filter.project} onToggle={(value) => onChange(toggleFilterList(filter, "project", value))} />
            ) : null}
            {active.id === "projectProperties" ? (
              <ValueList values={[...HEALTH_FILTERS]} selected={filter.health ?? []} onToggle={(value) => onChange(toggleFilterList(filter, "health", value))} />
            ) : null}
            {active.id === "initiative" ? (
              <ValueList values={options.initiative} selected={filter.initiative ?? []} onToggle={(value) => onChange(toggleFilterList(filter, "initiative", value))} />
            ) : null}
            {active.id === "dates" ? <DateFields filter={filter} onChange={onChange} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterMenuRow({ item, onPick }: { item: FilterRow; onPick: () => void }) {
  const soon = item.kind === "soon";
  return (
    <button
      type="button"
      role="menuitem"
      data-smoke="filter-row"
      data-filter={item.id}
      className={cn("hover:bg-muted flex h-8 w-full items-center gap-2 rounded-md px-2 text-left", soon && "cursor-not-allowed opacity-50")}
      title={soon ? "Coming soon" : undefined}
      onClick={() => {
        if (!soon) onPick();
      }}
    >
      <Glyph name={item.icon} className="text-muted-foreground size-4 shrink-0" />
      <span className="flex-1 text-[13px] font-[450]">{item.label}</span>
      <ChevronRight className="text-muted-foreground size-3 shrink-0" strokeWidth={ICON_SPEC.chevronStroke} aria-hidden="true" />
    </button>
  );
}

function ValueList({ values, selected, onToggle }: { values: string[]; selected: string[]; onToggle: (value: string) => void }) {
  if (!values.length) return <p className="text-muted-foreground px-2 py-1 text-[12px]">Nothing to choose</p>;
  return (
    <div className="flex flex-col">
      {values.map((value) => (
        <button key={value} type="button" className="hover:bg-muted flex h-8 items-center gap-2 rounded-md px-2 text-left text-[13px]" onClick={() => onToggle(value)}>
          <Check className={cn("size-3.5", selected.includes(value) ? "opacity-100" : "opacity-0")} aria-hidden="true" />
          {value}
        </button>
      ))}
    </div>
  );
}

function DateFields({ filter, onChange }: { filter: ViewFilter; onChange: (next: ViewFilter) => void }) {
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
    <div className="flex flex-col gap-2 p-1">
      {(["created", "updated", "due"] as const).map((key) => (
        <label key={key} className="flex flex-col gap-1 text-[12px] capitalize">
          {key}
          <input aria-label={`${key} from`} type="date" className="bg-muted h-7 rounded px-1" value={filter[key]?.from ?? ""} onChange={(event) => setRange(key, "from", event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
          <input aria-label={`${key} to`} type="date" className="bg-muted h-7 rounded px-1" value={filter[key]?.to ?? ""} onChange={(event) => setRange(key, "to", event.target.value)} onKeyDown={(event) => event.stopPropagation()} />
        </label>
      ))}
    </div>
  );
}

export function ProjectPicker({
  projects,
  teamName,
  current,
  onSelect,
  onClose,
}: {
  projects: PickerProject[];
  teamName: string;
  current: string;
  onSelect: (projectId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [hover, setHover] = useState<string | null>(null);
  const rows = filterPickerProjects(projects, query);
  const hovered = rows.find((project) => project.id === hover);
  return (
    <div className="fixed inset-0 z-50" data-smoke="project-picker" onMouseDown={onClose}>
      <div
        className="bg-popover absolute top-28 left-80 w-80 rounded-lg border border-[var(--border)] p-1 shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          aria-label="Move to project..."
          className="bg-muted h-8 w-full rounded-md px-2 text-[13px] outline-none"
          placeholder="Move to project..."
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
        />
        <button type="button" className="hover:bg-muted mt-1 flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]" onClick={() => onSelect("")}>
          <Box className="text-muted-foreground size-3.5" strokeWidth={1.5} aria-hidden="true" />
          <span className="flex-1">No project</span>
          <span className="text-muted-foreground text-[12px]">0</span>
          {current === "" ? <Check className="size-3.5" aria-hidden="true" /> : null}
        </button>
        <div className="text-muted-foreground px-2 pt-2 pb-1 text-[11px] font-medium">Projects in {teamName} team</div>
        <div className="max-h-64 overflow-auto">
          {rows.map((project) => (
            <button
              key={project.id}
              type="button"
              className="hover:bg-muted flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-[13px]"
              onMouseEnter={() => setHover(project.id)}
              onClick={() => onSelect(project.identifier)}
            >
              <Box className="text-muted-foreground size-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" data-icon="project" />
              <span className="min-w-0 flex-1 truncate">{project.name}</span>
              {current === project.identifier ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
            </button>
          ))}
        </div>
        <div className="mt-1 flex items-center justify-between px-2 py-1">
          <button type="button" className="text-muted-foreground text-[13px]" title="Coming soon">
            + New project
          </button>
          <button type="button" className="text-muted-foreground text-[12px] underline-offset-2 hover:underline" title="Coming soon">
            Create new project...
          </button>
        </div>
        {hovered ? <ProjectDetail project={hovered} /> : null}
      </div>
    </div>
  );
}

function ProjectDetail({ project }: { project: PickerProject }) {
  return (
    <aside
      data-smoke="project-detail"
      className="bg-popover absolute top-0 left-full ml-2 w-60 rounded-lg border border-[var(--border)] p-3 shadow-md"
    >
      <span className="bg-muted inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium">{projectChip(project.identifier)}</span>
      <p className="mt-2 text-[13px] font-medium">{project.name}</p>
      <p className="mt-2">
        <span className="bg-muted inline-flex h-6 items-center rounded-full px-2 text-[12px]">{project.status || "Backlog"}</span>
      </p>
      <p className="mt-2 flex items-center gap-2 text-[12px]">
        <PersonAvatar name={project.owner || "Ada"} />
        {project.owner || "Unassigned"}
      </p>
      <p className="mt-2 flex items-center gap-2 text-[12px]">
        <PriorityMark priority={project.priority} />
        {project.priority || "None"}
      </p>
      <div className="bg-muted mt-3 h-1.5 overflow-hidden rounded-full">
        <div className="bg-primary h-full" style={{ width: `${Math.max(0, Math.min(100, project.progress))}%` }} />
      </div>
      <p className="text-muted-foreground mt-1 text-[12px]">{project.issues} issues</p>
    </aside>
  );
}

export function InboxList({
  notes,
  onOpen,
  onRead,
}: {
  notes: InboxNotification[];
  onOpen: (key: string) => void;
  onRead: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="flex h-full min-h-0 flex-col" data-smoke="inbox">
      <header className="flex h-11 items-center gap-2 px-3">
        <h2 className="text-[15px] font-medium">Inbox</h2>
        <span className="flex-1" />
        <button type="button" aria-label="Inbox menu" className="hover:bg-muted flex size-7 items-center justify-center rounded-lg" onClick={() => setMenu((open) => !open)}>
          <span aria-hidden="true">...</span>
        </button>
        {menu ? (
          <button type="button" className="bg-muted h-7 rounded-lg px-2 text-[13px]" onClick={onRead}>
            Mark all read
          </button>
        ) : null}
      </header>
      {notes.length ? (
        <div className="min-h-0 flex-1 overflow-auto">
          {notes.map((note) => (
            <button
              key={note.id}
              type="button"
              className="hover:bg-muted flex h-12 w-full items-center gap-2 px-3 text-left"
              onClick={() => onOpen(note.issueKey)}
            >
              <PersonAvatar name={note.actor} />
              <span className="min-w-0 flex-1 truncate text-[13px]">{note.text}</span>
              <span className="text-muted-foreground shrink-0 text-[12px]">{note.ago}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 text-[13px]">
          <Check className="size-5" aria-hidden="true" />
          You're all caught up
        </div>
      )}
    </div>
  );
}
