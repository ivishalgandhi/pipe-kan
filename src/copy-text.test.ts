import { expect, test } from "vitest";

import { copyText } from "./copy-text.ts";

test("copyText uses the clipboard API when it succeeds", async () => {
  const writes: string[] = [];
  await copyText("hello", {
    writeText: async (text) => {
      writes.push(text);
    },
  }, () => {
    throw new Error("fallback should not run");
  });
  expect(writes).toEqual(["hello"]);
});

test("copyText falls back when clipboard write is denied", async () => {
  const fallback: string[] = [];
  await copyText("board card", {
    writeText: async () => {
      throw new Error("NotAllowedError");
    },
  }, (text) => {
    fallback.push(text);
  });
  expect(fallback).toEqual(["board card"]);
});

test("copyText falls back when clipboard is missing", async () => {
  const fallback: string[] = [];
  await copyText("piped jira", null, (text) => {
    fallback.push(text);
  });
  expect(fallback).toEqual(["piped jira"]);
});
