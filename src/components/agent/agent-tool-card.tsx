import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { cn } from "~/lib/utils";

type AgentToolCardProps = {
  name: string;
  args: Record<string, unknown>;
  status?: "pending" | "in_progress" | "completed" | "failed";
  onApprove?: () => void;
  onReject?: () => void;
};

export function AgentToolCard({ name, args, status = "pending", onApprove, onReject }: AgentToolCardProps) {
  const statusDot = {
    pending: "bg-muted",
    in_progress: "bg-blue-500",
    completed: "bg-green-500",
    failed: "bg-red-500",
  }[status];

  return (
    <Card className={cn("my-2 border", status === "pending" && "border-amber-500/50")}>
      <CardHeader className="flex flex-row items-center justify-between py-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className={cn("size-2 rounded-full", statusDot)} />
          {name}
        </div>
        <span className="text-muted-foreground text-xs uppercase">{status}</span>
      </CardHeader>
      <CardContent className="pb-3 pt-0">
        <pre className="bg-muted rounded-md p-2 text-xs">{JSON.stringify(args, null, 2)}</pre>
        {status === "pending" && (onApprove || onReject) ? (
          <div className="mt-2 flex gap-2">
            {onApprove && (
              <Button size="sm" variant="default" onClick={onApprove}>
                Allow once
              </Button>
            )}
            {onReject && (
              <Button size="sm" variant="outline" onClick={onReject}>
                Reject
              </Button>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
