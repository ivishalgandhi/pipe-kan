import { useState, type KeyboardEvent } from "react";

import { commandCatalog, commandPick, type CommandJump } from "~/command.ts";
import { cn } from "~/lib/utils";

export function CommandOverlay({
  presets,
  onPick,
}: {
  presets: string[];
  onPick: (jump: CommandJump) => void;
}) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const groups = commandCatalog({ presets, query });
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
    <div className="fixed inset-0 z-50 flex justify-center bg-black/20 pt-[18vh]">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command"
        className="bg-popover text-popover-foreground w-full max-w-lg overflow-hidden rounded-xl border shadow-sm"
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          aria-label="Command"
          className="h-10 w-full border-b bg-transparent px-3 text-[13px] outline-none"
        />
        <div className="max-h-80 overflow-auto p-1">
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
                      key={row.label}
                      type="button"
                      className={cn(
                        "flex w-full rounded-sm px-2 py-1.5 text-left text-[13px]",
                        index === highlight
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-foreground/5",
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => onPick(commandPick(row))}
                    >
                      {row.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
