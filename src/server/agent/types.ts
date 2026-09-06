export type AgentConfig = {
  defaultAgent: string;
  agents: Record<string, AgentBackendConfig>;
};

export type AgentBackendConfig = {
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

export type AgentContextBlock =
  | { type: "text"; text: string }
  | { type: "resource"; resource: { uri: string; mimeType: string; text: string } };

export type AgentEvent =
  | { type: "agent_message_chunk"; text: string }
  | { type: "tool_call"; requestId: string; name: string; args: unknown }
  | { type: "request_permission"; requestId: string; kind: string; description: string }
  | { type: "stop_reason"; reason: string }
  | { type: "error"; message: string }
  | { type: "connected" }
  | { type: "disconnected" };

export type AgentSession = {
  id: string;
  prompt(text: string, context?: AgentContextBlock[]): Promise<void>;
  setToolParser(
    parser: (text: string) => { requestId: string; name: string; args: Record<string, unknown> } | undefined,
  ): void;
  approve(requestId: string, decision: "once" | "always" | "reject"): void;
  cancel(): void;
  events(): AsyncIterable<AgentEvent>;
  close(): Promise<void>;
};

export type AgentBackend = {
  id: string;
  label: string;
  spawn(config?: AgentBackendConfig): Promise<AgentSession>;
};
