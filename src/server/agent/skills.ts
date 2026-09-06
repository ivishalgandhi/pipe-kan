import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { AgentContextBlock } from "./types.ts";

export type Skill = {
  id: string;
  name: string;
  description: string;
  body: string;
};

export type SkillRegistry = {
  list(): Skill[];
  load(id: string): Skill | undefined;
};

export function createSkillRegistry(bundledDir = join(import.meta.dirname, "..", "..", "..", ".agents", "skills")): SkillRegistry {
  const userDir = join(homedir(), ".pi", "agent", "skills");
  return {
    list() {
      const bundled = listSkills(bundledDir);
      const user = existsSync(userDir) ? listSkills(userDir) : [];
      const map = new Map<string, Skill>();
      for (const skill of bundled) map.set(skill.id, skill);
      for (const skill of user) map.set(skill.id, skill);
      return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
    load(id) {
      const userPath = skillPath(userDir, id);
      if (existsSync(userPath)) return readSkill(userPath, id);
      const bundledPath = skillPath(bundledDir, id);
      if (existsSync(bundledPath)) return readSkill(bundledPath, id);
      return undefined;
    },
  };
}

export function skillContextBlock(skill: Skill): AgentContextBlock {
  return {
    type: "resource",
    resource: {
      uri: `skill://${skill.id}`,
      mimeType: "text/markdown",
      text: skill.body,
    },
  };
}

function listSkills(dir: string): Skill[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => readSkill(skillPath(dir, entry.name), entry.name))
    .filter((skill): skill is Skill => skill !== undefined);
}

function skillPath(dir: string, id: string): string {
  return join(dir, id, "SKILL.md");
}

function readSkill(path: string, id: string): Skill | undefined {
  try {
    const text = readFileSync(path, "utf8");
    const front = parseFrontMatter(text);
    return {
      id,
      name: front.name ?? id,
      description: front.description ?? "",
      body: text,
    };
  } catch {
    return undefined;
  }
}

function parseFrontMatter(text: string): Record<string, string> {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!match) return {};
  const out: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return out;
}
