import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";

import { AgentPermissionCard } from "./agent-permission-card.tsx";
import { AgentToolCard } from "./agent-tool-card.tsx";

export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "agent"; text: string }
  | { role: "tool"; requestId: string; name: string; args: Record<string, unknown>; approved?: boolean }
  | { role: "permission"; requestId: string; kind: string; description: string };

type AgentConfig = {
  defaultAgent: string;
  agents: { id: string; command: string }[];
};

type SkillSummary = {
  id: string;
  name: string;
  description: string;
};

type AgentPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function AgentPanel({ open, onClose }: AgentPanelProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/agent/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig({ defaultAgent: "cursor", agents: [] }));
    fetch("/api/agent/skills")
      .then((r) => r.json())
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  useEffect(() => {
    if (!open || sessionId) return;
    let cancelled = false;
    fetch("/api/agent/session", { method: "POST" })
      .then((r) => r.json())
      .then((body: { sessionId?: string }) => {
        if (cancelled) return;
        if (body.sessionId) setSessionId(body.sessionId);
      })
      .catch((err) => {
        if (cancelled) return;
        setMessages((m) => [...m, { role: "agent", text: `Failed to start session: ${String(err)}` }]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/agent/events?sessionId=${encodeURIComponent(sessionId)}`);
    es.addEventListener("message", (e) => {
      const event = JSON.parse(e.data) as {
        type: string;
        text?: string;
        requestId?: string;
        name?: string;
        args?: Record<string, unknown>;
        kind?: string;
        description?: string;
        reason?: string;
        message?: string;
      };
      if (event.type === "agent_message_chunk") {
        const text = event.text ?? "";
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "agent") {
            return [...prev.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...prev, { role: "agent", text }];
        });
      } else if (event.type === "tool_call") {
        const name = event.name ?? "unknown";
        setBusy(false);
        setMessages((prev) => [
          ...prev,
          { role: "tool", requestId: event.requestId ?? "", name, args: event.args ?? {} },
        ]);
      } else if (event.type === "request_permission") {
        const kind = event.kind ?? "unknown";
        setMessages((prev) => [
          ...prev,
          {
            role: "permission",
            requestId: event.requestId ?? "",
            kind,
            description: event.description ?? "",
          },
        ]);
      } else if (event.type === "stop_reason") {
        setBusy(false);
      } else if (event.type === "error") {
        setBusy(false);
        setMessages((prev) => [...prev, { role: "agent", text: `Error: ${event.message ?? "unknown"}` }]);
      } else if (event.type === "disconnected") {
        setBusy(false);
        es.close();
      }
    });
    return () => es.close();
  }, [sessionId]);

  const send = () => {
    if (!sessionId || !input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);
    fetch("/api/agent/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, prompt: text, skillId: selectedSkill }),
    }).catch((err) => {
      setBusy(false);
      setMessages((prev) => [...prev, { role: "agent", text: `Failed to send: ${String(err)}` }]);
    });
  };

  const approveTool = (requestId: string, decision: "once" | "always" | "reject") => {
    if (!sessionId) return;
    fetch("/api/agent/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, requestId, decision }),
    }).catch(() => void 0);
    setMessages((prev) =>
      prev.map((m) => (m.role === "tool" && m.requestId === requestId ? { ...m, approved: decision !== "reject" } : m)),
    );
  };

  const approvePermission = (requestId: string, decision: "once" | "always" | "reject") => {
    if (!sessionId) return;
    fetch("/api/agent/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, requestId, decision }),
    }).catch(() => void 0);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedSkillName = useMemo(
    () => skills.find((s) => s.id === selectedSkill)?.name ?? selectedSkill,
    [skills, selectedSkill],
  );

  if (!open) return null;

  return (
    <ResizablePanel id="agent" defaultSize="320px" minSize="16rem" maxSize="50%" className="min-h-0">
      <ResizablePanelGroup orientation="vertical" className="h-full">
        <header className="flex items-center justify-between gap-2 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Agent</span>
            {config && (
              <span className="text-muted-foreground text-xs">
                {config.defaultAgent}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  {selectedSkillName ?? "Skill"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSelectedSkill(null)}>None</DropdownMenuItem>
                {skills.map((s) => (
                  <DropdownMenuItem key={s.id} onClick={() => setSelectedSkill(s.id)}>
                    {s.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={onClose}>
              ×
            </Button>
          </div>
        </header>

        <ResizablePanel className="min-h-0 flex-1">
          <div className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-3">
              {messages.length === 0 ? (
                <p className="text-muted-foreground text-sm">Ask the agent about this board or attach a skill.</p>
              ) : (
                messages.map((m, i) => {
                  if (m.role === "user") {
                    return (
                      <div key={i} className="mb-2 flex justify-end">
                        <div className="bg-primary text-primary-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm">
                          {m.text}
                        </div>
                      </div>
                    );
                  }
                  if (m.role === "tool") {
                    return (
                      <AgentToolCard
                        key={i}
                        name={m.name}
                        args={m.args}
                        status={m.approved === true ? "in_progress" : m.approved === false ? "failed" : "pending"}
                        onApprove={() => approveTool(m.requestId, "once")}
                        onReject={() => approveTool(m.requestId, "reject")}
                      />
                    );
                  }
                  if (m.role === "permission") {
                    return (
                      <AgentPermissionCard
                        key={i}
                        kind={m.kind}
                        description={m.description}
                        onAllowOnce={() => approvePermission(m.requestId, "once")}
                        onAllowAlways={() => approvePermission(m.requestId, "always")}
                        onReject={() => approvePermission(m.requestId, "reject")}
                      />
                    );
                  }
                  return (
                    <div key={i} className="mb-2 flex justify-start">
                      <div className="bg-muted max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
              {busy && (
                <div className="text-muted-foreground text-xs">Agent is thinking…</div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-2">
              {selectedSkill && (
                <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                  <span className="bg-muted rounded-full px-2 py-0.5">{selectedSkillName}</span>
                  attached
                </div>
              )}
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask the agent…"
                  disabled={busy}
                  className="flex-1"
                />
                <Button type="submit" disabled={busy || !input.trim()}>
                  Send
                </Button>
              </form>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
  );
}
