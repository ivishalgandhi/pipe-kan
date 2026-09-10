import type { KeyboardEvent } from "react";
import { SparklesIcon, XIcon } from "lucide-react";

import {
  acceptSuggestion,
  composerSuggestions,
  dismissSuggestion,
  removeLabel,
  type IssueComposerDraft,
} from "~/issue-composer.ts";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";

export function IssueComposer({
  draft,
  catalog,
  busy,
  error,
  onChange,
  onSubmit,
  onClose,
  onDraftWithAi,
}: {
  draft: IssueComposerDraft;
  catalog: string[];
  busy?: boolean;
  error?: string;
  onChange: (draft: IssueComposerDraft) => void;
  onSubmit: () => void;
  onClose: () => void;
  onDraftWithAi?: () => void;
}) {
  const suggestions = composerSuggestions(draft, catalog);
  const canSubmit = Boolean(draft.title.trim()) && !busy;

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && canSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[18vh]"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={draft.mode === "edit" ? "Edit issue" : "Create issue"}
        className="bg-popover text-popover-foreground w-full max-w-lg overflow-hidden rounded-xl border shadow-md"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
            {draft.mode === "edit" ? `Edit ${draft.key}` : "Create issue"}
          </span>
          {draft.mode === "create" && onDraftWithAi ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[12px]"
              onClick={onDraftWithAi}
            >
              <SparklesIcon className="size-3.5" />
              Draft with AI
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 p-3">
          <Input
            autoFocus
            value={draft.title}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            placeholder="Issue title"
            aria-label="Title"
            className="h-9 text-[13px]"
          />
          <textarea
            value={draft.description}
            onChange={(event) => onChange({ ...draft, description: event.target.value })}
            placeholder="Description"
            aria-label="Description"
            className="border-input placeholder:text-muted-foreground min-h-24 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-[13px] outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
          />
          {draft.labels.length ? (
            <div className="flex flex-wrap gap-1.5">
              {draft.labels.map((label) => (
                <span
                  key={label}
                  className="text-muted-foreground inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]"
                >
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label}`}
                    className="hover:text-foreground"
                    onClick={() => onChange(removeLabel(draft, label))}
                  >
                    <XIcon className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          {suggestions.length ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-[11px] font-medium">Suggested</span>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((label) => (
                  <span
                    key={label}
                    className="inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]"
                  >
                    {label}
                    <button
                      type="button"
                      className="text-primary text-[11px] font-medium"
                      onClick={() => onChange(acceptSuggestion(draft, label))}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="text-muted-foreground text-[11px]"
                      onClick={() => onChange(dismissSuggestion(draft, label))}
                    >
                      Dismiss
                    </button>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {draft.status ? (
            <p className="text-muted-foreground text-[12px]">Creates in {draft.status}</p>
          ) : null}
          {draft.epic ? (
            <p className="text-muted-foreground text-[12px]">Epic {draft.epic}</p>
          ) : null}
          {error ? (
            <p className="text-destructive text-[13px] whitespace-pre-wrap">{error}</p>
          ) : null}
        </div>
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            className={cn(!canSubmit && "opacity-50")}
            onClick={onSubmit}
          >
            {draft.mode === "edit" ? "Save" : "Create issue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
