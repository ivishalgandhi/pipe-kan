import type { Card, Epic } from "./board.ts";
import { cardMatches, epicMatches } from "./visible.ts";

export type CommandJump =
  | { kind: "all-stories" }
  | { kind: "all-epics" }
  | { kind: "all-combined" }
  | { kind: "refresh" }
  | { kind: "agent" }
  | { kind: "preset"; name: string }
  | { kind: "epic"; key: string }
  | { kind: "card"; key: string; epic?: string };

export type CommandRow = {
  label: string;
  jump: CommandJump;
  key?: string;
  starred?: boolean;
};

export type CommandGroup = {
  id: "actions" | "epics" | "cards";
  title: string;
  rows: CommandRow[];
};

export type CommandCatalogInput = {
  presets: string[];
  query: string;
  epics?: Epic[];
  cards?: Card[];
  favouriteKeys?: string[];
};

export function commandCatalog(input: CommandCatalogInput): CommandGroup[] {
  const needle = input.query.trim().toLowerCase();
  const actions: CommandRow[] = [
    { label: "All stories", jump: { kind: "all-stories" } },
    { label: "All epics", jump: { kind: "all-epics" } },
    { label: "All combined", jump: { kind: "all-combined" } },
    { label: "Refresh", jump: { kind: "refresh" } },
    { label: "Agent", jump: { kind: "agent" } },
    ...input.presets.map((name) => ({
      label: `Apply ${name}`,
      jump: { kind: "preset" as const, name },
    })),
  ];
  const actionRows = actions.filter((row) => !needle || row.label.toLowerCase().includes(needle));
  const groups: CommandGroup[] = [];
  if (actionRows.length) groups.push({ id: "actions", title: "Actions", rows: actionRows });
  if (!needle) return groups;

  const favourites = new Set(input.favouriteKeys ?? []);
  const epics = (input.epics ?? [])
    .filter((epic) => epicMatches(epic, input.query))
    .map((epic) => ({
      label: epic.summary,
      key: epic.key,
      ...(favourites.has(epic.key) ? { starred: true as const } : {}),
      jump: { kind: "epic" as const, key: epic.key },
    }));
  if (epics.length) groups.push({ id: "epics", title: "Epics", rows: epics });

  const cards = (input.cards ?? [])
    .filter((card) => cardMatches(card, input.query))
    .map((card) => ({
      label: card.summary,
      key: card.key,
      jump: {
        kind: "card" as const,
        key: card.key,
        ...(card.epic ? { epic: card.epic } : {}),
      },
    }));
  if (cards.length) groups.push({ id: "cards", title: "Cards", rows: cards });
  return groups;
}

export function commandPick(row: CommandRow): CommandJump {
  return row.jump;
}
