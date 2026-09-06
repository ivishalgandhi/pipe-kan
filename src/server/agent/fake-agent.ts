import { randomUUID } from "node:crypto";

import type { InitializeRequest, PromptRequest, RequestPermissionRequest } from "@agentclientprotocol/sdk";

/**
 * A tiny ACP agent server for tests. Reads NDJSON from stdin and writes to stdout.
 * Supports initialize, session/new, and session/prompt. Echoes the prompt back as
 * agent message chunks, then stops. Optionally emits a permission request when
 * the prompt contains "permission:".
 */
export async function runFakeAgent(): Promise<void> {
  const { stdin, stdout } = process;
  let buffer = "";
  let sessionId: string | null = null;

  stdin.on("data", (chunk: Buffer) => {
    buffer += chunk.toString("utf8");
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      if (msg.method === "initialize") {
        const req = msg.params as InitializeRequest;
        stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: req.protocolVersion,
              agentInfo: { name: "fake-agent", version: "0.1.0" },
              agentCapabilities: {},
            },
          }) + "\n",
        );
      } else if (msg.method === "session/new") {
        sessionId = msg.params?.sessionId ?? randomUUID();
        stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { sessionId },
          }) + "\n",
        );
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
          stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              id: "perm-1",
              method: "session/request_permission",
              params: permissionReq,
            }) + "\n",
          );
        }
        for (const word of text.split(" ")) {
          stdout.write(
            JSON.stringify({
              jsonrpc: "2.0",
              method: "session/update",
              params: {
                sessionId,
                update: {
                  sessionUpdate: "agent_message_chunk",
                  content: { type: "text", text: word + " " },
                },
              },
            }) + "\n",
          );
        }
        stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { stopReason: "end_turn" },
          }) + "\n",
        );
      }
    }
  });

  await new Promise<void>((resolve) => stdin.on("end", resolve));
}

function extractText(prompt: PromptRequest["prompt"]): string {
  if (typeof prompt === "string") return prompt;
  if (Array.isArray(prompt)) {
    return prompt
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");
  }
  return "";
}

if (import.meta.main) {
  runFakeAgent().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
