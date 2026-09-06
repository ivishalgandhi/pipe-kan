import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { ResizablePanel, ResizablePanelGroup } from "~/components/ui/resizable";
import type { BoardFilter, BoardSort } from "~/visible.ts";

import { AgentPermissionCard } from "./agent-permission-card.tsx";
import { AgentToolCard } from "./agent-tool-card.tsx";

export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "agent"; text: string }
  | { role: "tool"; requestId: string; name: string; args: Record<string, unknown>; approved?: boolean }
  | { role: "permission"; requestId: string; kind: string; description: string };

type AgentConfig = {
  defaultAgent: string;
  defaultSkill?: string | null;
  agents: { id: string; command: string; model?: string; options?: Record<string, unknown> }[];
};

type SkillSummary = {
  id: string;
  name: string;
  description: string;
};

type Attachment =
  | { kind: "skill"; id: string; label: string }
  | { kind: "issue"; key: string }
  | { kind: "board"; filter: BoardFilter; sort: BoardSort; hide: string[] };

type AgentPanelProps = {
  open: boolean;
  onClose: () => void;
  selectedIssueKey?: string;
  boardFilter?: BoardFilter;
  boardSort?: BoardSort;
  boardHide?: string[];
  onApplyPreset?: (name: string) => void;
  onSetFilter?: (filter: BoardFilter) => void;
};

