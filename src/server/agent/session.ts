import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type {
  ContentBlock,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionConfigOption,
  SessionId,
  SessionUpdate,
} from "@agentclientprotocol/sdk";

import { errorText, modelsFromConfigOptions, parseAvailableModelsFromError, resolveRequestedModel, selectedModelFromConfigOptions } from "./models.ts";
import type {
  AgentBackend,
  AgentBackendConfig,
  AgentContextBlock,
  AgentEvent,
  AgentModel,
  AgentSession,
  ToolCall,
} from "./types.ts";

const CONNECT_TIMEOUT_MS = 15_000;

export type ConnectableAgentSession = AgentSession & { connect(): Promise<void> };

export function createAcpSession(config: AgentBackendConfig): ConnectableAgentSession {
  return new AcpSession(config);
}

export function createAcpBackend(id: string, label: string): AgentBackend {
  return {
    id,
    label,
    spawn(config: AgentBackendConfig): Promise<AgentSession> {
      const session = createAcpSession(config);
      return session.connect().then(() => session);
    },
  };
}

class AcpSession implements AgentSession {
  id: SessionId;
  private proc: ReturnType<typeof spawn> | null = null;
  private activeSession: acp.ActiveSession | null = null;
  private agentCtx: acp.ClientContext | null = null;
  private configOptions: SessionConfigOption[] = [];
  private eventsQueue: AgentEvent[] = [];
  private listeners = new Set<(event: AgentEvent) => void>();
  private pendingPermissionResolvers = new Map<
    string,
    { resolve(outcome: acp.RequestPermissionOutcome): void; request: RequestPermissionRequest }
  >();
  private closed = false;
  private lifetime: { promise: Promise<void>; resolve(): void } | null = null;
  private ready = Promise.withResolvers<void>();
  private textBuffer = "";
  private detectToolCall: ((text: string) => ToolCall | undefined) | null = null;
  private toolCalls = new Map<string, ToolCall>();
  private shouldAutoApproveTool: ((name: string) => boolean) | null = null;
  private executeTool: ((call: ToolCall) => Promise<{ text: string; result?: unknown }>) | null = null;
  private stderr = "";
  private selectedModelId: string | null = null;
  private workspace = mkdtempSync(join(tmpdir(), "pipe-kan-agent-"));

  constructor(private config: AgentBackendConfig) {
    this.id = crypto.randomUUID();
    this.selectedModelId = config.model ?? null;
    void this.ready.promise.catch(() => undefined);
  }

  async prompt(text: string, context?: AgentContextBlock[]): Promise<void> {
    if (!this.activeSession) throw new Error("ACP session not connected");
    const resources = (context ?? []).filter((block) => block.type === "resource").map(toContentBlock);
    const contextText = (context ?? [])
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .filter(Boolean)
      .join("\n\n");
    const prompt = contextText ? `${contextText}\n\n${text}` : text;
    await this.activeSession.prompt([...resources, { type: "text", text: prompt }]);
  }

  setToolParser(parser: (text: string) => ToolCall | undefined): void {
    this.detectToolCall = parser;
  }

  setToolExecutor(
    shouldAutoApprove: (name: string) => boolean,
    execute: (call: ToolCall) => Promise<{ text: string; result?: unknown }>,
  ): void {
    this.shouldAutoApproveTool = shouldAutoApprove;
    this.executeTool = execute;
  }

  pendingToolCalls(): Map<string, ToolCall> {
    return this.toolCalls;
  }

  resolveToolCall(requestId: string, resultText: string, rawResult?: unknown): void {
    const call = this.toolCalls.get(requestId);
    if (!call) return;
    this.toolCalls.delete(requestId);
    this.push({ type: "tool_result", requestId, name: call.name, result: rawResult ?? resultText });
    void this.prompt(
      `Tool result for ${call.name}(${JSON.stringify(call.args)}):\n${resultText}`,
    ).catch(() => void 0);
  }

  approve(requestId: string, decision: "once" | "always" | "reject"): void {
    const entry = this.pendingPermissionResolvers.get(requestId);
    if (!entry) return;
    const optionId = permissionOptionForDecision(entry.request.options, decision);
    const outcome: acp.RequestPermissionOutcome =
      optionId == null ? { outcome: "cancelled" } : { outcome: "selected", optionId };
    entry.resolve(outcome);
    this.pendingPermissionResolvers.delete(requestId);
  }

