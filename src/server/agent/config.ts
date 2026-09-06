import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { AgentConfig } from "./types.ts";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "pipe-kan", "agent.json");

export const DEFAULT_CONFIG: AgentConfig = {
  defaultAgent: "cursor",
  defaultSkill: null,
  agents: {
    cursor: {
      command: "cursor-agent",
      args: ["acp"],
      model: "claude-sonnet-4",
    },
    devin: {
      command: "devin",
      args: ["acp"],
      model: "devin",
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
    defaultSkill: raw.defaultSkill ?? DEFAULT_CONFIG.defaultSkill,
    agents: { ...DEFAULT_CONFIG.agents, ...raw.agents },
  };
}

export function ensureAgentConfigDir(path = DEFAULT_CONFIG_PATH): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
