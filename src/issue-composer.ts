import { suggestLabels } from "./label-suggest.ts";

export type IssueComposerDraft = {
  mode: "create" | "edit";
  title: string;
  description: string;
  labels: string[];
  dismissed: string[];
  status?: string;
  epic?: string;
  key?: string;
  type?: string;
};

export type ComposerField = {
  label: string;
  value: string;
  pills?: string[];
};

export function composerSuggestions(draft: IssueComposerDraft, catalog: string[]): string[] {
  const suggested = suggestLabels({
    text: `${draft.title}\n${draft.description}`,
    labels: catalog,
    selected: draft.labels,
  });
  const dismissed = new Set(draft.dismissed.map((label) => label.toLowerCase()));
  return suggested.filter((label) => !dismissed.has(label.toLowerCase()));
}

export function acceptSuggestion(draft: IssueComposerDraft, label: string): IssueComposerDraft {
  if (draft.labels.some((item) => item.toLowerCase() === label.toLowerCase())) return draft;
  return { ...draft, labels: [...draft.labels, label] };
}

export function dismissSuggestion(draft: IssueComposerDraft, label: string): IssueComposerDraft {
  if (draft.dismissed.some((item) => item.toLowerCase() === label.toLowerCase())) return draft;
  return { ...draft, dismissed: [...draft.dismissed, label] };
}

export function removeLabel(draft: IssueComposerDraft, label: string): IssueComposerDraft {
  return {
    ...draft,
    labels: draft.labels.filter((item) => item.toLowerCase() !== label.toLowerCase()),
  };
}

export function emptyCreateDraft(opts: {
  status?: string;
  epic?: string;
  type?: string;
} = {}): IssueComposerDraft {
  return {
    mode: "create",
    title: "",
    description: "",
    labels: [],
    dismissed: [],
    ...opts,
  };
}

function named(fields: ComposerField[] | undefined, label: string): ComposerField | undefined {
  const needle = label.toLowerCase();
  return fields?.find((field) => field.label.toLowerCase() === needle);
}

function labelsOf(field: ComposerField | undefined): string[] {
  if (field?.pills?.length) return field.pills;
  if (!field?.value.trim()) return [];
  return field.value.split(/,\s*/).filter(Boolean);
}

export function draftFromOpen(
  key: string,
  fields: ComposerField[],
  extras: { status?: string; epic?: string; type?: string } = {},
): IssueComposerDraft {
  return {
    mode: "edit",
    key,
    title: named(fields, "Summary")?.value ?? "",
    description: named(fields, "Description")?.value ?? "",
    labels: labelsOf(named(fields, "Labels")),
    dismissed: [],
    ...extras,
  };
}

export function mergeOpenIntoDraft(
  draft: IssueComposerDraft,
  fields: ComposerField[],
): IssueComposerDraft {
  if (draft.mode !== "edit" || !draft.key) return draft;
  const next = draftFromOpen(draft.key, fields, {
    status: draft.status,
    epic: draft.epic,
    type: draft.type,
  });
  return {
    ...next,
    title: draft.title.trim() ? draft.title : next.title,
    description: draft.description.trim() ? draft.description : next.description,
    labels: draft.labels.length ? draft.labels : next.labels,
    dismissed: draft.dismissed,
  };
}

export function createAiSeed(draft?: IssueComposerDraft | null): string {
  const bits = [
    "Draft a new Jira issue for this board.",
    "Propose a concise summary, a short description, and labels from labels already on the board.",
    "Then call the create_issue tool with those fields so the issue is created after I approve.",
  ];
  if (draft?.title.trim()) bits.push(`Working title: ${draft.title.trim()}`);
  if (draft?.description.trim()) bits.push(`Working description: ${draft.description.trim()}`);
  if (draft?.status) bits.push(`Create it in status ${draft.status}.`);
  if (draft?.epic) bits.push(`Parent Epic: ${draft.epic}.`);
  if (draft?.labels.length) bits.push(`Preferred labels: ${draft.labels.join(", ")}.`);
  return bits.join(" ");
}
