import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import type { AgentBackendConfig, AgentConfig, AgentModel } from "./types.ts";

export const DEFAULT_CONFIG_PATH = join(homedir(), ".config", "pipe-kan", "agent.json");

export const FALLBACK_MODELS: Record<string, AgentModel[]> = {
  cursor: [
    { id: "composer-2", name: "Composer 2" },
    { id: "composer-2-fast", name: "Composer 2 Fast" },
    { id: "claude-sonnet-4", name: "Claude Sonnet 4" },
    { id: "gpt-4.1", name: "GPT-4.1" },
  ],
  devin: [
    { id: "swe-1-6-slow", name: "SWE-1.6 (slow)", description: "Free slower tier" },
    { id: "swe-1-6-fast", name: "SWE-1.6 Fast" },
    { id: "swe-1-7", name: "SWE-1.7" },
    { id: "swe", name: "SWE (latest)" },
    { id: "adaptive", name: "Adaptive" },
    { id: "sonnet", name: "Sonnet" },
    { id: "opus", name: "Opus" },
    { id: "gpt", name: "GPT" },
  ],
};

export const DEFAULT_CONFIG: AgentConfig = {
  defaultAgent: "devin",
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
      model: "swe-1-6-slow",
    },
  },
};

export function agentConfigPath(): string {
  return process.env.PIPE_KAN_AGENT_CONFIG ?? DEFAULT_CONFIG_PATH;
}

export function commandOnPath(
  command: string,
  env: NodeJS.ProcessEnv | { PATH?: string } = process.env,
): boolean {
  if (!command) return false;
  if (command.includes("/") || command.includes("\\")) return existsSync(command);
  const pathVar = env.PATH ?? "";
  for (const dir of pathVar.split(delimiter)) {
    if (!dir) continue;
    if (existsSync(join(dir, command))) return true;
  }
  return false;
}

export function loadAgentConfig(path = agentConfigPath()): AgentConfig {
  if (!existsSync(path)) return structuredClone(DEFAULT_CONFIG);
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as Partial<AgentConfig>;
    return mergeConfig(raw);
  } catch {
    return structuredClone(DEFAULT_CONFIG);
  }
}

export function saveAgentConfig(
  patch: {
    defaultAgent?: string;
    defaultSkill?: string | null;
    agents?: Record<string, Partial<AgentBackendConfig>>;
  },
  path = agentConfigPath(),
): AgentConfig {
  const current = loadAgentConfig(path);
  const next: AgentConfig = {
    defaultAgent: patch.defaultAgent ?? current.defaultAgent,
    defaultSkill: patch.defaultSkill !== undefined ? patch.defaultSkill : current.defaultSkill,
    agents: { ...current.agents },
  };
  if (patch.agents) {
    for (const [id, config] of Object.entries(patch.agents)) {
      next.agents[id] = { ...next.agents[id], ...config };
    }
  }
  ensureAgentConfigDir(path);
  writeFileSync(path, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function mergeConfig(raw: Partial<AgentConfig>): AgentConfig {
  const agents: AgentConfig["agents"] = { ...DEFAULT_CONFIG.agents };
  for (const [id, config] of Object.entries({ ...DEFAULT_CONFIG.agents, ...raw.agents })) {
    agents[id] = { ...DEFAULT_CONFIG.agents[id], ...config };
  }
  return {
    defaultAgent: raw.defaultAgent ?? DEFAULT_CONFIG.defaultAgent,
    defaultSkill: raw.defaultSkill ?? DEFAULT_CONFIG.defaultSkill,
    agents,
  };
}

export function ensureAgentConfigDir(path = agentConfigPath()): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}
