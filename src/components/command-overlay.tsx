import { useState, type KeyboardEvent } from "react";
import { SearchIcon, StarIcon } from "lucide-react";

import type { Card, Epic } from "~/board.ts";
import { commandCatalog, commandPick, type CommandJump, type CommandRow } from "~/command.ts";
import { cn } from "~/lib/utils";

function rowId(row: CommandRow) {
  return row.key ? `${row.jump.kind}:${row.key}` : row.label;
}

export function CommandOverlay({
  presets,
  epics,
  cards,
  favouriteKeys,
  onPick,
  onClose,
}: {
  presets: string[];
  epics: Epic[];
  cards: Card[];
  favouriteKeys: string[];
  onPick: (jump: CommandJump) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = commandCatalog({ presets, query, epics, cards, favouriteKeys });
  const rows = groups.flatMap((group) => group.rows);
  const highlight = rows.length ? Math.min(active, rows.length - 1) : 0;

  function move(delta: number) {
    if (!rows.length) return;
    setActive((current) => {
      const index = Math.min(current, rows.length - 1);
      return (index + delta + rows.length) % rows.length;
    });
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const row = rows[highlight];
      if (row) onPick(commandPick(row));
    }
  }

  let offset = 0;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command"
        className="bg-popover text-popover-foreground h-fit w-full max-w-lg overflow-hidden rounded-xl border shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex h-11 items-center gap-2 border-b px-3">
          <SearchIcon className="text-muted-foreground size-3.5 shrink-0" />
          <input
            autoFocus
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            aria-label="Command"
            placeholder="Jump to Epic, Card, or Action"
            className="placeholder:text-muted-foreground h-11 min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
          {query ? null : (
            <kbd className="text-muted-foreground rounded border px-1.5 py-0.5 text-[11px]">⌘K</kbd>
          )}
        </div>
        {groups.length ? (
          <div className="max-h-[min(20rem,calc(82vh-3rem))] overflow-auto p-1">
            {groups.map((group) => {
              const start = offset;
              offset += group.rows.length;
              return (
                <div key={group.id}>
                  <div className="text-muted-foreground px-2 py-1.5 text-[11px] font-medium">
                    {group.title}
                  </div>
                  {group.rows.map((row, i) => {
                    const index = start + i;
                    return (
                      <button
                        key={rowId(row)}
                        type="button"
                        aria-label={row.key ? `${row.key} ${row.label}` : row.label}
                        className={cn(
                          "flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]",
                          index === highlight
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-foreground/5",
                        )}
                        onMouseDown={(event) => event.preventDefault()}
                        onMouseEnter={() => setActive(index)}
                        onClick={() => onPick(commandPick(row))}
                      >
                        {row.key ? (
                          <span className="text-muted-foreground shrink-0 text-[12px] font-medium tabular-nums">
                            {row.key}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate">{row.label}</span>
                        {row.starred ? (
                          <StarIcon className="size-3.5 shrink-0 fill-current" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
