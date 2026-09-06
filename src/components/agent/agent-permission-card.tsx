import { ShieldAlertIcon } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker";

type AgentPermissionCardProps = {
  kind: string;
  description: string;
  onAllowOnce: () => void;
  onAllowAlways: () => void;
  onReject: () => void;
};

export function AgentPermissionCard({
  kind,
  description,
  onAllowOnce,
  onAllowAlways,
  onReject,
}: AgentPermissionCardProps) {
  return (
    <div className="border-warning/50 w-full rounded-lg border px-2 py-2">
      <Marker className="min-h-0 items-start py-0">
        <MarkerIcon className="text-warning-foreground mt-0.5">
          <ShieldAlertIcon />
        </MarkerIcon>
        <MarkerContent className="text-foreground font-medium">Permission: {kind}</MarkerContent>
      </Marker>
      {description ? <p className="text-muted-foreground mt-1 pl-6 text-xs">{description}</p> : null}
      <div className="mt-2 flex flex-wrap gap-1.5 pl-6">
        <Button size="sm" variant="default" onClick={onAllowOnce}>
          Allow once
        </Button>
        <Button size="sm" variant="secondary" onClick={onAllowAlways}>
          Always allow
        </Button>
        <Button size="sm" variant="outline" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}
