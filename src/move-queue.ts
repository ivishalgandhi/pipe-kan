import { toast as sonnerToast } from "sonner";

export type MoveRequest = {
  key: string;
  target: string;
  source: string;
  kind: "card" | "epic";
};

export type MoveResult = {
  ok: boolean;
  error?: string;
};

export type ToastAPI = {
  loading: (message: string, options?: { description?: string }) => string | number;
  success: (message: string, options?: { id?: string | number; description?: string }) => void;
  error: (message: string, options?: { id?: string | number; description?: string }) => void;
};

export type MoveQueueDeps = {
  run: (req: MoveRequest) => Promise<MoveResult>;
  onRollback: (req: MoveRequest) => void;
  toast?: ToastAPI;
};

export type MoveQueue = {
  move: (req: MoveRequest | MoveRequest[]) => void;
};

export function createMoveQueue(deps: MoveQueueDeps): MoveQueue {
  const queue: MoveRequest[] = [];
  let running = false;
  const toast = deps.toast ?? sonnerToast;

  function move(req: MoveRequest | MoveRequest[]) {
    const items = Array.isArray(req) ? req : [req];
    for (const item of items) queue.push(item);
    if (!running) void process();
  }

  async function process() {
    running = true;
    try {
      while (queue.length > 0) {
        const req = queue.shift()!;
        const id = toast.loading(`Moving ${req.key} → ${req.target}…`);
        try {
          const result = await deps.run(req);
          if (result.ok) {
            toast.success(`Moved ${req.key} to ${req.target}`, { id });
          } else {
            const description = result.error ?? "Move failed";
            toast.error(`Move ${req.key} failed`, { id, description });
            deps.onRollback(req);
          }
        } catch (err) {
          const description = err instanceof Error ? err.message : "Move failed";
          toast.error(`Move ${req.key} failed`, { id, description });
          deps.onRollback(req);
        }
      }
    } finally {
      running = false;
    }
  }

  return { move };
}
