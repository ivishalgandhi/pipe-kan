import { ChevronDownIcon, WrenchIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker";
import { cn } from "~/lib/utils";

type AgentToolCardProps = {
  name: string;
  args: Record<string, unknown>;
  status?: "pending" | "in_progress" | "completed" | "failed";
  onApprove?: () => void;
  onAllowAlways?: () => void;
  onReject?: () => void;
};

export function AgentToolCard({
  name,
  args,
  status = "pending",
  onApprove,
  onAllowAlways,
  onReject,
}: AgentToolCardProps) {
  const argEntries = Object.keys(args);
  const pending = status === "pending" && (onApprove || onAllowAlways || onReject);

  return (
    <Collapsible defaultOpen={status === "pending"} className="w-full">
      <div
        className={cn(
          "rounded-lg border px-2 py-1.5",
          status === "pending" && "border-warning/50",
          status === "failed" && "border-destructive/40",
        )}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="hover:bg-muted/50 flex w-full items-center gap-2 rounded-md text-left">
            <Marker className="min-h-0 py-0.5">
              <MarkerIcon>
                <WrenchIcon />
              </MarkerIcon>
              <MarkerContent className="flex min-w-0 flex-1 items-center gap-2 text-foreground">
                <span className="truncate font-medium">{name}</span>
                <span className="text-muted-foreground ml-auto shrink-0 text-[11px] uppercase">
                  {status.replace("_", " ")}
                </span>
                <ChevronDownIcon className="text-muted-foreground size-3.5 shrink-0" />
              </MarkerContent>
            </Marker>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {argEntries.length > 0 ? (
            <pre className="text-muted-foreground mt-1 max-h-24 overflow-auto px-1 text-[11px] leading-snug">
              {JSON.stringify(args, null, 2)}
            </pre>
          ) : null}
          {pending ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {onApprove && (
                <Button size="sm" variant="default" onClick={onApprove}>
                  Allow once
                </Button>
              )}
              {onAllowAlways && (
                <Button size="sm" variant="secondary" onClick={onAllowAlways}>
                  Allow always
                </Button>
              )}
              {onReject && (
                <Button size="sm" variant="outline" onClick={onReject}>
                  Reject
                </Button>
              )}
            </div>
          ) : null}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
