import { expect, test } from "vitest";

import {
  modelsFromConfigOptions,
  parseAvailableModelsFromError,
  resolveRequestedModel,
  selectedModelFromConfigOptions,
} from "./models.ts";

test("modelsFromConfigOptions reads a flat model selector", () => {
  const models = modelsFromConfigOptions([
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: "swe-1-6",
      options: [
        { value: "swe-1-6", name: "SWE-1.6 (slow)" },
        { value: "swe-1-6-fast", name: "SWE-1.6 Fast" },
      ],
    },
  ]);
  expect(models).toEqual([
    { id: "swe-1-6", name: "SWE-1.6 (slow)" },
    { id: "swe-1-6-fast", name: "SWE-1.6 Fast" },
  ]);
  expect(
    selectedModelFromConfigOptions([
      {
        id: "model",
        name: "Model",
        category: "model",
        type: "select",
        currentValue: "swe-1-6",
        options: [{ value: "swe-1-6", name: "SWE-1.6 (slow)" }],
      },
    ]),
  ).toBe("swe-1-6");
});

test("modelsFromConfigOptions flattens grouped options", () => {
  const models = modelsFromConfigOptions([
    {
      id: "model",
      name: "Model",
      category: "model",
      type: "select",
      currentValue: "composer-2",
      options: [
        {
          group: "cursor",
          name: "Cursor",
          options: [
            { value: "composer-2", name: "Composer 2" },
            { value: "composer-2-fast", name: "Composer 2 Fast" },
          ],
        },
      ],
    },
  ]);
  expect(models.map((m) => m.id)).toEqual(["composer-2", "composer-2-fast"]);
});

test("resolveRequestedModel maps swe-1-6 to Devin's swe-1-6-slow id", () => {
  const live = [
    { id: "swe-1-6-slow", name: "SWE-1.6 (slow)" },
    { id: "swe-1-6-fast", name: "SWE-1.6 Fast" },
  ];
  expect(resolveRequestedModel("swe-1-6", live)).toBe("swe-1-6-slow");
  expect(resolveRequestedModel("swe-1-6-slow", live)).toBe("swe-1-6-slow");
  expect(resolveRequestedModel("claude-sonnet-5-max", live)).toBeNull();
});

test("parseAvailableModelsFromError reads Devin's set_config_option payload", () => {
  expect(
    parseAvailableModelsFromError(
      'Resource not found {"uri":"Model not found: swe-1-6. Available models: swe-1-6-slow"}',
    ),
  ).toEqual(["swe-1-6-slow"]);
});
