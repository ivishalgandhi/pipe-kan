import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { expect, test } from "vitest";

import { createSkillRegistry, skillContextBlock } from "./skills.ts";

const bundledDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", ".agents", "skills");

test("skill registry lists bundled skills", () => {
  const registry = createSkillRegistry(bundledDir);
  const ids = registry.list().map((s) => s.id);
  expect(ids).toEqual(expect.arrayContaining(["ask-matt", "code-review", "triage", "research"]));
});

test("skill registry loads bundled skill body", () => {
  const registry = createSkillRegistry(bundledDir);
  const skill = registry.load("ask-matt");
  expect(skill).toBeDefined();
  expect(skill?.name).toBe("ask-matt");
  expect(skill?.body).toContain("Ask Matt");
  expect(skill?.body).toContain("/code-review");
});

test("skillContextBlock converts skill to resource block", () => {
  const registry = createSkillRegistry(bundledDir);
  const skill = registry.load("triage")!;
  const block = skillContextBlock(skill);
  expect(block.type).toBe("resource");
  if (block.type !== "resource") throw new Error("expected resource block");
  expect(block.resource.uri).toBe("skill://triage");
  expect(block.resource.mimeType).toBe("text/markdown");
  expect(block.resource.text).toContain("Triage");
});
