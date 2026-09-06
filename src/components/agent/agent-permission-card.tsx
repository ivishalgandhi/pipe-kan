import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";

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
    <Card className="my-2 border-amber-500/50">
      <CardHeader className="py-2 text-sm font-medium">
        Permission requested: {kind}
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <p className="text-muted-foreground mb-2 text-sm">{description}</p>
        <div className="flex gap-2">
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
      </CardContent>
    </Card>
  );
}
