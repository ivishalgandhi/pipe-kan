export type RowMenuAction =
  | { type: "status"; value: string }
  | { type: "assignee"; value: string }
  | { type: "priority"; value: string }
  | { type: "label"; value: string }
  | { type: "copy" };

export type RowMenuSection = {
  id: string;
  label: string;
  actions: RowMenuAction[];
};

const PRIORITIES = ["Urgent", "High", "Medium", "Low", "None"];

export function rowMenuModel(input: {
  statuses: string[];
  assignees: string[];
  labels: string[];
}): RowMenuSection[] {
  return [
    { id: "status", label: "Status", actions: input.statuses.map((value) => ({ type: "status", value })) },
    { id: "assignee", label: "Assignee", actions: input.assignees.map((value) => ({ type: "assignee", value })) },
    { id: "priority", label: "Priority", actions: PRIORITIES.map((value) => ({ type: "priority", value })) },
    { id: "labels", label: "Labels", actions: input.labels.map((value) => ({ type: "label", value })) },
    { id: "copy", label: "Copy link", actions: [{ type: "copy" }] },
  ];
}
