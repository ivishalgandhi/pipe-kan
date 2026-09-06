import type { SessionConfigOption } from "@agentclientprotocol/sdk";

import type { AgentModel } from "./types.ts";

export function modelsFromConfigOptions(
  options: SessionConfigOption[] | null | undefined,
): AgentModel[] {
  if (!options?.length) return [];
  const model = options.find((option) => option.category === "model" || option.id === "model");
  if (!model || model.type !== "select") return [];
  return flattenSelectOptions(model.options);
}

export function selectedModelFromConfigOptions(
  options: SessionConfigOption[] | null | undefined,
): string | null {
  const model = options?.find((option) => option.category === "model" || option.id === "model");
  if (!model || model.type !== "select") return null;
  return model.currentValue ?? null;
}

const MODEL_ALIASES: Record<string, string[]> = {
  "swe-1-6": ["swe-1-6-slow"],
  "swe-1.6": ["swe-1-6-slow"],
  "swe-1.6-slow": ["swe-1-6-slow"],
  "swe-1-6-slow": ["swe-1-6"],
};

export function resolveRequestedModel(
  requested: string | null | undefined,
  live: AgentModel[],
): string | null {
  if (!requested) return null;
  if (!live.length) return requested;
  if (live.some((model) => model.id === requested)) return requested;
  for (const alias of MODEL_ALIASES[requested] ?? []) {
    const hit = live.find((model) => model.id === alias);
    if (hit) return hit.id;
  }
  const lower = requested.toLowerCase();
  return live.find((model) => model.name.toLowerCase() === lower)?.id ?? null;
}

export function errorText(err: unknown): string {
  if (err instanceof Error) {
    const extra = (err as { data?: unknown }).data;
    return extra ? `${err.message} ${JSON.stringify(extra)}` : err.message;
  }
  return String(err);
}

export function parseAvailableModelsFromError(err: unknown): string[] {
  const text = errorText(err);
  const match = text.match(/Available models:\s*([^\n"}]+)/i);
  if (!match) return [];
  return match[1]
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function flattenSelectOptions(options: unknown): AgentModel[] {
  if (!Array.isArray(options)) return [];
  const models: AgentModel[] = [];
  for (const item of options) {
    if (!item || typeof item !== "object") continue;
    if ("group" in item && Array.isArray((item as { options?: unknown }).options)) {
      models.push(...flattenSelectOptions((item as { options: unknown[] }).options));
      continue;
    }
    if ("value" in item && "name" in item) {
      const option = item as { value: string; name: string; description?: string | null };
      models.push({
        id: option.value,
        name: option.name,
        ...(option.description ? { description: option.description } : {}),
      });
    }
  }
  return models;
}