export function AgentPanel({
  open,
  onClose,
  selectedIssueKey,
  boardFilter,
  boardSort,
  boardHide,
  onApplyPreset,
  onSetFilter,
}: AgentPanelProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/agent/config")
      .then((r) => r.json())
      .then((cfg: AgentConfig) => {
        setConfig(cfg);
        setSelectedAgent(cfg.defaultAgent);
        const agent = cfg.agents.find((a) => a.id === cfg.defaultAgent);
        setSelectedModel(agent?.model ?? null);
        if (cfg.defaultSkill) setSelectedSkill(cfg.defaultSkill);
      })
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

    type SseEvent = {
      type: string;
      text?: string;
      requestId?: string;
      name?: string;
      args?: Record<string, unknown>;
      result?: unknown;
      kind?: string;
      description?: string;
      reason?: string;
      message?: string;
    };

    const handlers: Record<string, (event: SseEvent) => void> = {
      agent_message_chunk: (event) => {
        const text = event.text ?? "";
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "agent") {
            return [...prev.slice(0, -1), { ...last, text: last.text + text }];
          }
          return [...prev, { role: "agent", text }];
        });
      },
      tool_call: (event) => {
        const name = event.name ?? "unknown";
        setBusy(false);
        setMessages((prev) => [
          ...prev,
          { role: "tool", requestId: event.requestId ?? "", name, args: event.args ?? {} },
        ]);
      },
      tool_result: (event) => {
        const result = event.result as
          | { __ui_action?: string; preset?: string; filter?: BoardFilter }
          | undefined;
        if (result?.__ui_action === "apply_preset" && result.preset) {
          onApplyPreset?.(result.preset);
        } else if (result?.__ui_action === "set_filter" && result.filter) {
          onSetFilter?.(result.filter);
        }
      },
      request_permission: (event) => {
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
      },
      stop_reason: () => setBusy(false),
      error: (event) => {
        setBusy(false);
        setMessages((prev) => [...prev, { role: "agent", text: `Error: ${event.message ?? "unknown"}` }]);
      },
      disconnected: () => {
        setBusy(false);
        es.close();
      },
    };

    es.addEventListener("message", (e) => {
      const event = JSON.parse(e.data) as SseEvent;
      handlers[event.type]?.(event);
    });
    return () => es.close();
  }, [sessionId, onApplyPreset, onSetFilter]);

  const postApproval = (requestId: string, decision: "once" | "always" | "reject") => {
    if (!sessionId) return;
    fetch("/api/agent/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, requestId, decision }),
    }).catch(() => void 0);
  };

  const send = () => {
    if (!sessionId || !input.trim() || busy) return;
    const text = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);

    const context: { type: "text"; text: string }[] = [];
    for (const a of attachments) {
      if (a.kind === "issue") context.push({ type: "text", text: `Selected issue: ${a.key}` });
      else if (a.kind === "board") {
        context.push({
          type: "text",
          text: `Current board view: filter=${JSON.stringify(a.filter)}, sort=${a.sort}, hide=${JSON.stringify(a.hide)}`,
        });
      }
    }

    fetch("/api/agent/prompt", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, prompt: text, skillId: selectedSkill, context: context.length ? context : undefined }),
    }).catch((err) => {
      setBusy(false);
      setMessages((prev) => [...prev, { role: "agent", text: `Failed to send: ${String(err)}` }]);
    });
  };

  const stop = () => {
    if (!sessionId) return;
    fetch("/api/agent/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => void 0);
    setBusy(false);
  };

  const approveTool = (requestId: string, decision: "once" | "always" | "reject") => {
    postApproval(requestId, decision);
    setMessages((prev) =>
      prev.map((m) => (m.role === "tool" && m.requestId === requestId ? { ...m, approved: decision !== "reject" } : m)),
    );
  };

  const approvePermission = (requestId: string, decision: "once" | "always" | "reject") => {
    postApproval(requestId, decision);
  };

  const attachIssue = () => {
    if (!selectedIssueKey) return;
    setAttachments((prev) => {
      const next = prev.filter((a) => a.kind !== "issue");
      return [...next, { kind: "issue", key: selectedIssueKey }];
    });
  };

  const attachBoard = () => {
    if (boardFilter == null || boardSort == null || boardHide == null) return;
    setAttachments((prev) => {
      const next = prev.filter((a) => a.kind !== "board");
      return [...next, { kind: "board", filter: boardFilter, sort: boardSort, hide: boardHide }];
    });
  };

  const removeAttachment = (kind: Attachment["kind"]) => {
    setAttachments((prev) => prev.filter((a) => a.kind !== kind));
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const selectedAgentName = useMemo(
    () => config?.agents.find((a) => a.id === selectedAgent)?.id ?? selectedAgent,
    [config, selectedAgent],
  );
  const selectedModelName = useMemo(() => selectedModel ?? "Default", [selectedModel]);
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">{selectedAgentName ?? "Agent"}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {config?.agents.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    onClick={() => {
                      setSelectedAgent(a.id);
                      setSelectedModel(a.model ?? null);
                    }}
                  >
                    {a.id}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedAgent && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground">{selectedModelName}</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => setSelectedModel(null)}>Default</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedModel("claude-sonnet-4")}>Claude Sonnet 4</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setSelectedModel("gpt-4.1")}>GPT-4.1</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">{selectedSkillName ?? "Skill"}</Button>
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
                  const renderers: Record<
                    AgentMessage["role"],
                    (message: AgentMessage, index: number) => ReactNode
                  > = {
                    user: (message) => {
                      if (message.role !== "user") return null;
                      return (
                        <div className="mb-2 flex justify-end">
                          <div className="bg-primary text-primary-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm">
                            {message.text}
                          </div>
                        </div>
                      );
                    },
                    agent: (message) => {
                      if (message.role !== "agent") return null;
                      return (
                        <div className="mb-2 flex justify-start">
                          <div className="bg-muted max-w-[90%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap">
                            {message.text}
                          </div>
                        </div>
                      );
                    },
                    tool: (message) => {
                      if (message.role !== "tool") return null;
                      return (
                        <AgentToolCard
                          name={message.name}
                          args={message.args}
                          status={
                            message.approved === true
                              ? "in_progress"
                              : message.approved === false
                                ? "failed"
                                : "pending"
                          }
                          onApprove={() => approveTool(message.requestId, "once")}
                          onAllowAlways={() => approveTool(message.requestId, "always")}
                          onReject={() => approveTool(message.requestId, "reject")}
                        />
                      );
                    },
                    permission: (message) => {
                      if (message.role !== "permission") return null;
                      return (
                        <AgentPermissionCard
                          kind={message.kind}
                          description={message.description}
                          onAllowOnce={() => approvePermission(message.requestId, "once")}
                          onAllowAlways={() => approvePermission(message.requestId, "always")}
                          onReject={() => approvePermission(message.requestId, "reject")}
                        />
                      );
                    },
                  };
                  return <Fragment key={i}>{renderers[m.role](m, i)}</Fragment>;
                })
              )}
              {busy && (
                <div className="text-muted-foreground text-xs">Agent is thinking…</div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t p-2">
              <div className="mb-1 flex flex-wrap gap-1">
                {selectedSkill && (
                  <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                    {selectedSkillName}
                    <button type="button" className="text-muted-foreground" onClick={() => setSelectedSkill(null)}>×</button>
                  </span>
                )}
                {attachments.map((a, idx) => (
                  <span
                    key={`${a.kind}-${idx}`}
                    className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  >
                    {a.kind === "issue" ? `Issue ${a.key}` : a.kind === "board" ? "Board view" : a.label}
                    <button type="button" className="text-muted-foreground" onClick={() => removeAttachment(a.kind)}>×</button>
                  </span>
                ))}
              </div>
              <div className="mb-1 flex flex-wrap gap-1">
                {selectedIssueKey && !attachments.some((a) => a.kind === "issue") && (
                  <Button type="button" variant="ghost" size="sm" onClick={attachIssue}>Attach issue</Button>
                )}
                {boardFilter != null && boardSort != null && boardHide != null && !attachments.some((a) => a.kind === "board") && (
                  <Button type="button" variant="ghost" size="sm" onClick={attachBoard}>Attach board view</Button>
                )}
              </div>
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
                {busy ? (
                  <Button type="button" variant="secondary" onClick={stop}>Stop</Button>
                ) : (
                  <Button type="submit" disabled={busy || !input.trim()}>Send</Button>
                )}
              </form>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </ResizablePanel>
  );
}
