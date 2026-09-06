import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";

import {
  commandOnPath,
  DEFAULT_CONFIG,
  FALLBACK_MODELS,
  loadAgentConfig,
  saveAgentConfig,
} from "./config.ts";

test("commandOnPath finds a binary on PATH", () => {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-path-"));
  const bin = join(dir, "devin");
  writeFileSync(bin, "");
  chmodSync(bin, 0o755);
  expect(commandOnPath("devin", { PATH: dir })).toBe(true);
  expect(commandOnPath("missing-agent", { PATH: dir })).toBe(false);
});

test("saveAgentConfig persists default agent and model", () => {
  const path = join(mkdtempSync(join(tmpdir(), "pipe-kan-cfg-")), "agent.json");
  saveAgentConfig({ defaultAgent: "devin", agents: { devin: { model: "swe-1-6" } } }, path);
  const loaded = loadAgentConfig(path);
  expect(loaded.defaultAgent).toBe("devin");
  expect(loaded.agents.devin.model).toBe("swe-1-6");
  expect(loaded.agents.cursor.command).toBe("cursor-agent");
  const raw = JSON.parse(readFileSync(path, "utf8")) as { defaultAgent: string };
  expect(raw.defaultAgent).toBe("devin");
});

test("Devin fallback models include SWE-1.6 slow", () => {
  expect(FALLBACK_MODELS.devin).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "swe-1-6-slow", name: "SWE-1.6 (slow)" })]),
  );
});

test("default agent is Devin with SWE-1.6", () => {
  expect(DEFAULT_CONFIG.defaultAgent).toBe("devin");
  expect(DEFAULT_CONFIG.agents.devin.model).toBe("swe-1-6-slow");
});
