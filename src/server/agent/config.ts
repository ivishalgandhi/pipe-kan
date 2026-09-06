import { existsSync, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AgentConfig } from "./types.ts";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "pipe-kan", "agent.json");

export const DEFAULT_CONFIG: AgentConfig = {
  defaultAgent: "cursor",
  agents: {
    cursor: {
      command: "cursor-agent",
      args: ["acp"],
    },
    devin: {
      command: "devin",
      args: ["acp"],
    },
  },
};

export function loadAgentConfig(path = DEFAULT_CONFIG_PATH): AgentConfig {
  if (!existsSync(path)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AgentConfig>;
    return mergeConfig(raw);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

function mergeConfig(raw: Partial<AgentConfig>): AgentConfig {
  return {
    defaultAgent: raw.defaultAgent ?? DEFAULT_CONFIG.defaultAgent,
    agents: { ...DEFAULT_CONFIG.agents, ...raw.agents },
  };
}

export function ensureAgentConfigDir(path = DEFAULT_CONFIG_PATH): void {
  const dir = path.split("/").slice(0, -1).join("/");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
