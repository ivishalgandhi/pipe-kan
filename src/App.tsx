import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpDownIcon,
  BotIcon,
  ChevronDownIcon,
  Columns3Icon,
  EyeOffIcon,
  GripVerticalIcon,
  ListFilterIcon,
  MoonIcon,
  MoreHorizontalIcon,
  SearchIcon,
  StarIcon,
  SunIcon,
  XIcon,
} from "lucide-react";

import { cardAge, epicsToColumns, type Board, type Card, type Column, type Epic } from "./board.ts";
import { frameSrc, type OpenField } from "./open.ts";
import {
  addFolder,
  addPreset,
  applyPreset,
  cardMatches,
  epicChildCount,
  filterEpics,
  filterFacets,
  filterValue,
  groupEpics,
  listedFavourites,
  mergeValue,
  moveFavourite,
  overwritePreset,
  removeFolder,
  removePreset,
  renameFolder,
  renamePreset,
  rollbackColumns,
  stampEpic,
  toggleFavourite,
  type BoardFilter,
  type BoardSort,
  type FavouriteState,
  type FilterFacet,
  type Preset,
  type VisibleOpts,
} from "./visible.ts";
import { AgentPanel } from "~/components/agent/agent-panel.tsx";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Button } from "~/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanColumnHandle,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanCommitMeta,
} from "~/components/ui/kanban";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "~/components/ui/resizable";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "~/components/ui/input-group";
import { cn } from "~/lib/utils";
import { useDefaultLayout } from "react-resizable-panels";

const COLLAPSED_KEY = "collapsed-columns";
const COLLAPSED_EPIC_STATUS_KEY = "collapsed-epic-statuses";
const COLLAPSED_FOLDER_KEY = "collapsed-favourite-folders";
const CHROME_KEY = "board-chrome";
const OPENER_KEY = "board-opener";
const FAV_KEY = "favourite-epics";
const PRESET_KEY = "board-presets";
const DEFAULT_COLLAPSED_EPIC_STATUS = [
  "In Progress",
  "Completed",
  "Cancelled",
  "Canceled",
];

type Chrome = {
  filter: BoardFilter;
  sort: BoardSort;
  hide: string[];
};

const DEFAULT_CHROME: Chrome = {
  filter: {},
  sort: "payload",
  hide: [],
};
const DEFAULT_FAVS: FavouriteState = { keys: [], folders: [] };

function readCollapsed(key = COLLAPSED_KEY, fallback: string[] = []): Set<string> {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return new Set(fallback);
    const raw = JSON.parse(stored);
    return new Set(
      Array.isArray(raw) ? raw.filter((item) => typeof item === "string") : fallback,
    );
  } catch {
    return new Set(fallback);
  }
}

function writeCollapsed(next: Set<string>, key = COLLAPSED_KEY) {
  localStorage.setItem(key, JSON.stringify([...next]));
}

function hasStatus(collapsed: Set<string>, status: string) {
  const needle = status.toLowerCase();
  return [...collapsed].some((item) => item.toLowerCase() === needle);
}

function readFilter(raw?: BoardFilter & { priorities?: string[]; assignees?: string[] }): BoardFilter {
  if (!raw || typeof raw !== "object") return {};
  const next: BoardFilter = {};
  for (const [key, values] of Object.entries(raw)) {
    if (key === "priorities" || key === "assignees") continue;
    if (Array.isArray(values)) {
      next[key] = values.filter((item) => typeof item === "string");
    }
  }
  if (Array.isArray(raw.priorities) && !next.priority) {
    next.priority = raw.priorities.filter((item) => typeof item === "string");
  }
  if (Array.isArray(raw.assignees) && !next.assignee) {
    next.assignee = raw.assignees.filter((item) => typeof item === "string");
  }
  return next;
}

function readChrome(): Chrome {
  try {
    const stored = localStorage.getItem(CHROME_KEY);
    if (stored === null) return DEFAULT_CHROME;
    const raw = JSON.parse(stored) as Partial<Chrome> & {
      filter?: BoardFilter & { priorities?: string[]; assignees?: string[] };
    };
    return {
      filter: readFilter(raw.filter),
      sort:
        raw.sort === "priority" || raw.sort === "age" || raw.sort === "due" || raw.sort === "key"
          ? raw.sort
          : "payload",
      hide: Array.isArray(raw.hide) ? raw.hide.filter((item) => typeof item === "string") : [],
    };
  } catch {
    return DEFAULT_CHROME;
  }
}

function writeChrome(next: Chrome) {
  localStorage.setItem(CHROME_KEY, JSON.stringify(next));
}

function readFavourites(): FavouriteState {
  try {
    const stored = localStorage.getItem(FAV_KEY);
    if (stored === null) return DEFAULT_FAVS;
    const raw = JSON.parse(stored) as unknown;
    if (Array.isArray(raw) && raw.every((item) => typeof item === "string")) {
      return { keys: raw, folders: [] };
    }
    if (raw && typeof raw === "object") {
      const value = raw as { keys?: unknown; folders?: unknown };
      const keys = Array.isArray(value.keys)
        ? value.keys.filter((item): item is string => typeof item === "string")
        : [];
      const folders = Array.isArray(value.folders)
        ? value.folders.flatMap((folder) => {
            if (!folder || typeof folder !== "object") return [];
            const item = folder as { name?: unknown; keys?: unknown };
            if (typeof item.name !== "string" || !item.name.trim()) return [];
            return [{
              name: item.name,
              keys: Array.isArray(item.keys)
                ? item.keys.filter((key): key is string => typeof key === "string")
                : [],
            }];
          })
        : [];
      return { keys, folders };
    }
    return DEFAULT_FAVS;
  } catch {
    return DEFAULT_FAVS;
  }
}

function writeFavourites(next: FavouriteState) {
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
}

function readPresets(): Preset[] {
  try {
    const stored = localStorage.getItem(PRESET_KEY);
    if (stored === null) return [];
    const raw = JSON.parse(stored) as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const value = item as {
        name?: unknown;
        filter?: BoardFilter & { priorities?: string[]; assignees?: string[] };
        sort?: unknown;
        hide?: unknown;
      };
      if (typeof value.name !== "string" || !value.name.trim()) return [];
      return [{
        name: value.name,
        filter: readFilter(value.filter),
        sort:
          value.sort === "priority" || value.sort === "age" || value.sort === "due" || value.sort === "key"
            ? value.sort
            : "payload",
        hide: Array.isArray(value.hide) ? value.hide.filter((entry) => typeof entry === "string") : [],
      }];
    });
  } catch {
    return [];
  }
}