  models(): AgentModel[] {
    const live = modelsFromConfigOptions(this.configOptions);
    return live.length ? live : [];
  }

  selectedModel(): string | null {
    return selectedModelFromConfigOptions(this.configOptions) ?? this.selectedModelId;
  }

  async setModel(id: string): Promise<void> {
    const live = this.models();
    let resolved = resolveRequestedModel(id, live);
    if (!resolved && live.length) return;
    resolved = resolved ?? id;
    this.selectedModelId = resolved;
    this.config.model = resolved;
    const option = this.configOptions.find((item) => item.category === "model" || item.id === "model");
    if (!option || option.type !== "select" || !this.agentCtx || !this.activeSession) return;
    try {
      const result = await this.agentCtx.request(acp.methods.agent.session.setConfigOption, {
        sessionId: this.activeSession.sessionId,
        configId: option.id,
        value: resolved,
      });
      if (result.configOptions) this.configOptions = result.configOptions;
      this.selectedModelId = this.selectedModel();
      this.push({ type: "config", models: this.models(), selectedModel: this.selectedModel() });
    } catch (err) {
      const available = parseAvailableModelsFromError(err).map((modelId) => ({ id: modelId, name: modelId }));
      const retry = resolveRequestedModel(id, available) ?? resolveRequestedModel(resolved, available);
      if (retry && retry !== resolved) {
        await this.setModel(retry);
        return;
      }
      this.selectedModelId = selectedModelFromConfigOptions(this.configOptions);
      throw new Error(errorText(err));
    }
  }

  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.add(listener);
    if (this.eventsQueue.length) {
      const queued = this.eventsQueue.splice(0);
      for (const event of queued) listener(event);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  cancel(): void {
    this.proc?.kill("SIGTERM");
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<AgentEvent> {
    const queue: AgentEvent[] = [];
    let wake: (() => void) | null = null;
    const unsub = this.subscribe((event) => {
      queue.push(event);
      wake?.();
    });
    try {
      while (!this.closed || queue.length) {
        if (!queue.length) {
          await new Promise<void>((resolve) => {
            wake = resolve;
          });
        }
        while (queue.length) yield queue.shift()!;
      }
    } finally {
      unsub();
    }
  }

  events(): AsyncIterable<AgentEvent> {
    return this[Symbol.asyncIterator]();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.ready.reject(new Error("ACP session closed"));
    this.activeSession?.dispose();
    this.lifetime?.resolve();
    this.proc?.kill("SIGTERM");
    this.flushQueue();
    this.proc = null;
    rmSync(this.workspace, { recursive: true, force: true });
  }

  async connect(): Promise<void> {
    if (this.closed) throw new Error("ACP session closed");
    const cwd = this.workspace;
    const cmd = this.config.command;
    const args = this.config.args ?? [];
    this.proc = spawn(cmd, args, {
      cwd: process.cwd(),
      env: { ...process.env, ...(this.config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (this.closed) {
      this.proc.kill("SIGTERM");
      this.proc = null;
      throw new Error("ACP session closed");
    }

    if (!this.proc.stdout || !this.proc.stdin) {
      throw new Error(`Failed to spawn ACP agent: ${cmd}`);
    }

    this.proc.stderr?.on("data", (chunk) => {
      this.stderr += chunk.toString("utf8");
    });

    const stdout = Readable.toWeb(this.proc.stdout) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(
      new WritableStream<Uint8Array>({
        write: (chunk) => this.writeStdin(chunk),
      }),
      stdout,
    );

    this.proc.on("error", (err) => {
      this.push({ type: "error", message: err.message });
      this.ready.reject(err);
    });
    this.proc.on("exit", (code) => {
      this.push({ type: "disconnected" });
      this.closed = true;
      this.flushQueue();
      if (code) {
        this.ready.reject(
          new Error(`ACP agent exited (${code})${this.stderr.trim() ? `: ${this.stderr.trim()}` : ""}`),
        );
      }
    });

    const app = acp.client({ name: "pipe-kan" });
    app.onRequest(acp.methods.client.session.requestPermission, (ctx) => this.handlePermission(ctx.params));
    app.onRequest(acp.methods.client.fs.readTextFile, () => Promise.reject(new Error("read_file not implemented")));

    this.lifetime = Promise.withResolvers<void>();
    const connected = app.connectWith(stream, async (ctx) => {
      this.agentCtx = ctx;
      this.activeSession = await ctx.buildSession(cwd).start();
      this.configOptions = this.activeSession.newSessionResponse.configOptions ?? [];
      try {
        if (this.config.model) await this.setModel(this.config.model);
      } catch (err) {
        this.push({ type: "error", message: `Could not set model ${this.config.model}: ${errorText(err)}` });
      }
      this.ready.resolve();
      this.push({ type: "connected" });
      this.push({ type: "config", models: this.models(), selectedModel: this.selectedModel() });
      this.readLoop();
      await this.lifetime!.promise;
    });
    connected.catch(() => {
      // connection close is expected when the agent process exits
    });

    const timeout = setTimeout(() => {
      this.ready.reject(
        new Error(
          `Timed out starting ${cmd}${this.stderr.trim() ? `:\n${lastLines(this.stderr)}` : ""}`,
        ),
      );
      void this.close();
    }, CONNECT_TIMEOUT_MS);
    try {
      await this.ready.promise;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readLoop(): Promise<void> {
    if (!this.activeSession) return;
    try {
      while (!this.closed) {
        const message = await this.activeSession.nextUpdate();
        if (message.kind === "session_update") {
          const update = message.notification.update;
          this.handleUpdate(update);
        } else if (message.kind === "stop") {
          this.push({ type: "stop_reason", reason: message.stopReason ?? "end_turn" });
        }
      }
    } catch (err) {
      this.push({ type: "error", message: String(err) });
    }
  }

  private handleUpdate(update: SessionUpdate): void {
    if (update.sessionUpdate === "agent_message_chunk" && update.content?.type === "text") {
      this.textBuffer += update.content.text;
      const tool = this.detectToolCall?.(this.textBuffer);
      if (tool) {
        this.toolCalls.set(tool.requestId, tool);
        if (this.shouldAutoApproveTool?.(tool.name)) {
          void this.executeTool?.(tool).then(({ text, result }) => this.resolveToolCall(tool.requestId, text, result));
        } else {
          this.push({ type: "tool_call", ...tool });
        }
        return;
      }
      this.push({ type: "agent_message_chunk", text: update.content.text });
    } else if (update.sessionUpdate === "tool_call") {
      this.push({
        type: "tool_call",
        requestId: update.toolCallId ?? crypto.randomUUID(),
        name: update.title ?? "unknown",
        args: {},
      });
    } else if (update.sessionUpdate === "config_option_update") {
      this.configOptions = update.configOptions ?? this.configOptions;
      this.push({ type: "config", models: this.models(), selectedModel: this.selectedModel() });
    }
  }

  private handlePermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const requestId = params.toolCall.toolCallId ?? crypto.randomUUID();
    const { promise, resolve } = Promise.withResolvers<acp.RequestPermissionOutcome>();
    this.pendingPermissionResolvers.set(requestId, { resolve, request: params });
    this.push({
      type: "request_permission",
      requestId,
      kind: params.toolCall.title ?? "unknown",
      description: params.toolCall.content ? JSON.stringify(params.toolCall.content) : "",
    });
    return promise.then((outcome) => ({ outcome }));
  }

  private async writeStdin(chunk: Uint8Array): Promise<void> {
    if (!this.proc?.stdin) return;
    const ok = this.proc.stdin.write(chunk);
    if (ok === false) {
      const { promise, resolve } = Promise.withResolvers<void>();
      this.proc.stdin.once("drain", resolve);
      await promise;
    }
  }

  private push(event: AgentEvent): void {
    if (this.listeners.size === 0) {
      this.eventsQueue.push(event);
      return;
    }
    for (const listener of this.listeners) listener(event);
  }

  private flushQueue(): void {
    this.eventsQueue.length = 0;
    for (const listener of this.listeners) listener({ type: "disconnected" });
  }
}

function lastLines(text: string, n = 12): string {
  return text.trim().split(/\n/).slice(-n).join("\n");
}

function toContentBlock(ctx: AgentContextBlock): ContentBlock {
  if (ctx.type === "resource") {
    return {
      type: "resource",
      resource: {
        uri: ctx.resource.uri,
        mimeType: ctx.resource.mimeType,
        text: ctx.resource.text,
      },
    };
  }
  return { type: "text", text: ctx.text };
}

function permissionOptionForDecision(
  options: RequestPermissionRequest["options"],
  decision: "once" | "always" | "reject",
): string | null {
  if (decision === "reject") return null;
  const kind = decision === "always" ? "allow_always" : "allow_once";
  return options.find((o) => o.kind === kind)?.optionId ?? options[0]?.optionId ?? null;
}
