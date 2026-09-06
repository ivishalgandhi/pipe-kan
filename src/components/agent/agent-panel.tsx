import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpIcon,
  BotIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  Loader2Icon,
  SparklesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";

import { boardViewContext, pipedBoardContext, type BoardViewSnapshot } from "~/agent-context.ts";
import { copyText, copyWithTextarea } from "~/copy-text.ts";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Bubble, BubbleContent } from "~/components/ui/bubble";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Marker, MarkerContent, MarkerIcon } from "~/components/ui/marker";
import { Message, MessageContent, MessageFooter } from "~/components/ui/message";
import { ResizablePanel } from "~/components/ui/resizable";
import { cn } from "~/lib/utils";
import type { BoardFilter } from "~/visible.ts";
import { AgentPermissionCard } from "./agent-permission-card.tsx";
import { AgentToolCard } from "./agent-tool-card.tsx";

export type AgentMessage =
  | { role: "user"; text: string }
  | { role: "agent"; text: string }
  | {
      role: "tool";
      requestId: string;
      name: string;
      args: Record<string, unknown>;
      approved?: boolean;
      status?: "pending" | "in_progress" | "completed" | "failed";
    }
  | { role: "permission"; requestId: string; kind: string; description: string };

type AgentModel = { id: string; name: string; description?: string };

type AgentInfo = {
  id: string;
  command: string;
  model?: string | null;
  available?: boolean;
  models?: AgentModel[];
};

type AgentConfig = {
  defaultAgent: string;
  defaultSkill?: string | null;
  agents: AgentInfo[];
};

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let body: T & { error?: string } = {} as T & { error?: string };
  if (text) {
    try {
      body = JSON.parse(text) as T & { error?: string };
    } catch {
      throw new Error(text.slice(0, 180) || `HTTP ${res.status}`);
    }
  }
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

type SkillSummary = {
  id: string;
  name: string;
  description: string;
};

type Attachment =
  | { kind: "skill"; id: string; label: string }
  | { kind: "issue"; key: string }
  | { kind: "board"; view: BoardViewSnapshot };

type AgentPanelProps = {
  open: boolean;
  onClose: () => void;
  selectedIssueKey?: string;
  boardView?: BoardViewSnapshot;
  pipeView?: BoardViewSnapshot;
  onApplyPreset?: (name: string) => void;
  onSetFilter?: (filter: BoardFilter) => void;
};

function toolStatus(message: Extract<AgentMessage, { role: "tool" }>) {
  return message.status ?? (message.approved === true ? "in_progress" : message.approved === false ? "failed" : "pending");
}

