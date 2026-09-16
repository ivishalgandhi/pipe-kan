export type RefreshChoice = "all" | "selected";

export type RefreshRequestBody = {
  scope: "all" | "selected";
  flags: string;
  epicKeys?: string[];
};

export function refreshRequestBody(
  choice: RefreshChoice,
  focusedEpic: string | null,
  flags: string,
): RefreshRequestBody | null {
  if (choice === "selected") {
    if (!focusedEpic) return null;
    return { scope: "selected", epicKeys: [focusedEpic], flags };
  }
  return { scope: "all", flags };
}

export const REFRESH_NO_FOCUS_WARNING =
  "No Epic is focused. All Epics will be refreshed.";
