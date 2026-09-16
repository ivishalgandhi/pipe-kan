import { expect, test } from "vitest";

import { refreshRequestBody } from "./refresh.ts";

test("Refresh all with a focused Epic still sends scope all", () => {
  expect(refreshRequestBody("all", "DEMO-1", "-pDEMO")).toEqual({
    scope: "all",
    flags: "-pDEMO",
  });
});

test("Refresh selected with a focused Epic sends that key", () => {
  expect(refreshRequestBody("selected", "DEMO-1", "-pDEMO")).toEqual({
    scope: "selected",
    epicKeys: ["DEMO-1"],
    flags: "-pDEMO",
  });
});

test("Refresh selected with no focused Epic is not a sent body", () => {
  expect(refreshRequestBody("selected", null, "-pDEMO")).toBeNull();
});

test("Refresh all with no focused Epic still sends all", () => {
  expect(refreshRequestBody("all", null, "")).toEqual({
    scope: "all",
    flags: "",
  });
});
