import { describe, expect, test, vi } from "vitest";

import { createMoveQueue, type MoveRequest } from "./move-queue.ts";

describe("createMoveQueue", () => {
  test("runs a single move and reports success", async () => {
    const run = vi.fn(async () => ({ ok: true }));
    const onRollback = vi.fn();
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback, toast });

    const { promise, resolve } = Promise.withResolvers<void>();
    run.mockImplementationOnce(async () => {
      resolve();
      return { ok: true };
    });

    queue.move({ key: "DEMO-1", target: "Done", source: "In Progress", kind: "card" });
    await promise;

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({
      key: "DEMO-1",
      target: "Done",
      source: "In Progress",
      kind: "card",
    });
    expect(toast.success).toHaveBeenCalledWith("Moved DEMO-1 to Done", { id: "toast-1" });
    expect(toast.error).not.toHaveBeenCalled();
    expect(onRollback).not.toHaveBeenCalled();
  });

  test("rolls back a failed move and reports the error", async () => {
    const run = vi.fn(async () => ({ ok: false, error: "invalid transition" }));
    const onRollback = vi.fn();
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback, toast });

    const { promise, resolve } = Promise.withResolvers<void>();
    run.mockImplementationOnce(async () => {
      resolve();
      return { ok: false, error: "invalid transition" };
    });

    queue.move({ key: "DEMO-2", target: "Done", source: "To Do", kind: "card" });
    await promise;

    expect(toast.error).toHaveBeenCalledWith("Move DEMO-2 failed", {
      id: "toast-1",
      description: "invalid transition",
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(onRollback).toHaveBeenCalledWith({
      key: "DEMO-2",
      target: "Done",
      source: "To Do",
      kind: "card",
    });
  });

  test("rolls back when run throws", async () => {
    const run = vi.fn(async () => {
      throw new Error("network down");
    });
    const onRollback = vi.fn();
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback, toast });

    const { promise, resolve } = Promise.withResolvers<void>();
    run.mockImplementationOnce(async () => {
      resolve();
      throw new Error("network down");
    });

    queue.move({ key: "DEMO-3", target: "In Progress", source: "To Do", kind: "card" });
    await promise;

    expect(toast.error).toHaveBeenCalledWith("Move DEMO-3 failed", {
      id: "toast-1",
      description: "network down",
    });
    expect(onRollback).toHaveBeenCalledWith({
      key: "DEMO-3",
      target: "In Progress",
      source: "To Do",
      kind: "card",
    });
  });

  test("drains queued moves in order", async () => {
    const order: string[] = [];
    const { promise, resolve } = Promise.withResolvers<void>();
    const run = vi.fn(async (req: MoveRequest) => {
      order.push(req.key);
      if (order.length === 2) resolve();
      return { ok: true };
    });
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback: () => {}, toast });

    queue.move([
      { key: "DEMO-4", target: "In Progress", source: "To Do", kind: "card" },
      { key: "DEMO-5", target: "Done", source: "In Progress", kind: "card" },
    ]);
    await promise;
    await Promise.resolve();

    expect(order).toEqual(["DEMO-4", "DEMO-5"]);
    expect(toast.success).toHaveBeenCalledTimes(2);
  });

  test("keeps draining when one move fails in the middle", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const run = vi.fn(async (req: MoveRequest) => {
      if (req.key === "DEMO-6") return { ok: false, error: "nope" };
      resolve();
      return { ok: true };
    });
    const onRollback = vi.fn();
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback, toast });

    queue.move([
      { key: "DEMO-6", target: "Done", source: "In Progress", kind: "card" },
      { key: "DEMO-7", target: "Done", source: "In Progress", kind: "card" },
    ]);
    await promise;
    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(2);
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledWith("Moved DEMO-7 to Done", { id: "toast-1" });
    expect(toast.error).toHaveBeenCalledWith("Move DEMO-6 failed", {
      id: "toast-1",
      description: "nope",
    });
  });

  test("bulk selection moves fail independently", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    const run = vi.fn(async (req: MoveRequest) => {
      if (req.key === "DEMO-6") return { ok: false, error: "nope" };
      if (req.key === "DEMO-7") resolve();
      return { ok: true };
    });
    const onRollback = vi.fn();
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback, toast });

    queue.move([
      { key: "DEMO-6", target: "Done", source: "In Progress", kind: "card" },
      { key: "DEMO-5", target: "Done", source: "In Progress", kind: "card" },
      { key: "DEMO-7", target: "Done", source: "In Progress", kind: "card" },
    ]);
    await promise;
    await Promise.resolve();

    expect(run).toHaveBeenCalledTimes(3);
    expect(onRollback).toHaveBeenCalledTimes(1);
    expect(toast.success).toHaveBeenCalledTimes(2);
    expect(toast.error).toHaveBeenCalledWith("Move DEMO-6 failed", {
      id: "toast-1",
      description: "nope",
    });
  });

  test("enqueue while running is picked up by the active loop", async () => {
    const { promise, resolve } = Promise.withResolvers<void>();
    let calls = 0;
    const run = vi.fn(async () => {
      calls += 1;
      if (calls === 2) resolve();
      return { ok: true };
    });
    const toast = {
      loading: vi.fn(() => "toast-1"),
      success: vi.fn(),
      error: vi.fn(),
    };
    const queue = createMoveQueue({ run, onRollback: () => {}, toast });

    queue.move({ key: "DEMO-8", target: "Done", source: "In Progress", kind: "card" });
    queue.move({ key: "DEMO-9", target: "Done", source: "In Progress", kind: "card" });
    await promise;

    expect(run).toHaveBeenCalledTimes(2);
  });
});
