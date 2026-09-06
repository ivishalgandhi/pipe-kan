import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import * as acp from "@agentclientprotocol/sdk";
import type {
  ContentBlock,
  RequestPermissionRequest,
  RequestPermissionResponse,
  SessionId,
  SessionUpdate,
} from "@agentclientprotocol/sdk";

import type {
  AgentBackend,
  AgentBackendConfig,
  AgentContextBlock,
  AgentEvent,
  AgentSession,
  ToolCall,
} from "./types.ts";

export function createAcpBackend(id: string, label: string): AgentBackend {
  return {
    id,
    label,
    spawn(config: AgentBackendConfig): Promise<AgentSession> {
      const session = new AcpSession(config);
      return session.connect().then(() => session);
    },
  };
}

class AcpSession implements AgentSession {
  id: SessionId;
  private proc: ReturnType<typeof spawn> | null = null;
  private activeSession: acp.ActiveSession | null = null;
  private eventsQueue: AgentEvent[] = [];
  private eventResolvers: Array<(resolver: IteratorResult<AgentEvent>) => void> = [];
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

  constructor(private config: AgentBackendConfig) {
    this.id = crypto.randomUUID();
  }

  async prompt(text: string, context?: AgentContextBlock[]): Promise<void> {
    if (!this.activeSession) throw new Error("ACP session not connected");
    const blocks: ContentBlock[] = (context ?? []).map(toContentBlock);
    blocks.push({ type: "text", text });
    await this.activeSession.prompt(blocks);
  }

  setToolParser(parser: (text: string) => ToolCall | undefined): void {
    this.detectToolCall = parser;
  }

  pendingToolCalls(): Map<string, ToolCall> {
    return this.toolCalls;
  }

  resolveToolCall(requestId: string, resultText: string): void {
    const call = this.toolCalls.get(requestId);
    if (!call) return;
    this.toolCalls.delete(requestId);
    void this.prompt(
      `Tool result for ${call.name}(${JSON.stringify(call.args)}):\n${resultText}`,
    );
  }

  approve(requestId: string, decision: "once" | "always" | "reject"): void {
    const entry = this.pendingPermissionResolvers.get(requestId);
    if (!entry) return;
    const optionId = permissionOptionForDecision(entry.request.options, decision);
    const outcome: acp.RequestPermissionOutcome =
      optionId == null
        ? { outcome: "cancelled" }
        : { outcome: "selected", optionId };
    entry.resolve(outcome);
    this.pendingPermissionResolvers.delete(requestId);
  }

  cancel(): void {
    this.proc?.kill("SIGTERM");
  }

  async *[Symbol.asyncIterator](): AsyncIterableIterator<AgentEvent> {
    while (!this.closed || this.eventsQueue.length) {
      if (this.eventsQueue.length) {
        yield this.eventsQueue.shift()!;
      } else {
        const { promise, resolve } = Promise.withResolvers<IteratorResult<AgentEvent>>();
        this.eventResolvers.push(resolve);
        const result = await promise;
        if (result.done) return;
        yield result.value;
      }
    }
  }

  events(): AsyncIterable<AgentEvent> {
    return this[Symbol.asyncIterator]();
  }

  async close(): Promise<void> {
    this.closed = true;
    this.activeSession?.dispose();
    this.lifetime?.resolve();
    this.proc?.kill("SIGTERM");
    this.flushQueue();
    this.proc = null;
  }

  async connect(): Promise<void> {
    const cwd = mkdtempSync(join(tmpdir(), "pipe-kan-acp-"));
    const cmd = this.config.command;
    const args = this.config.args ?? [];
    this.proc = spawn(cmd, args, {
      cwd,
      env: { ...process.env, ...(this.config.env ?? {}) },
      stdio: ["pipe", "pipe", "pipe"],
    });

    if (!this.proc.stdout || !this.proc.stdin) {
      throw new Error(`Failed to spawn ACP agent: ${cmd}`);
    }

    const stdout = Readable.toWeb(this.proc.stdout) as ReadableStream<Uint8Array>;
    const stream = acp.ndJsonStream(
      new WritableStream<Uint8Array>({
        write: (chunk) => this.writeStdin(chunk),
      }),
      stdout,
    );

    this.proc.on("error", (err) => this.push({ type: "error", message: err.message }));
    this.proc.on("exit", () => {
      this.push({ type: "disconnected" });
      this.closed = true;
      this.flushQueue();
    });

    const app = acp.client({ name: "pipe-kan" });
    app.onRequest(acp.methods.client.session.requestPermission, (ctx) => this.handlePermission(ctx.params));
    app.onRequest(acp.methods.client.fs.readTextFile, () => Promise.reject(new Error("read_file not implemented")));

    this.lifetime = Promise.withResolvers<void>();
    const connected = app.connectWith(stream, async (ctx) => {
      this.activeSession = await ctx.buildSession(cwd).start();
      this.ready.resolve();
      this.push({ type: "connected" });
      this.readLoop();
      await this.lifetime!.promise;
    });
    connected.catch(() => {
      // connection close is expected when the agent process exits
    });
    await this.ready.promise;
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
        this.push({ type: "tool_call", ...tool });
        return;
      }
      this.push({ type: "agent_message_chunk", text: update.content.text });
    } else if (update.sessionUpdate === "tool_call") {
      this.push({
        type: "tool_call",
        requestId: update.toolCallId ?? crypto.randomUUID(),
        name: update.name ?? "unknown",
        args: {},
      });
    }
  }

  private handlePermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const requestId = params.toolCall.toolCallId ?? crypto.randomUUID();
    const { promise, resolve } = Promise.withResolvers<acp.RequestPermissionOutcome>();
    this.pendingPermissionResolvers.set(requestId, { resolve, request: params });
    this.push({
      type: "request_permission",
      requestId,
      kind: params.toolCall.name ?? "unknown",
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
    const resolver = this.eventResolvers.shift();
    if (resolver) {
      resolver({ value: event, done: false });
    } else {
      this.eventsQueue.push(event);
    }
  }

  private flushQueue(): void {
    while (this.eventResolvers.length) {
      this.eventResolvers.shift()!({ value: undefined as unknown as AgentEvent, done: true });
    }
  }
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
