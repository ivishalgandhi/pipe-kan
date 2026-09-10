import { commandComposerAction } from "./command.ts";
import { suggestLabels } from "./label-suggest.ts";

export { commandComposerAction };

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

export type CreateComposerContext = {
  status?: string;
  selectedEpic?: string | null;
  boardKind?: "stories" | "epics" | "combined";
};

export type CreateIssuePayload = {
  summary: string;
  description: string;
  labels: string[];
  status?: string;
  parent?: string;
  type?: string;
};

export type EditIssuePayload = {
  key: string;
  summary: string;
  description: string;
  labels: string[];
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

function createDraftOpts(ctx: CreateComposerContext) {
  return {
    ...(ctx.status ? { status: ctx.status } : {}),
    ...(ctx.selectedEpic && ctx.boardKind !== "epics" ? { epic: ctx.selectedEpic } : {}),
    ...(ctx.boardKind === "epics" ? { type: "Epic" } : {}),
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

export function openCreateDraft(ctx: CreateComposerContext = {}): IssueComposerDraft {
  return emptyCreateDraft(createDraftOpts(ctx));
}

export function openCreateFromColumn(
  status: string,
  ctx: Omit<CreateComposerContext, "status"> = {},
): IssueComposerDraft {
  return openCreateDraft({ ...ctx, status });
}

export function openCreateFromCommand(ctx: CreateComposerContext = {}): IssueComposerDraft {
  return openCreateDraft(ctx);
}

export function openCreateAiFromCommand(ctx: CreateComposerContext = {}): {
  draft: IssueComposerDraft;
  seed: string;
} {
  const draft = openCreateDraft(ctx);
  return { draft, seed: createAiSeed(draft) };
}

export function openEditFromCard(input: {
  key: string;
  summary?: string;
  description?: string;
  labels?: string[];
  status?: string;
  epic?: string;
  type?: string;
  fields?: ComposerField[];
}): IssueComposerDraft {
  const extras = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.epic ? { epic: input.epic } : {}),
    ...(input.type ? { type: input.type } : {}),
  };
  if (input.fields?.length) return draftFromOpen(input.key, input.fields, extras);
  return {
    mode: "edit",
    key: input.key,
    title: input.summary ?? "",
    description: input.description ?? "",
    labels: input.labels ?? [],
    dismissed: [],
    ...extras,
  };
}

export function canSubmitComposer(draft: IssueComposerDraft | null, busy = false): boolean {
  return Boolean(draft?.title.trim()) && !busy;
}

export function buildCreatePayload(draft: IssueComposerDraft | null): CreateIssuePayload | null {
  if (!draft || draft.mode !== "create" || !canSubmitComposer(draft)) return null;
  return {
    summary: draft.title.trim(),
    description: draft.description,
    labels: draft.labels,
    ...(draft.status ? { status: draft.status } : {}),
    ...(draft.epic ? { parent: draft.epic } : {}),
    ...(draft.type ? { type: draft.type } : {}),
  };
}

export function buildEditPayload(draft: IssueComposerDraft | null): EditIssuePayload | null {
  if (!draft || draft.mode !== "edit" || !draft.key || !canSubmitComposer(draft)) return null;
  return {
    key: draft.key,
    summary: draft.title.trim(),
    description: draft.description,
    labels: draft.labels,
  };
}

export function composerHotkey(
  event: { key: string; metaKey?: boolean; ctrlKey?: boolean },
  draft: IssueComposerDraft | null,
  busy = false,
): "close" | "submit" | null {
  if (event.key === "Escape") return "close";
  if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmitComposer(draft, busy)) {
    return "submit";
  }
  return null;
}

export function discardComposer(): null {
  return null;
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