function writePresets(next: Preset[]) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(next));
}

function readOpener(): "stories" | "epics" {
  try {
    return localStorage.getItem(OPENER_KEY) === "epics" ? "epics" : "stories";
  } catch {
    return "stories";
  }
}

function writeOpener(next: "stories" | "epics") {
  localStorage.setItem(OPENER_KEY, next);
}

function fieldsFromCard(card: Card, url?: string | null): OpenField[] {
  const rows: OpenField[] = [
    { label: "Key", value: card.key },
    { label: "Summary", value: card.summary },
  ];
  if (url) rows.push({ label: "Jira URL", value: url });
  if (card.priority) rows.push({ label: "Priority", value: card.priority });
  if (card.assignee) rows.push({ label: "Assignee", value: card.assignee });
  if (card.dueDate) rows.push({ label: "Due date", value: card.dueDate });
  if (card.labels?.length) {
    rows.push({ label: "Labels", value: card.labels.join(", "), pills: card.labels });
  }
  return rows;
}

type BoardPayload = Board & { flags?: string };
type Theme = "light" | "dark";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  return res.json() as Promise<T>;
}

function toValue(columns: Column[]): Record<string, Card[]> {
  return Object.fromEntries(columns.map((column) => [column.title, column.cards]));
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
}

const STATUS_CIRCLE = {
  done: "green",
  complete: "green",
  completed: "green",
  closed: "green",
  resolved: "green",
  progress: "yellow",
  review: "yellow",
  doing: "yellow",
  cancelled: "gray",
  canceled: "gray",
} as const;

function statusCircle(title?: string) {
  if (!title) return "var(--primary)";
  const value = title.toLowerCase();
  const match = (Object.keys(STATUS_CIRCLE) as (keyof typeof STATUS_CIRCLE)[]).find(
    (name) => value.includes(name),
  );
  return `var(--kanban-board-circle-${match ? STATUS_CIRCLE[match] : "gray"})`;
}

function priorityClass(priority?: string) {
  const value = (priority ?? "").toLowerCase();
  if (value === "high" || value === "highest" || value === "critical") {
    return "text-red-500";
  }
  if (value === "medium") return "text-orange-400";
  return "text-yellow-500";
}

function toggleList(values: string[], item: string) {
  return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
}

function groupedFacets(facets: FilterFacet[]) {
  const blocks: { group?: string; facets: FilterFacet[] }[] = [];
  for (const facet of facets) {
    const last = blocks.at(-1);
    if (facet.group && last?.group === facet.group) last.facets.push(facet);
    else blocks.push({ group: facet.group, facets: [facet] });
  }
  return blocks;
}

function FilterValues({
  facet,
  selected,
  onToggle,
}: {
  facet: FilterFacet;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <>
      {facet.label === facet.group ? null : <DropdownMenuLabel>{facet.label}</DropdownMenuLabel>}
      {facet.values.map((value) => (
        <DropdownMenuCheckboxItem
          key={value}
          checked={selected.includes(value)}
          onCheckedChange={() => onToggle(value)}
        >
          {value}
        </DropdownMenuCheckboxItem>
      ))}
    </>
  );
}

function FilterMenu({
  facets,
  filter,
  onToggle,
  onClear,
}: {
  facets: FilterFacet[];
  filter: BoardFilter;
  onToggle: (key: string, value: string) => void;
  onClear: () => void;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  return (
    <DropdownMenuContent align="end" className="w-56">
      {groupedFacets(facets).map((block, index) => {
        const body = block.facets.map((facet) => (
          <FilterValues
            key={facet.key}
            facet={facet}
            selected={filter[facet.key] ?? []}
            onToggle={(value) => onToggle(facet.key, value)}
          />
        ));
        return (
          <Fragment key={block.group ?? block.facets[0]?.key}>
            {index > 0 ? <DropdownMenuSeparator /> : null}
            {block.group ? (
              <Collapsible
                open={openGroups[block.group] !== false}
                onOpenChange={(next) =>
                  setOpenGroups((current) => ({ ...current, [block.group!]: next }))
                }
                className="flex flex-col"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] font-medium"
                    onPointerDown={(event) => event.preventDefault()}
                  >
                    <ChevronDownIcon
                      className={cn(
                        "size-3.5 shrink-0 transition-transform",
                        openGroups[block.group] === false && "-rotate-90",
                      )}
                    />
                    {block.group}
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col">
                  {body}
                </CollapsibleContent>
              </Collapsible>
            ) : (
              body
            )}
          </Fragment>
        );
      })}
      {facets.length ? <DropdownMenuSeparator /> : null}
      <DropdownMenuItem onClick={onClear}>Clear Filter, Sort, and Hide</DropdownMenuItem>
    </DropdownMenuContent>
  );
}

