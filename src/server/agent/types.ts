export type AgentConfig = {
  defaultAgent: string;
  defaultSkill?: string | null;
  agents: Record<string, AgentBackendConfig>;
};

export type AgentModel = {
  id: string;
  name: string;
  description?: string;
};

export type AgentBackendConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  model?: string;
  options?: Record<string, unknown>;
};

export type AgentContextBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export type AgentEvent =
  | { type: "agent_message_chunk"; text: string }
  | { type: "tool_call"; requestId: string; name: string; args: unknown }
  | { type: "tool_result"; requestId: string; name: string; result: unknown }
  | { type: "request_permission"; requestId: string; kind: string; description: string }
  | { type: "config"; models: AgentModel[]; selectedModel: string | null }
  | { type: "stop_reason"; reason: string }
  | { type: "error"; message: string }
  | { type: "connected" }
  | { type: "disconnected" };

export type ToolCall = {
  requestId: string;
  name: string;
  args: Record<string, unknown>;
};

export type AgentSession = {
  id: string;
  prompt(text: string, context?: AgentContextBlock[]): Promise<void>;
  setToolParser(parser: (text: string) => ToolCall | undefined): void;
  setToolExecutor(
    shouldAutoApprove: (name: string) => boolean,
    execute: (call: ToolCall) => Promise<{ text: string; result?: unknown }>,
  ): void;
  pendingToolCalls(): Map<string, ToolCall>;
  resolveToolCall(requestId: string, resultText: string, rawResult?: unknown): void;
  approve(requestId: string, decision: "once" | "always" | "reject"): void;
  models(): AgentModel[];
  selectedModel(): string | null;
  setModel(id: string): Promise<void>;
  subscribe(listener: (event: AgentEvent) => void): () => void;
  cancel(): void;
  events(): AsyncIterable<AgentEvent>;
  close(): Promise<void>;
};

export type AgentBackend = {
  id: string;
  label: string;
  spawn(config?: AgentBackendConfig): Promise<AgentSession>;
};
