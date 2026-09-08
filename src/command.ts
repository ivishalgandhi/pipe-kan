export type CommandJump =
  | { kind: "all-stories" }
  | { kind: "all-epics" }
  | { kind: "refresh" }
  | { kind: "agent" }
  | { kind: "preset"; name: string };

export type CommandRow = {
  label: string;
  jump: CommandJump;
};

export type CommandGroup = {
  id: "actions";
  title: string;
  rows: CommandRow[];
};

export type CommandCatalogInput = {
  presets: string[];
  query: string;
};

export function commandCatalog(input: CommandCatalogInput): CommandGroup[] {
  const needle = input.query.trim().toLowerCase();
  const actions: CommandRow[] = [
    { label: "All stories", jump: { kind: "all-stories" } },
    { label: "All epics", jump: { kind: "all-epics" } },
    { label: "Refresh", jump: { kind: "refresh" } },
    { label: "Agent", jump: { kind: "agent" } },
    ...input.presets.map((name) => ({
      label: `Apply ${name}`,
      jump: { kind: "preset" as const, name },
    })),
  ];
  const rows = actions.filter((row) => !needle || row.label.toLowerCase().includes(needle));
  return rows.length ? [{ id: "actions", title: "Actions", rows }] : [];
}

export function commandPick(row: CommandRow): CommandJump {
  return row.jump;
}
