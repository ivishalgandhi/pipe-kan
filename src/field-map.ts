import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import type { TargetEndFieldMap } from "./target-end.ts";

export function jiraCliConfigPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.JIRA_CONFIG_FILE?.trim();
  if (explicit) return explicit;
  const xdg = env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, ".jira", ".config.yml");
  return join(homedir(), ".config", ".jira", ".config.yml");
}

export function readTargetEndFieldMap(path: string): TargetEndFieldMap {
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as TargetEndFieldMap;
    const targetEnd =
      typeof raw.targetEnd === "string" && raw.targetEnd.startsWith("customfield_")
        ? raw.targetEnd
        : undefined;
    return targetEnd ? { targetEnd } : {};
  } catch {
    return {};
  }
}

export function writeTargetEndFieldMap(path: string, map: TargetEndFieldMap) {
  const targetEnd =
    typeof map.targetEnd === "string" && map.targetEnd.startsWith("customfield_")
      ? map.targetEnd
      : undefined;
  if (!targetEnd) return;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify({ targetEnd }, null, 2)}\n`);
}
