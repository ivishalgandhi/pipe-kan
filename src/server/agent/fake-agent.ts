import { randomUUID } from "node:crypto";

import type { InitializeRequest, PromptRequest, RequestPermissionRequest } from "@agentclientprotocol/sdk";

/**
 * A tiny ACP agent server for tests. Reads NDJSON from stdin and writes to stdout.
 * Supports initialize, session/new, session/set_config_option, and session/prompt.
 * Echoes the prompt back as agent message chunks, then stops. Optionally emits a
 * permission request when the prompt contains "permission:".
 */
export async function runFakeAgent(): Promise<void> {
  const { stdin, stdout } = process;
  let buffer = "";
  let sessionId: string | null = null;
  let currentModel = "swe-1-6-slow";

  const write = (msg: unknown) => {
    stdout.write(JSON.stringify(msg) + "\n");
  };

  const modelOptions = () => [
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: currentModel,
      options: [
        { value: "swe-1-6-slow", name: "SWE-1.6 (slow)" },
        { value: "swe-1-6-fast", name: "SWE-1.6 Fast" },
        { value: "sonnet", name: "Sonnet" },
      ],
    },
  ];

  stdin.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.method === "initialize") {
        const req = msg.params as InitializeRequest;
        write({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            protocolVersion: req.protocolVersion,
            agentInfo: { name: "fake-agent", version: "0.1.0" },
            agentCapabilities: {},
          },
        });
      } else if (msg.method === "session/new") {
        sessionId = msg.params?.sessionId ?? randomUUID();
        write({
          jsonrpc: "2.0",
          id: msg.id,
          result: { sessionId, configOptions: modelOptions() },
        });
      } else if (msg.method === "session/set_config_option") {
        const value = msg.params?.value;
        const known = ["swe-1-6-slow", "swe-1-6-fast", "sonnet"];
        if (typeof value !== "string" || !known.includes(value)) {
          write({
            jsonrpc: "2.0",
            id: msg.id,
            error: {
              code: -32002,
              message: "Resource not found",
              data: { uri: `Model not found: ${String(value)}. Available models: ${known.join(", ")}` },
            },
          });
        } else {
          currentModel = value;
          write({
            jsonrpc: "2.0",
            id: msg.id,
            result: { configOptions: modelOptions() },
          });
        }
      } else if (msg.method === "session/prompt") {
        const req = msg.params as PromptRequest;
        const text = extractText(req.prompt);
        if (text.includes("permission:")) {
          const permissionReq: RequestPermissionRequest = {
            sessionId: sessionId ?? "",
            toolCall: { toolCallId: "tc-1", title: "Fake tool", name: "fake_tool" },
            options: [
              { optionId: "allow_once", name: "Allow once", kind: "allow_once" },
              { optionId: "allow_always", name: "Always allow", kind: "allow_always" },
              { optionId: "reject_once", name: "Reject", kind: "reject_once" },
            ],
          };
          write({
            jsonrpc: "2.0",
            id: "perm-1",
            method: "session/request_permission",
            params: permissionReq,
          });
        }
        for (const word of text.split(" ")) {
          write({
            jsonrpc: "2.0",
            method: "session/update",
            params: {
              sessionId,
              update: {
                sessionUpdate: "agent_message_chunk",
                content: { type: "text", text: word + " " },
              },
            },
          });
        }
        write({
          jsonrpc: "2.0",
          id: msg.id,
          result: { stopReason: "end_turn" },
        });
      }
    }
  });

  await new Promise<void>((resolve) => stdin.on("end", resolve));
}

function extractText(prompt: PromptRequest["prompt"]): string {
  if (typeof prompt === "string") return prompt;
  if (Array.isArray(prompt)) {
    return prompt
      .map((block) => {
        if (block.type === "text") return block.text;
        if (block.type === "resource" && "text" in block.resource) return block.resource.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

if (import.meta.main) {
  runFakeAgent().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
