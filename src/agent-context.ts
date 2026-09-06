import type { AgentContextBlock } from "./server/agent/types.ts";
import type { BoardFilter, BoardSort } from "./visible.ts";

export type BoardViewCard = {
  key: string;
  summary: string;
  epic?: string;
  assignee?: string;
  priority?: string;
  labels?: string[];
  dueDate?: string;
};

export type BoardViewSnapshot = {
  scope?: "pipe" | "view";
  kind: "stories" | "epics";
  selectedEpic: string | null;
  search: string;
  filter: BoardFilter;
  sort: BoardSort;
  hide: string[];
  columns: { title: string; cards: BoardViewCard[] }[];
  epics: { key: string; summary: string; status?: string }[];
};

export type PipedBoard = {
  columns: { title: string; cards: BoardViewCard[] }[];
  epics: { key: string; summary: string; status?: string }[];
};

export function boardViewContext(view: BoardViewSnapshot): AgentContextBlock[] {
  return [
    { type: "text", text: formatBoardView({ ...view, scope: view.scope ?? "view" }) },
    {
      type: "resource",
      resource: {
        uri: "pipe-kan://board",
        mimeType: "application/json",
        text: JSON.stringify(view),
      },
    },
  ];
}

export function pipedBoardContext(board: PipedBoard): AgentContextBlock[] {
  return boardViewContext({
    scope: "pipe",
    kind: "stories",
    selectedEpic: null,
    search: "",
    filter: {},
    sort: "payload",
    hide: [],
    columns: board.columns,
    epics: board.epics,
  });
}

export function hasAttachedBoard(context: AgentContextBlock[] = []): boolean {
  return context.some((block) => block.type === "resource" && block.resource.uri === "pipe-kan://board");
}

export function withPipedBoardContext(
  board: PipedBoard,
  clientContext: AgentContextBlock[] = [],
): AgentContextBlock[] {
  if (hasAttachedBoard(clientContext)) return clientContext;
  return [...pipedBoardContext(board), ...clientContext];
}

function formatBoardView(view: BoardViewSnapshot): string {
  const opener = view.kind === "epics" ? "All epics" : "All stories";
  const scope = view.selectedEpic ? `${opener}, children of ${view.selectedEpic}` : opener;
  const lines = [
    view.scope === "pipe"
      ? "The user is working with piped Jira issues (the full payload). Answer from these Jira issues. This is not GitHub and not the local source repo."
      : "The user attached the current Jira Kanban board (visible cards only). Answer from these Jira issues. This is not GitHub and not the local source repo.",
    `Board: ${scope}`,
  ];
  if (view.search.trim()) lines.push(`Search: ${view.search.trim()}`);
  if (Object.values(view.filter).some((values) => values.length)) {
    lines.push(`Filter: ${JSON.stringify(view.filter)}`);
  }
  lines.push(`Sort: ${view.sort}`);
  if (view.hide.length) lines.push(`Hidden columns: ${view.hide.join(", ")}`);
  lines.push("", "Columns:");
  if (!view.columns.length) {
    lines.push("(empty)");
  } else {
    for (const column of view.columns) {
      lines.push(`## ${column.title}`);
      if (!column.cards.length) {
        lines.push("(no cards)");
        continue;
      }
      for (const card of column.cards) {
        lines.push(`- ${formatCard(card)}`);
      }
    }
  }
  if (view.epics.length) {
    lines.push("", "Epics:");
    for (const epic of view.epics) {
      const status = epic.status ? ` (${epic.status})` : "";
      lines.push(`- ${epic.key} ${epic.summary}${status}`);
    }
  }
  return lines.join("\n");
}

function formatCard(card: BoardViewCard): string {
  const bits = [card.key, card.summary];
  if (card.epic) bits.push(`[epic ${card.epic}]`);
  const extras = [card.priority, card.assignee, card.dueDate, card.labels?.join(", ")]
    .filter((value): value is string => Boolean(value));
  if (extras.length) bits.push(`(${extras.join(", ")})`);
  return bits.join(" ");
}