export function AgentPanel({
  open,
  onClose,
  selectedIssueKey,
  boardView,
  pipeView,
  onApplyPreset,
  onSetFilter,
}: AgentPanelProps) {
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [liveModels, setLiveModels] = useState<AgentModel[]>([]);
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const startGen = useRef(0);
  const startAbort = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  sessionIdRef.current = sessionId;

  const startSession = useCallback(async (agentId: string, model: string | null) => {
    startAbort.current?.abort();
    const ac = new AbortController();
    startAbort.current = ac;
    const gen = ++startGen.current;
    setStarting(true);
    try {
      const body = await readJson<{
        sessionId: string;
        models?: AgentModel[];
        selectedModel?: string | null;
      }>(
        await fetch("/api/agent/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ agentId, model }),
          signal: ac.signal,
        }),
      );
      if (gen !== startGen.current) return null;
      setSessionId(body.sessionId);
      if (body.models?.length) setLiveModels(body.models);
      if (body.selectedModel) setSelectedModel(body.selectedModel);
      return body.sessionId;
    } catch (err) {
      if (gen !== startGen.current || ac.signal.aborted) return null;
      setSessionId(null);
      setMessages((m) => [...m, { role: "agent", text: `Failed to start session: ${String(err)}` }]);
      return null;
    } finally {
      if (gen === startGen.current) setStarting(false);
    }
  }, []);

  useEffect(() => {
    fetch("/api/agent/config")
      .then((r) => readJson<AgentConfig>(r))
      .then((cfg) => {
        setConfig(cfg);
        const available = cfg.agents.filter((a) => a.available !== false);
        const preferred =
          available.find((a) => a.id === cfg.defaultAgent) ?? available[0] ?? cfg.agents[0];
        setSelectedAgent(preferred?.id ?? cfg.defaultAgent);
        setSelectedModel(preferred?.model ?? null);
        setLiveModels(preferred?.models ?? []);
        if (cfg.defaultSkill) setSelectedSkill(cfg.defaultSkill);
      })
      .catch(() => setConfig({ defaultAgent: "devin", agents: [] }));
    fetch("/api/agent/skills")
      .then((r) => readJson<SkillSummary[]>(r))
      .then(setSkills)
      .catch(() => setSkills([]));
  }, []);

  const configRef = useRef(config);
  configRef.current = config;
  const selectedModelRef = useRef(selectedModel);
  selectedModelRef.current = selectedModel;

  useEffect(() => {
    if (!open || !selectedAgent) return;
    setSessionId(null);
    const saved = configRef.current?.agents.find((a) => a.id === selectedAgent)?.model ?? null;
    void startSession(selectedAgent, selectedModelRef.current ?? saved);
    return () => {
      startGen.current += 1;
      startAbort.current?.abort();
      setStarting(false);
    };
  }, [open, selectedAgent, startSession]);

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
      models?: AgentModel[];
      selectedModel?: string | null;
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
        setMessages((prev) => [
          ...prev,
          { role: "tool", requestId: event.requestId ?? "", name, args: event.args ?? {}, status: "pending" },
        ]);
      },
      tool_result: (event) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "tool" && m.requestId === (event.requestId ?? "") ? { ...m, status: "completed" } : m,
          ),
        );
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
      config: (event) => {
        if (event.models?.length) setLiveModels(event.models);
        if (event.selectedModel) setSelectedModel(event.selectedModel);
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

  const send = async (preset?: string) => {
    const text = (preset ?? input).trim();
    if (!text || busy || starting) return;
    if (preset === undefined) setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    setBusy(true);

    const board = attachments.find((a): a is Extract<Attachment, { kind: "board" }> => a.kind === "board");
    const context = [
      ...attachments.flatMap((a) =>
        a.kind === "issue" ? [{ type: "text" as const, text: `Selected issue: ${a.key}` }] : [],
      ),
      ...(board
        ? boardViewContext(board.view)
        : pipeView
          ? pipedBoardContext({ columns: pipeView.columns, epics: pipeView.epics })
          : []),
    ];

    try {
      let id = sessionIdRef.current;
      if (!id) {
        if (!selectedAgent) throw new Error("No agent selected");
        id = await startSession(selectedAgent, selectedModel);
        if (!id) {
          setBusy(false);
          return;
        }
      }
      await readJson(
        await fetch("/api/agent/prompt", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: id,
            prompt: text,
            skillId: selectedSkill,
            context: context.length ? context : undefined,
          }),
        }),
      );
    } catch (err) {
      setBusy(false);
      setMessages((prev) => [...prev, { role: "agent", text: `Failed to send: ${String(err)}` }]);
    }
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

  const chooseModel = async (modelId: string) => {
    setSelectedModel(modelId);
    if (!sessionId) return;
    try {
      const body = await readJson<{ models?: AgentModel[]; selectedModel?: string | null }>(
        await fetch("/api/agent/model", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId, model: modelId }),
        }),
      );
      if (body.models?.length) setLiveModels(body.models);
      if (body.selectedModel) setSelectedModel(body.selectedModel);
    } catch (err) {
      setMessages((m) => [...m, { role: "agent", text: `Failed to set model: ${String(err)}` }]);
    }
  };

  const saveDefault = async () => {
    if (!selectedAgent) return;
    try {
      const cfg = await readJson<AgentConfig>(
        await fetch("/api/agent/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            defaultAgent: selectedAgent,
            agents: { [selectedAgent]: { model: selectedModel } },
          }),
        }),
      );
      setConfig(cfg);
    } catch (err) {
      setMessages((m) => [...m, { role: "agent", text: `Failed to save default: ${String(err)}` }]);
    }
  };

  const approveTool = (requestId: string, decision: "once" | "always" | "reject") => {
    postApproval(requestId, decision);
    setMessages((prev) =>
      prev.map((m) =>
        m.role === "tool" && m.requestId === requestId
          ? { ...m, approved: decision !== "reject", status: decision === "reject" ? "failed" : "in_progress" }
          : m,
      ),
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
    if (!boardView) return;
    setAttachments((prev) => {
      const next = prev.filter((a) => a.kind !== "board");
      return [...next, { kind: "board", view: boardView }];
    });
  };

  const removeAttachment = (kind: Attachment["kind"]) => {
    setAttachments((prev) => prev.filter((a) => a.kind !== kind));
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [input]);

  const currentAgent = useMemo(
    () => config?.agents.find((a) => a.id === selectedAgent),
    [config, selectedAgent],
  );
  const modelChoices = liveModels.length ? liveModels : (currentAgent?.models ?? []);
  const selectedModelName = useMemo(
    () => modelChoices.find((m) => m.id === selectedModel)?.name ?? selectedModel ?? "Model",
    [modelChoices, selectedModel],
  );
  const selectedSkillName = useMemo(
    () => skills.find((s) => s.id === selectedSkill)?.name ?? selectedSkill,
    [skills, selectedSkill],
  );
  const isDefault =
    config?.defaultAgent === selectedAgent && (currentAgent?.model ?? null) === selectedModel;
  const starters = useMemo(
    () =>
      selectedIssueKey
        ? [`Tell me about ${selectedIssueKey}`, "What's blocked?", "What should I work on next?"]
        : ["Summarize this board", "What's blocked?", "What should I work on next?"],
    [selectedIssueKey],
  );
  const last = messages[messages.length - 1];
  const awaitingApproval =
    last?.role === "permission" || (last?.role === "tool" && toolStatus(last) === "pending");
  const streaming = last?.role === "agent" && last.text.length > 0;
  const showThinking = starting || (busy && !awaitingApproval && !streaming);

  if (!open) return null;

  return (
    <ResizablePanel id="agent" defaultSize="320px" minSize="16rem" maxSize="50%" className="min-h-0">
      <div className="bg-background flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b px-3 py-2">
          <div className="flex items-center gap-2">
            <Avatar className="bg-primary/10 text-primary size-6">
              <AvatarFallback>
                <BotIcon className="size-3.5" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-none">Agent</p>
            </div>
            {starting ? (
              <Badge variant="outline">Starting</Badge>
            ) : busy ? (
              <Badge variant="primary-light">Live</Badge>
            ) : sessionId ? (
              <Badge variant="outline">Ready</Badge>
            ) : null}
            <Button type="button" variant="ghost" size="icon-xs" aria-label="Close" title="Close" onClick={onClose}>
              <XIcon />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs capitalize">
                  {selectedAgent ?? "Agent"}
                  <ChevronDownIcon className="size-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {config?.agents.map((a) => (
                  <DropdownMenuItem
                    key={a.id}
                    disabled={a.available === false}
                    onClick={() => {
                      setSelectedAgent(a.id);
                      setSelectedModel(a.model ?? null);
                      setLiveModels(a.models ?? []);
                    }}
                  >
                    <span className="capitalize">{a.id}</span>
                    {a.available === false ? " (not found)" : ""}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled={!selectedAgent || isDefault} onClick={() => void saveDefault()}>
                  {isDefault ? "Default" : "Set as default"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {selectedAgent && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-muted-foreground h-6 rounded-full px-2 text-xs">
                    {selectedModelName}
                    <ChevronDownIcon className="size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {modelChoices.map((model) => (
                    <DropdownMenuItem key={model.id} onClick={() => void chooseModel(model.id)}>
                      {model.name}
                      {model.description ? ` — ${model.description}` : ""}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-6 rounded-full px-2 text-xs">
                  {selectedSkillName ?? "Skill"}
                  <ChevronDownIcon className="size-3" />
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
          </div>
        </header>

        <div className={cn("min-h-0 flex-1 overflow-y-auto px-3 py-3", messages.length > 0 && "scroll-fade")}>
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-2 text-center">
              <span className="bg-muted flex size-10 items-center justify-center rounded-full">
                <SparklesIcon className="size-5" />
              </span>
              <div className="space-y-1">
                <p className="text-sm font-medium">Ask the agent</p>
                {starting ? (
                  <p className="shimmer text-muted-foreground text-xs">Starting session…</p>
                ) : (
                  <p className="text-muted-foreground text-xs">About this board, or attach a skill or issue.</p>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {starters.map((starter) => (
                  <Button
                    key={starter}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-full text-xs"
                    disabled={busy || starting}
                    onClick={() => void send(starter)}
                  >
                    {starter}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
            {messages.map((m, i) => {
              const renderers: Record<AgentMessage["role"], (message: AgentMessage, index: number) => ReactNode> = {
                user: (message) => {
                  if (message.role !== "user") return null;
                  return (
                    <Message align="end">
                      <MessageContent>
                        <Bubble variant="default">
                          <BubbleContent>{message.text}</BubbleContent>
                        </Bubble>
                      </MessageContent>
                    </Message>
                  );
                },
                agent: (message, index) => {
                  if (message.role !== "agent") return null;
                  return (
                    <Message align="start">
                      <MessageContent>
                        <Bubble variant="muted">
                          <BubbleContent>{message.text}</BubbleContent>
                        </Bubble>
                        <MessageFooter>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground"
                            aria-label="Copy"
                            title="Copy"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              const markCopied = () => {
                                setCopied(index);
                                window.setTimeout(() => {
                                  setCopied((current) => (current === index ? null : current));
                                }, 1500);
                              };
                              try {
                                copyWithTextarea(message.text);
                                markCopied();
                              } catch {
                                void copyText(message.text).then(markCopied).catch(() => undefined);
                              }
                            }}
                          >
                            {copied === index ? <CheckIcon /> : <CopyIcon />}
                          </Button>
                        </MessageFooter>
                      </MessageContent>
                    </Message>
                  );
                },
                tool: (message) => {
                  if (message.role !== "tool") return null;
                  const status = toolStatus(message);
                  return (
                    <AgentToolCard
                      name={message.name}
                      args={message.args}
                      status={status}
                      onApprove={status === "pending" ? () => approveTool(message.requestId, "once") : undefined}
                      onAllowAlways={status === "pending" ? () => approveTool(message.requestId, "always") : undefined}
                      onReject={status === "pending" ? () => approveTool(message.requestId, "reject") : undefined}
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
            })}
            </div>
          )}
          {messages.length > 0 && showThinking ? (
            <Marker role="status" className="mt-2">
              <MarkerIcon>
                <Loader2Icon className="animate-spin" />
              </MarkerIcon>
              <MarkerContent className="shimmer">{starting ? "Starting session…" : "Thinking…"}</MarkerContent>
            </Marker>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 p-2">
          <form
            className="bg-background rounded-2xl border p-2 shadow-xs"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {(selectedSkill || attachments.length > 0) && (
              <div className="mb-1.5 flex flex-wrap gap-1">
                {selectedSkill && (
                  <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs">
                    {selectedSkillName}
                    <button type="button" className="text-muted-foreground" onClick={() => setSelectedSkill(null)}>
                      ×
                    </button>
                  </span>
                )}
                {attachments.map((a, idx) => (
                  <span
                    key={`${a.kind}-${idx}`}
                    className="bg-muted inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
                  >
                    {a.kind === "issue" ? `Issue ${a.key}` : a.kind === "board" ? "Board view" : a.label}
                    <button type="button" className="text-muted-foreground" onClick={() => removeAttachment(a.kind)}>
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask the agent…"
              disabled={busy || starting}
              className="placeholder:text-muted-foreground max-h-32 min-h-8 w-full resize-none bg-transparent px-1 py-1 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
            />
            <div className="mt-1 flex items-end justify-between gap-1">
              <div className="flex min-w-0 flex-wrap gap-1">
                {selectedIssueKey && !attachments.some((a) => a.kind === "issue") && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={attachIssue}>
                    Attach issue
                  </Button>
                )}
                {boardView && !attachments.some((a) => a.kind === "board") && (
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={attachBoard}>
                    Attach board view
                  </Button>
                )}
              </div>
              {busy ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="size-8 shrink-0 rounded-full"
                  aria-label="Stop"
                  title="Stop"
                  onClick={stop}
                >
                  <SquareIcon />
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="icon"
                  className="size-8 shrink-0 rounded-full"
                  aria-label="Send"
                  title="Send"
                  disabled={busy || starting || !input.trim()}
                >
                  <ArrowUpIcon />
                </Button>
              )}
            </div>
          </form>
        </div>
      </div>
    </ResizablePanel>
  );
}