function IssueCard({
  card,
  asHandle,
  isOverlay,
  disabled,
  onOpen,
}: {
  card: Card;
  asHandle?: boolean;
  isOverlay?: boolean;
  disabled?: boolean;
  onOpen?: () => void;
}) {
  const age = cardAge(card.created);
  const body = (
    <div className="bg-card hover:bg-foreground/5 rounded-[9px] border px-3 pt-2 pb-3">
      <div className="flex h-[22px] items-center justify-between gap-2">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-muted-foreground text-[12px] font-medium tabular-nums">
            {card.key}
          </span>
          {(card.type ?? "").toLowerCase() === "epic" ? (
            <span className="text-muted-foreground/60 text-[11px] font-normal">
              Epic
            </span>
          ) : null}
        </span>
        {age ? (
          <span className="text-muted-foreground text-[11px] tabular-nums">
            {age}
          </span>
        ) : null}
      </div>
      <p className="mt-0.5 truncate text-[13px] leading-[18px]">{card.summary}</p>
      {card.priority || card.labels?.length || card.assignee || card.dueDate ? (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          {card.priority ? (
            <span
              className={cn(
                "inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[12px] font-medium capitalize",
                priorityClass(card.priority),
              )}
            >
              {card.priority}
            </span>
          ) : null}
          {card.labels?.map((label) => (
            <span
              key={label}
              className="text-muted-foreground inline-flex h-6 shrink-0 items-center rounded-full border px-2 text-[12px]"
            >
              {label}
            </span>
          ))}
          <span className="flex-1" />
          {card.dueDate ? (
            <time className="text-muted-foreground shrink-0 text-[11px] tabular-nums">
              {card.dueDate}
            </time>
          ) : null}
          {card.assignee ? (
            <Avatar title={card.assignee}>
              <AvatarFallback>{card.assignee.charAt(0)}</AvatarFallback>
            </Avatar>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <KanbanItem value={card.key} disabled={disabled}>
      {asHandle && !isOverlay ? (
        <KanbanItemHandle onClick={onOpen}>{body}</KanbanItemHandle>
      ) : (
        body
      )}
    </KanbanItem>
  );
}

function StatusColumn({
  title,
  cards,
  isOverlay,
  disabled,
  onOpen,
  onHide,
}: {
  title: string;
  cards: Card[];
  isOverlay?: boolean;
  disabled?: boolean;
  onOpen?: (key: string) => void;
  onHide?: () => void;
}) {
  const [open, setOpen] = useState(
    () => isOverlay || !readCollapsed().has(title),
  );
  function changeOpen(next: boolean) {
    setOpen(next);
    if (isOverlay) return;
    const collapsed = readCollapsed();
    if (next) collapsed.delete(title);
    else collapsed.add(title);
    writeCollapsed(collapsed);
  }
  return (
    <KanbanColumn value={title} className="group h-full min-h-0">
      <Collapsible
        open={open}
        onOpenChange={changeOpen}
        className={cn("flex h-full min-h-0 flex-col", !open && "h-auto")}
      >
        <div className={cn("flex flex-col", open ? "h-full min-h-0" : "h-auto")}>
          <div className="flex items-center gap-2 px-3 pt-[13px] pb-5">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <span
                  className="size-3.5 shrink-0 rounded-full"
                  style={{ backgroundColor: statusCircle(title) }}
                />
                <span className="truncate text-[13px] font-medium">{title}</span>
                <span className="text-muted-foreground text-[12px] tabular-nums">
                  {cards.length}
                </span>
                <ChevronDownIcon
                  className={cn(
                    "text-muted-foreground size-3.5 shrink-0 transition-transform",
                    !open && "-rotate-90",
                  )}
                />
              </button>
            </CollapsibleTrigger>
            {onHide ? (
              <Button
                size="icon-xs"
                variant="ghost"
                type="button"
                aria-label={`Hide ${title}`}
                onClick={onHide}
              >
                <EyeOffIcon />
              </Button>
            ) : null}
            <KanbanColumnHandle className="opacity-0 transition-opacity group-hover:opacity-60">
              <Button size="icon-xs" variant="ghost" tabIndex={-1} type="button">
                <GripVerticalIcon />
              </Button>
            </KanbanColumnHandle>
          </div>
          <CollapsibleContent className="min-h-0 flex-1 overflow-hidden">
            <KanbanColumnContent
              value={title}
              className="flex h-full flex-col gap-2 overflow-auto px-2 pb-2"
            >
              {cards.map((card) => (
                <IssueCard
                  key={card.key}
                  card={card}
                  asHandle={!isOverlay}
                  isOverlay={isOverlay}
                  disabled={disabled}
                  onOpen={() => onOpen?.(card.key)}
                />
              ))}
            </KanbanColumnContent>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </KanbanColumn>
  );
}

function epicMoveTargets(epics: Epic[], current?: string) {
  return [...new Set(
    epics
      .map((item) => item.status?.trim())
      .filter((status): status is string => Boolean(status)),
  )].filter((status) => status !== current);
}

function EpicButton({
  epic,
  selected,
  count,
  favourited,
  folders,
  moveTo,
  onSelect,
  onToggleFavourite,
  onFile,
  onMove,
  onOpen,
}: {
  epic: Epic;
  selected: boolean;
  count: number;
  favourited: boolean;
  folders?: string[];
  moveTo?: string[];
  onSelect: (key: string | null) => void;
  onToggleFavourite: (key: string) => void;
  onFile?: (key: string, folder: string | null) => void;
  onMove?: (key: string, status: string) => void;
  onOpen?: (key: string) => void;
}) {
  const destinations = moveTo ?? [];
  const fileMenu = Boolean(onFile && favourited);
  const showMenu = Boolean(onOpen) || fileMenu || destinations.length > 0;
  return (
    <div
      className={cn(
        "flex h-14 w-full items-center gap-1 rounded-lg pr-1",
        selected
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "hover:bg-foreground/5",
      )}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-3 px-3 text-left"
        onClick={() => void onSelect(epic.key)}
      >
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: statusCircle(epic.status) }}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px]">
          {epic.summary}
        </span>
        <span className="text-muted-foreground text-[11px] font-medium tabular-nums">
          {epic.key}
        </span>
        <span className="text-muted-foreground text-[11px] tabular-nums">{count}</span>
      </button>
      {showMenu ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon-xs"
              variant="ghost"
              type="button"
              aria-label={fileMenu ? `File ${epic.key}` : destinations.length ? `Move ${epic.key}` : `Open ${epic.key}`}
            >
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onOpen ? (
              <DropdownMenuItem onClick={() => onOpen(epic.key)}>Open</DropdownMenuItem>
            ) : null}
            {fileMenu ? (
              <>
                <DropdownMenuItem onClick={() => onFile?.(epic.key, null)}>Unfiled</DropdownMenuItem>
                {folders?.map((folder) => (
                  <DropdownMenuItem key={folder} onClick={() => onFile?.(epic.key, folder)}>
                    {folder}
                  </DropdownMenuItem>
                ))}
              </>
            ) : null}
            {fileMenu && destinations.length ? (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Move</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {destinations.map((status) => (
                    <DropdownMenuItem key={status} onClick={() => onMove?.(epic.key, status)}>
                      {status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ) : null}
            {!fileMenu
              ? destinations.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => onMove?.(epic.key, status)}>
                    {status}
                  </DropdownMenuItem>
                ))
              : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button
        size="icon-xs"
        variant="ghost"
        type="button"
        aria-label={favourited ? `Unfavourite ${epic.key}` : `Favourite ${epic.key}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggleFavourite(epic.key);
        }}
      >
        <StarIcon className={cn(favourited && "fill-current")} />
      </Button>
    </div>
  );
}

function EpicStatusGroup({
  status,
  epics,
  selectedEpic,
  childCount,
  favourites,
  listedEpics,
  onSelect,
  onToggleFavourite,
  onMove,
  onOpen,
}: {
  status: string;
  epics: Epic[];
  selectedEpic: string | null;
  childCount: (key: string) => number;
  favourites: FavouriteState;
  listedEpics: Epic[];
  onSelect: (key: string | null) => void;
  onToggleFavourite: (key: string) => void;
  onMove: (key: string, status: string) => void;
  onOpen: (key: string) => void;
}) {
  const [open, setOpen] = useState(
    () => !hasStatus(readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS), status),
  );
  function changeOpen(next: boolean) {
    setOpen(next);
    const collapsed = readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS);
    if (next) {
      for (const item of [...collapsed]) {
        if (item.toLowerCase() === status.toLowerCase()) collapsed.delete(item);
      }
    } else {
      collapsed.add(status);
    }
    writeCollapsed(collapsed, COLLAPSED_EPIC_STATUS_KEY);
  }
  return (
    <Collapsible open={open} onOpenChange={changeOpen} className="flex flex-col">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex h-7 items-center gap-1.5 px-3 text-left"
        >
          <ChevronDownIcon
            className={cn(
              "size-3.5 shrink-0 transition-transform",
              !open && "-rotate-90",
            )}
          />
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
            {status}
          </span>
          <span className="text-[11px] tabular-nums">{epics.length}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {epics.map((epic) => (
          <EpicButton
            key={epic.key}
            epic={epic}
            selected={selectedEpic === epic.key}
            count={childCount(epic.key)}
            favourited={favourites.keys.includes(epic.key)}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
            moveTo={epicMoveTargets(listedEpics, epic.status)}
            onMove={onMove}
            onOpen={onOpen}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function OpenFields({ fields }: { fields: OpenField[] }) {
  return (
    <dl className="flex flex-col gap-3 p-4 text-[13px]">
      {fields.map((field) => (
        <div key={field.label} className="flex flex-col gap-1">
          <dt className="text-muted-foreground text-[11px] font-medium">{field.label}</dt>
          <dd className="whitespace-pre-wrap">
            {field.label === "Jira URL" ? (
              <a
                className="text-foreground font-medium underline-offset-4 hover:underline"
                href={field.value}
                target="_blank"
                rel="noreferrer"
              >
                {field.value}
              </a>
            ) : field.pills?.length ? (
              <span className="flex flex-wrap gap-1">
                {field.pills.map((pill) => (
                  <span
                    key={pill}
                    className="text-muted-foreground inline-flex h-6 items-center rounded-full border px-2 text-[12px]"
                  >
                    {pill}
                  </span>
                ))}
              </span>
            ) : (
              field.value
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function App() {
  const [columns, setColumns] = useState<Record<string, Card[]>>({});
  const [epics, setEpics] = useState<Epic[]>([]);
  const [epicChildren, setEpicChildren] = useState<Card[] | null>(null);
  const [agentOpen, setAgentOpen] = useState(false);
  const [selectedEpic, setSelectedEpic] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [openFields, setOpenFields] = useState<OpenField[]>([]);
  const [openError, setOpenError] = useState("");
  const [flags, setFlags] = useState("");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [chrome, setChrome] = useState<Chrome>(readChrome);
  const [favourites, setFavourites] = useState<FavouriteState>(readFavourites);
  const [presets, setPresets] = useState<Preset[]>(readPresets);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState("");
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState("");
  const [boardKind, setBoardKind] = useState<"stories" | "epics">(readOpener);
  const lastBoard = useRef<Board | null>(null);

  const visibleOpts: VisibleOpts = { ...chrome, epics };
  const epicBoard = boardKind === "epics";
  const visible = useMemo(
    () => filterValue(columns, epicBoard ? null : selectedEpic, search, visibleOpts),
    [columns, selectedEpic, search, chrome, epics, epicBoard],
  );
  const allCards = useMemo(() => Object.values(columns).flat(), [columns]);
  const childrenList = epicChildren ?? allCards;
  const visibleEpics = useMemo(
    () => filterEpics(epics, childrenList, search, chrome.filter),
    [epics, childrenList, search, chrome.filter],
  );
  const epicGroups = useMemo(() => groupEpics(visibleEpics), [visibleEpics]);
  const favouritePane = useMemo(
    () => listedFavourites(epics, favourites, search, childrenList, chrome.filter),
    [epics, favourites, search, childrenList, chrome.filter],
  );
  const columnIds = Object.keys(visible);
  const boardOpenIds = openKey ? ["cards", "open"] : ["cards"];
  const shellLayout = useDefaultLayout({
    id: "shell",
    panelIds: ["epics", "board"],
    onlySaveAfterUserInteractions: true,
  });
  const boardOpenLayout = useDefaultLayout({
    id: "board-open",
    panelIds: boardOpenIds,
    onlySaveAfterUserInteractions: true,
  });
  const columnLayout = useDefaultLayout({
    id: "columns",
    panelIds: columnIds,
    onlySaveAfterUserInteractions: true,
  });
  const embed = openUrl
    ? frameSrc(openUrl, window.location.origin)
    : null;
  const facets = filterFacets(allCards, epics);
  const memoryStatuses = Object.keys(columns);
  const showFavourites =
    favouritePane.unfiled.length > 0 || favouritePane.folders.length > 0;

  function persistChrome(next: Chrome) {
    setChrome(next);
    writeChrome(next);
  }

  function persistFavourites(next: FavouriteState) {
    setFavourites(next);
    writeFavourites(next);
  }

  function persistPresets(next: Preset[]) {
    setPresets(next);
    writePresets(next);
  }

  function paintBoard(next: Board, kind: "stories" | "epics") {
    const listed = next.epics ?? [];
    setColumns(kind === "epics" ? toValue(epicsToColumns(listed)) : toValue(next.columns));
    setEpics(listed);
    setEpicChildren(next.children ? Object.values(next.children).flat() : null);
    if (next.error) setError(next.error);
  }

  function applyBoard(next: Board) {
    lastBoard.current = next;
    const listed = next.epics ?? [];
    setColumns(boardKind === "epics" ? toValue(epicsToColumns(listed)) : toValue(next.columns));
    setEpics(listed);
    setEpicChildren(next.children ? Object.values(next.children).flat() : null);
    setSelectedEpic((current) =>
      current && (next.epics ?? []).some((epic) => epic.key === current)
        ? current
        : null,
    );
    if (next.error) setError(next.error);
  }

  async function load() {
    const data = await api<BoardPayload>("/api/board");
    applyBoard(data);
    if (data.flags) setFlags(data.flags);
  }

  useEffect(() => {
    void load();
  }, []);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const data = await api<BoardPayload>("/api/refresh", {
        method: "POST",
        body: JSON.stringify({ flags }),
      });
      applyBoard(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setBusy(false);
    }
  }

  async function move(key: string, status: string) {
    setBusy(true);
    setError("");
    try {
      const data = await api<{
        ok: boolean;
        error?: string;
        board: Board;
      }>("/api/move", {
        method: "POST",
        body: JSON.stringify({ key, status }),
      });
      applyBoard(data.board);
      if (!data.ok) setError(data.error ?? "Move failed");
    } finally {
      setBusy(false);
    }
  }

  async function open(key: string) {
    const card = allCards.find((item) => item.key === key);
    const epic = epics.find((item) => item.key === key);
    const face = card ?? (epic
      ? {
          key: epic.key,
          summary: epic.summary,
          priority: epic.priority,
          assignee: epic.assignee,
          dueDate: epic.dueDate,
          labels: epic.labels,
        }
      : undefined);
    const immediateUrl = `/browse/${key}`;
    setOpenKey(key);
    setOpenUrl(immediateUrl);
    setOpenError("");
    setOpenFields(face ? fieldsFromCard(face, immediateUrl) : [{ label: "Jira URL", value: immediateUrl }]);
    const data = await api<{ url: string; fields: OpenField[]; error?: string }>("/api/open", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    setOpenUrl(data.url);
    if (data.error) {
      setOpenError(data.error);
      setOpenFields(face ? fieldsFromCard(face, data.url) : [{ label: "Jira URL", value: data.url }]);
      return;
    }
    setOpenFields(data.fields);
  }

  function commit(_next: Record<string, Card[]>, meta: KanbanCommitMeta<Card>) {
    if (
      meta.kind === "column" ||
      meta.activeContainer === meta.overContainer ||
      chrome.hide.includes(meta.overContainer)
    ) {
      setColumns((current) =>
        rollbackColumns(meta.previousValue, current, selectedEpic, search, visibleOpts),
      );
      return;
    }
    void move(String(meta.event.active.id), meta.overContainer);
  }

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
  }

  function childCount(key: string) {
    return epicChildCount(childrenList, key, search, chrome.filter, epics);
  }

  function openStories() {
    writeOpener("stories");
    setBoardKind("stories");
    setSelectedEpic(null);
    if (lastBoard.current) paintBoard(lastBoard.current, "stories");
  }

  function openEpics() {
    writeOpener("epics");
    setBoardKind("epics");
    setSelectedEpic(null);
    if (lastBoard.current) paintBoard(lastBoard.current, "epics");
  }

  async function selectEpic(key: string | null) {
    const fromEpics = boardKind === "epics";
    if (fromEpics) openStories();
    setSelectedEpic(key);
    if (!key) return;
    const cards =
      fromEpics && lastBoard.current
        ? lastBoard.current.columns.flatMap((column) => column.cards)
        : allCards;
    if (cards.filter((card) => card.epic === key && cardMatches(card, search)).length > 0) return;
    setBusy(true);
    setError("");
    try {
      const data = await api<Board>("/api/epic", {
        method: "POST",
        body: JSON.stringify({ key }),
      });
      setColumns((current) => stampEpic(current, toValue(data.columns), key));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Epic list failed");
    } finally {
      setBusy(false);
    }
  }

  function createFolder() {
    const result = addFolder(favourites, folderName);
    if (!result.ok) {
      setFolderError("Folder names must be unique");
      return;
    }
    setFolderName("");
    setFolderError("");
    persistFavourites(result.state);
  }

  function createPreset() {
    const result = addPreset(presets, presetName, chrome);
    if (!result.ok) {
      setPresetError("Preset names must be unique");
      return;
    }
    setPresetName("");
    setPresetError("");
    persistPresets(result.presets);
  }

  function applyNamedPreset(name: string) {
    const result = applyPreset(presets, name);
    if (!result.ok) return;
    persistChrome(result.chrome);
    if (boardKind === "epics") openStories();
  }

  function overwriteNamedPreset(name: string) {
    const result = overwritePreset(presets, name, chrome);
    if (!result.ok) return;
    persistPresets(result.presets);
  }

  function renameNamedPreset(from: string, to: string) {
    const result = renamePreset(presets, from, to);
    if (!result.ok) {
      setPresetError("Preset names must be unique");
      return;
    }
    setPresetError("");
    persistPresets(result.presets);
  }

  return (
    <div className="bg-sidebar flex h-screen">
      <ResizablePanelGroup
        id="shell"
        orientation="horizontal"
        className="min-h-0 flex-1"
        defaultLayout={shellLayout.defaultLayout}
        onLayoutChanged={shellLayout.onLayoutChanged}
      >
        <ResizablePanel
          id="epics"
          defaultSize="244px"
          minSize="12rem"
          maxSize="40%"
          className="min-h-0"
        >
          <aside className="text-sidebar-foreground flex h-full min-h-0 flex-col">
            <div className="flex h-10 items-center justify-between px-4">
              <span className="text-[13px] font-medium">pipe-kan</span>
              <span className="text-muted-foreground text-[12px] tabular-nums">
                {visibleEpics.length}
              </span>
            </div>
            <nav className="flex flex-1 flex-col gap-0.5 overflow-auto px-2 pb-2">
              <button
                type="button"
                className={cn(
                  "h-8 rounded-lg px-3 text-left text-[13px]",
                  boardKind === "stories" && selectedEpic === null
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-foreground/5",
                )}
                onClick={openStories}
              >
                All stories
              </button>
              <button
                type="button"
                className={cn(
                  "h-8 rounded-lg px-3 text-left text-[13px]",
                  boardKind === "epics"
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-foreground/5",
                )}
                onClick={openEpics}
              >
                All epics
              </button>
              {showFavourites ? (
                <FavouriteGroup
                  pane={favouritePane}
                  selectedEpic={selectedEpic}
                  childCount={childCount}
                  favourites={favourites}
                  folderName={folderName}
                  folderError={folderError}
                  onFolderName={setFolderName}
                  onCreateFolder={createFolder}
                  onRenameFolder={(from, to) => {
                    const result = renameFolder(favourites, from, to);
                    if (!result.ok) {
                      setFolderError("Folder names must be unique");
                      return;
                    }
                    setFolderError("");
                    persistFavourites(result.state);
                  }}
                  onDeleteFolder={(name) => persistFavourites(removeFolder(favourites, name))}
                  listedEpics={epics}
                  onSelect={selectEpic}
                  onToggleFavourite={(key) => persistFavourites(toggleFavourite(favourites, key))}
                  onFile={(key, folder) => persistFavourites(moveFavourite(favourites, key, folder))}
                  onMove={move}
                  onOpen={open}
                />
              ) : null}
              <PresetGroup
                presets={presets}
                presetName={presetName}
                presetError={presetError}
                onPresetName={setPresetName}
                onCreatePreset={createPreset}
                onApplyPreset={applyNamedPreset}
                onOverwritePreset={overwriteNamedPreset}
                onRenamePreset={renameNamedPreset}
                onDeletePreset={(name) => persistPresets(removePreset(presets, name))}
              />
              <div className="text-muted-foreground px-3 pt-3 pb-1 text-[11px] font-medium">
                Epics
              </div>
              {epicGroups.map((group) =>
                group.status ? (
                  <EpicStatusGroup
                    key={group.status}
                    status={group.status}
                    epics={group.epics}
                    selectedEpic={selectedEpic}
                    childCount={childCount}
                    favourites={favourites}
                    listedEpics={epics}
                    onSelect={selectEpic}
                    onToggleFavourite={(key) => persistFavourites(toggleFavourite(favourites, key))}
                    onMove={move}
                    onOpen={open}
                  />
                ) : (
                  group.epics.map((epic) => (
                    <EpicButton
                      key={epic.key}
                      epic={epic}
                      selected={selectedEpic === epic.key}
                      count={childCount(epic.key)}
                      favourited={favourites.keys.includes(epic.key)}
                      moveTo={epicMoveTargets(epics, epic.status)}
                      onSelect={selectEpic}
                      onToggleFavourite={(key) => persistFavourites(toggleFavourite(favourites, key))}
                      onMove={move}
                      onOpen={open}
                    />
                  ))
                ),
              )}
            </nav>
          </aside>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel id="board" defaultSize="80%" minSize="24rem" className="min-h-0">
          <div className="flex h-full min-h-0 flex-col p-2 pl-0">
            <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border">
              <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-2 px-3">
                <strong className="text-[13px] font-medium">Board</strong>
                <InputGroup className="h-7 max-w-72 min-w-40 flex-1 border-transparent bg-muted shadow-none">
                  <InputGroupAddon>
                    <SearchIcon className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search Epics and Cards"
                    aria-label="Search"
                    className="h-7 text-[13px]"
                  />
                  {search ? (
                    <InputGroupAddon align="inline-end">
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        <XIcon className="size-3.5" />
                      </button>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
                <input
                  className="placeholder:text-muted-foreground h-7 min-w-40 flex-1 rounded-md bg-muted px-2.5 text-[13px] outline-none"
                  value={flags}
                  onChange={(event) => setFlags(event.target.value)}
                  placeholder="Scope flags"
                  spellCheck={false}
                  aria-label="Scope flags"
                />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ListFilterIcon />
                      Filter
                    </Button>
                  </DropdownMenuTrigger>
                  <FilterMenu
                    facets={facets}
                    filter={chrome.filter}
                    onToggle={(key, value) =>
                      persistChrome({
                        ...chrome,
                        filter: {
                          ...chrome.filter,
                          [key]: toggleList(chrome.filter[key] ?? [], value),
                        },
                      })
                    }
                    onClear={() => persistChrome(DEFAULT_CHROME)}
                  />
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <ArrowUpDownIcon />
                      Sort
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuRadioGroup
                      value={chrome.sort}
                      onValueChange={(value) =>
                        persistChrome({ ...chrome, sort: value as BoardSort })
                      }
                    >
                      <DropdownMenuRadioItem value="payload">Payload order</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="priority">Priority</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="age">Age</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="due">Due date</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="key">Key</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <Columns3Icon />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {memoryStatuses.map((status) => (
                      <DropdownMenuCheckboxItem
                        key={status}
                        checked={!chrome.hide.includes(status)}
                        onCheckedChange={(checked) =>
                          persistChrome({
                            ...chrome,
                            hide: checked
                              ? chrome.hide.filter((item) => item !== status)
                              : [...chrome.hide, status],
                          })
                        }
                      >
                        {status}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="sm" onClick={() => void refresh()} disabled={busy}>
                  Refresh
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgentOpen((o) => !o)}
                  aria-pressed={agentOpen}
                >
                  <BotIcon className="mr-1 size-4" />
                  Agent
                </Button>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {theme === "dark" ? <SunIcon /> : <MoonIcon />}
                </Button>
                {error ? (
                  <p className="text-destructive w-full text-[13px] whitespace-pre-wrap">
                    {error}
                  </p>
                ) : null}
              </header>
              <ResizablePanelGroup
                id="board-open"
                orientation="horizontal"
                className="min-h-0 flex-1"
                defaultLayout={boardOpenLayout.defaultLayout}
                onLayoutChanged={boardOpenLayout.onLayoutChanged}
              >
                <ResizablePanel
                  id="cards"
                  defaultSize={openKey ? "70%" : "100%"}
                  minSize="16rem"
                  className="min-h-0"
                >
                  <main className="h-full min-h-0 min-w-0 overflow-auto px-2 pb-2">
                    <Kanban
                      className="h-full min-h-0"
                      value={visible}
                      onValueChange={(next) =>
                        setColumns((previous) =>
                          mergeValue(next, previous, selectedEpic, search, visibleOpts),
                        )
                      }
                      getItemValue={(card) => card.key}
                      restoreOnCancel
                      onValueCommit={commit}
                    >
                      <KanbanBoard className="grid h-full min-h-0 grid-cols-1 auto-rows-fr gap-3">
                        {columnIds.length ? (
                        <ResizablePanelGroup
                          id="columns"
                          orientation="horizontal"
                          className="min-h-0"
                          defaultLayout={columnLayout.defaultLayout}
                          onLayoutChanged={columnLayout.onLayoutChanged}
                        >
                          {Object.entries(visible).map(([title, cards], index, all) => (
                            <Fragment key={title}>
                              {index > 0 ? <ResizableHandle /> : null}
                              <ResizablePanel
                                id={title}
                                defaultSize={`${100 / Math.max(all.length, 1)}%`}
                                minSize="16rem"
                                className="min-h-0 min-w-0"
                              >
                                <StatusColumn
                                  title={title}
                                  cards={cards}
                                  disabled={busy}
                                  onOpen={(key) => void open(key)}
                                  onHide={() =>
                                    persistChrome({ ...chrome, hide: [...chrome.hide, title] })
                                  }
                                />
                              </ResizablePanel>
                            </Fragment>
                          ))}
                        </ResizablePanelGroup>
                        ) : null}
                      </KanbanBoard>
                      <KanbanOverlay>
                        {({ value, variant }) => {
                          if (variant === "column") {
                            return (
                              <StatusColumn
                                title={String(value)}
                                cards={visible[String(value)] ?? []}
                                isOverlay
                              />
                            );
                          }
                          const card = Object.values(visible)
                            .flat()
                            .find((item) => item.key === value);
                          if (!card) return null;
                          return <IssueCard card={card} isOverlay />;
                        }}
                      </KanbanOverlay>
                    </Kanban>
                  </main>
                </ResizablePanel>
                {openKey ? (
                  <>
                    <ResizableHandle />
                    <ResizablePanel
                      id="open"
                      defaultSize="30%"
                      minSize="16rem"
                      className="min-h-0"
                    >
                      <aside className="flex h-full min-h-0 flex-col border-l">
                        <div className="flex h-10 items-center gap-2 px-3">
                          <a
                            className="min-w-0 flex-1 truncate text-[13px] font-medium underline-offset-4 hover:underline"
                            href={openUrl ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {openKey}
                          </a>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            aria-label="Close issue"
                            onClick={() => {
                              setOpenKey(null);
                              setOpenUrl(null);
                              setOpenFields([]);
                              setOpenError("");
                            }}
                          >
                            <XIcon />
                          </Button>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto">
                          {openError ? (
                            <p className="text-destructive px-4 pt-3 text-[13px] whitespace-pre-wrap">
                              {openError}
                            </p>
                          ) : null}
                          <OpenFields fields={openFields} />
                          {embed ? (
                            <iframe
                              title={openKey ?? "Issue"}
                              src={embed}
                              className="min-h-64 w-full border-0 bg-background"
                            />
                          ) : openUrl ? (
                            <div className="text-muted-foreground px-4 pb-6 text-[13px]">
                              Jira refuses to embed this page.
                            </div>
                          ) : null}
                        </div>
                      </aside>
                    </ResizablePanel>
                  </>
                ) : null}
              </ResizablePanelGroup>
            </div>
          </div>
        </ResizablePanel>
        {agentOpen ? (
          <>
            <ResizableHandle />
            <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

function FavouriteGroup({
  pane,
  selectedEpic,
  childCount,
  favourites,
  folderName,
  folderError,
  onFolderName,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  listedEpics,
  onSelect,
  onToggleFavourite,
  onFile,
  onMove,
  onOpen,
}: {
  pane: ReturnType<typeof listedFavourites>;
  selectedEpic: string | null;
  childCount: (key: string) => number;
  favourites: FavouriteState;
  folderName: string;
  folderError: string;
  onFolderName: (value: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: (from: string, to: string) => void;
  onDeleteFolder: (name: string) => void;
  listedEpics: Epic[];
  onSelect: (key: string | null) => void;
  onToggleFavourite: (key: string) => void;
  onFile: (key: string, folder: string | null) => void;
  onMove: (key: string, status: string) => void;
  onOpen: (key: string) => void;
}) {
  const [open, setOpen] = useState(
    () => !hasStatus(readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS), "Favourites"),
  );
  function changeOpen(next: boolean) {
    setOpen(next);
    const collapsed = readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS);
    if (next) {
      for (const item of [...collapsed]) {
        if (item.toLowerCase() === "favourites") collapsed.delete(item);
      }
    } else {
      collapsed.add("Favourites");
    }
    writeCollapsed(collapsed, COLLAPSED_EPIC_STATUS_KEY);
  }
  const folderNames = favourites.folders.map((folder) => folder.name);
  return (
    <Collapsible open={open} onOpenChange={changeOpen} className="flex flex-col">
      <div className="flex items-center gap-1 px-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex h-7 min-w-0 flex-1 items-center gap-1.5 px-2 text-left"
          >
            <ChevronDownIcon
              className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
            />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">Favourites</span>
          </button>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" type="button" aria-label="Favourite Folders">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Create Folder</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <input
                className="border-input h-7 w-full rounded-md border bg-transparent px-2 text-[13px] outline-none"
                value={folderName}
                onChange={(event) => onFolderName(event.target.value)}
                placeholder="Name"
                aria-label="Folder name"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCreateFolder();
                }}
              />
              {folderError ? (
                <p className="text-destructive pt-1 text-[11px]">{folderError}</p>
              ) : null}
            </div>
            <DropdownMenuItem onClick={onCreateFolder}>Create</DropdownMenuItem>
            {folderNames.length ? <DropdownMenuSeparator /> : null}
            {folderNames.map((name) => (
              <DropdownMenuItem
                key={`rename-${name}`}
                onClick={() => {
                  const next = window.prompt("Rename Folder", name);
                  if (next != null) onRenameFolder(name, next);
                }}
              >
                Rename {name}
              </DropdownMenuItem>
            ))}
            {folderNames.map((name) => (
              <DropdownMenuItem key={`delete-${name}`} onClick={() => onDeleteFolder(name)}>
                Delete {name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {pane.unfiled.map((epic) => (
          <EpicButton
            key={epic.key}
            epic={epic}
            selected={selectedEpic === epic.key}
            count={childCount(epic.key)}
            favourited
            folders={folderNames}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
            onFile={onFile}
            moveTo={epicMoveTargets(listedEpics, epic.status)}
            onMove={onMove}
            onOpen={onOpen}
          />
        ))}
        {pane.folders.map((folder) => (
          <FavouriteFolderGroup
            key={folder.name}
            folder={folder}
            selectedEpic={selectedEpic}
            childCount={childCount}
            folderNames={folderNames}
            listedEpics={listedEpics}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
            onFile={onFile}
            onMove={onMove}
            onOpen={onOpen}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function FavouriteFolderGroup({
  folder,
  selectedEpic,
  childCount,
  folderNames,
  listedEpics,
  onSelect,
  onToggleFavourite,
  onFile,
  onMove,
  onOpen,
}: {
  folder: { name: string; epics: Epic[] };
  selectedEpic: string | null;
  childCount: (key: string) => number;
  folderNames: string[];
  listedEpics: Epic[];
  onSelect: (key: string | null) => void;
  onToggleFavourite: (key: string) => void;
  onFile: (key: string, folder: string | null) => void;
  onMove: (key: string, status: string) => void;
  onOpen: (key: string) => void;
}) {
  const [open, setOpen] = useState(
    () => !hasStatus(readCollapsed(COLLAPSED_FOLDER_KEY), folder.name),
  );
  function changeOpen(next: boolean) {
    setOpen(next);
    const collapsed = readCollapsed(COLLAPSED_FOLDER_KEY);
    if (next) {
      for (const item of [...collapsed]) {
        if (item.toLowerCase() === folder.name.toLowerCase()) collapsed.delete(item);
      }
    } else {
      collapsed.add(folder.name);
    }
    writeCollapsed(collapsed, COLLAPSED_FOLDER_KEY);
  }
  return (
    <Collapsible open={open} onOpenChange={changeOpen} className="flex flex-col">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex h-7 items-center gap-1.5 px-3 text-left"
        >
          <ChevronDownIcon
            className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
          />
          <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{folder.name}</span>
          <span className="text-[11px] tabular-nums">{folder.epics.length}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {folder.epics.map((epic) => (
          <EpicButton
            key={epic.key}
            epic={epic}
            selected={selectedEpic === epic.key}
            count={childCount(epic.key)}
            favourited
            folders={folderNames}
            onSelect={onSelect}
            onToggleFavourite={onToggleFavourite}
            onFile={onFile}
            moveTo={epicMoveTargets(listedEpics, epic.status)}
            onMove={onMove}
            onOpen={onOpen}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PresetGroup({
  presets,
  presetName,
  presetError,
  onPresetName,
  onCreatePreset,
  onApplyPreset,
  onOverwritePreset,
  onRenamePreset,
  onDeletePreset,
}: {
  presets: Preset[];
  presetName: string;
  presetError: string;
  onPresetName: (value: string) => void;
  onCreatePreset: () => void;
  onApplyPreset: (name: string) => void;
  onOverwritePreset: (name: string) => void;
  onRenamePreset: (from: string, to: string) => void;
  onDeletePreset: (name: string) => void;
}) {
  const [open, setOpen] = useState(
    () => !hasStatus(readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS), "Presets"),
  );
  function changeOpen(next: boolean) {
    setOpen(next);
    const collapsed = readCollapsed(COLLAPSED_EPIC_STATUS_KEY, DEFAULT_COLLAPSED_EPIC_STATUS);
    if (next) {
      for (const item of [...collapsed]) {
        if (item.toLowerCase() === "presets") collapsed.delete(item);
      }
    } else {
      collapsed.add("Presets");
    }
    writeCollapsed(collapsed, COLLAPSED_EPIC_STATUS_KEY);
  }
  return (
    <Collapsible open={open} onOpenChange={changeOpen} className="flex flex-col">
      <div className="flex items-center gap-1 px-1">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground flex h-7 min-w-0 flex-1 items-center gap-1.5 px-2 text-left"
          >
            <ChevronDownIcon
              className={cn("size-3.5 shrink-0 transition-transform", !open && "-rotate-90")}
            />
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">Presets</span>
          </button>
        </CollapsibleTrigger>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon-xs" variant="ghost" type="button" aria-label="Presets">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel>Save Preset</DropdownMenuLabel>
            <div className="px-2 pb-2">
              <input
                className="border-input h-7 w-full rounded-md border bg-transparent px-2 text-[13px] outline-none"
                value={presetName}
                onChange={(event) => onPresetName(event.target.value)}
                placeholder="Name"
                aria-label="Preset name"
                onKeyDown={(event) => {
                  if (event.key === "Enter") onCreatePreset();
                }}
              />
              {presetError ? (
                <p className="text-destructive pt-1 text-[11px]">{presetError}</p>
              ) : null}
            </div>
            <DropdownMenuItem onClick={onCreatePreset}>Save</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <CollapsibleContent className="flex flex-col gap-0.5">
        {presets.map((preset) => (
          <div key={preset.name} className="flex items-center gap-1">
            <button
              type="button"
              className="hover:bg-foreground/5 flex h-7 min-w-0 flex-1 items-center rounded-lg px-[7px] text-left text-[13px] font-medium"
              onClick={() => onApplyPreset(preset.name)}
            >
              <span className="min-w-0 truncate">{preset.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-xs" variant="ghost" type="button" aria-label={`Preset ${preset.name}`}>
                  <MoreHorizontalIcon />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOverwritePreset(preset.name)}>
                  Save over
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const next = window.prompt("Rename Preset", preset.name);
                    if (next != null) onRenamePreset(preset.name, next);
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDeletePreset(preset.name)}>
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
