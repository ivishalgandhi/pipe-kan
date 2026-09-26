import { expect, test } from "vitest";

import {
  classifyJobs,
  deriveStageTag,
  groupByLatest,
  parseJobsJsonl,
  resolveLedgerPath,
  type FactoryJobEvent,
} from "./factory-ledger.ts";

// ---------------------------------------------------------------------------
// Sample events (representative subset from real jobs.jsonl)
// ---------------------------------------------------------------------------

function ev(overrides: Partial<FactoryJobEvent>): FactoryJobEvent {
  return {
    ts: "2026-09-20T12:00:00Z",
    event: "status",
    id: "gbj-20260920-001",
    status: "in_progress",
    summary: "sample job",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// resolveLedgerPath
// ---------------------------------------------------------------------------

test("resolveLedgerPath uses FACTORY_LEDGER_PATH env when set", () => {
  const result = resolveLedgerPath({ FACTORY_LEDGER_PATH: "/custom/path/jobs.jsonl" });
  expect(result).toBe("/custom/path/jobs.jsonl");
});

test("resolveLedgerPath expands ~/... with homedir", () => {
  const result = resolveLedgerPath({});
  expect(result).toMatch(/^\/.*jobs\.jsonl$/);
  expect(result).not.toContain("~");
});

// ---------------------------------------------------------------------------
// parseJobsJsonl
// ---------------------------------------------------------------------------

test("parseJobsJsonl parses valid NDJSON", () => {
  const line1 = JSON.stringify(ev({ id: "gbj-001", event: "created", status: "queued" }));
  const line2 = JSON.stringify(ev({ id: "gbj-001", event: "routed", status: "routed" }));
  const events = parseJobsJsonl(`${line1}\n${line2}\n`);
  expect(events).toHaveLength(2);
  expect(events[0].status).toBe("queued");
  expect(events[1].status).toBe("routed");
});

test("parseJobsJsonl skips blank lines and malformed JSON", () => {
  const good = JSON.stringify(ev({ id: "gbj-001" }));
  const events = parseJobsJsonl(`\n${good}\nnot-json\n\n`);
  expect(events).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// groupByLatest
// ---------------------------------------------------------------------------

test("groupByLatest groups events by id in insertion order", () => {
  const events = [
    ev({ id: "gbj-001", event: "created" }),
    ev({ id: "gbj-002", event: "created" }),
    ev({ id: "gbj-001", event: "routed" }),
  ];
  const map = groupByLatest(events);
  expect(map.size).toBe(2);
  expect(map.get("gbj-001")).toHaveLength(2);
  expect(map.get("gbj-002")).toHaveLength(1);
});

// ---------------------------------------------------------------------------
// deriveStageTag — priority chain
// ---------------------------------------------------------------------------

test("deriveStageTag returns null for done jobs", () => {
  expect(deriveStageTag([ev({ status: "done" })])).toBeNull();
});

test("deriveStageTag returns null for cancelled jobs", () => {
  expect(deriveStageTag([ev({ status: "cancelled" })])).toBeNull();
});

test("deriveStageTag human-wait: status blocked", () => {
  expect(deriveStageTag([ev({ status: "blocked" })])).toBe("human-wait");
});

test("deriveStageTag human-wait: 'await ship' in detail", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", detail: "checks PASS, await ship" })]),
  ).toBe("human-wait");
});

test("deriveStageTag human-wait: 'checks pass' in summary", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", summary: "Checks pass; awaiting operator ship" })]),
  ).toBe("human-wait");
});

test("deriveStageTag coordinator: status queued", () => {
  expect(deriveStageTag([ev({ status: "queued" })])).toBe("coordinator");
});

test("deriveStageTag coordinator: status routed", () => {
  expect(deriveStageTag([ev({ status: "routed" })])).toBe("coordinator");
});

test("deriveStageTag coordinator: from_bot Grokbot Coordinator", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", from_bot: "Grokbot Coordinator" })]),
  ).toBe("coordinator");
});

test("deriveStageTag planning: target_agent contains planner", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", target_agent: "DbrePhasePlanner" })]),
  ).toBe("planning");
});

test("deriveStageTag planning: to-spec in detail", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", detail: "running to-spec and to-tickets" })]),
  ).toBe("planning");
});

test("deriveStageTag desk: desk= in detail", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", detail: "desk=desk-pipe-kan; target_agent=omp" })]),
  ).toBe("desk");
});

test("deriveStageTag desk: preflight in detail", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", detail: "preflight ok; research gate passed" })]),
  ).toBe("desk");
});

test("deriveStageTag maker: target_agent contains maker", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", target_agent: "maker-011" })]),
  ).toBe("maker");
});

test("deriveStageTag maker: target_agent referee", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", target_agent: "Referee on jira-kan" })]),
  ).toBe("maker");
});

test("deriveStageTag maker: PR open in detail", () => {
  expect(
    deriveStageTag([ev({ status: "in_progress", detail: "PR open https://github.com/ivishalgandhi/pipe-kan/pull/99" })]),
  ).toBe("maker");
});

test("deriveStageTag: priority — human-wait beats queued", () => {
  // blocked overrides queued
  expect(
    deriveStageTag([ev({ status: "blocked", from_bot: "Grokbot Coordinator" })]),
  ).toBe("human-wait");
});

test("deriveStageTag: priority — coordinator beats planning when queued + planner summary", () => {
  // queued fires coordinator (step 2) before planning (step 3)
  expect(
    deriveStageTag([ev({ status: "queued", summary: "planner run to-spec" })]),
  ).toBe("coordinator");
});

test("deriveStageTag returns coordinator as default for plain in_progress", () => {
  expect(deriveStageTag([ev({ status: "in_progress" })])).toBe("coordinator");
});

// ---------------------------------------------------------------------------
// classifyJobs
// ---------------------------------------------------------------------------

test("classifyJobs latest-per-id, sorted by latestTs desc", () => {
  const events = [
    ev({ id: "gbj-001", ts: "2026-09-19T10:00:00Z", event: "created", status: "queued" }),
    ev({ id: "gbj-002", ts: "2026-09-20T08:00:00Z", event: "created", status: "queued" }),
    ev({ id: "gbj-001", ts: "2026-09-19T11:00:00Z", event: "status", status: "in_progress" }),
  ];
  const jobs = classifyJobs(events);
  expect(jobs).toHaveLength(2);
  // gbj-002 has a later latestTs
  expect(jobs[0].id).toBe("gbj-002");
  expect(jobs[1].id).toBe("gbj-001");
  expect(jobs[1].status).toBe("in_progress");
  expect(jobs[1].stageTag).toBe("coordinator");
});

test("classifyJobs extracts pullRequestUrl from any event detail", () => {
  const events = [
    ev({ id: "gbj-001", event: "created", status: "in_progress" }),
    ev({
      id: "gbj-001",
      event: "status",
      status: "blocked",
      detail: "checks PASS. PR open https://github.com/ivishalgandhi/pipe-kan/pull/77",
    }),
  ];
  const jobs = classifyJobs(events);
  expect(jobs[0].pullRequestUrl).toBe("https://github.com/ivishalgandhi/pipe-kan/pull/77");
});

test("classifyJobs terminal jobs have stageTag null", () => {
  const events = [
    ev({ id: "gbj-001", event: "done", status: "done" }),
  ];
  const jobs = classifyJobs(events);
  expect(jobs[0].stageTag).toBeNull();
});

// ---------------------------------------------------------------------------
// Multi-event job: stage evolves over lifecycle
// ---------------------------------------------------------------------------

test("deriveStageTag uses only the latest event", () => {
  const events = [
    ev({ event: "created", status: "queued" }),    // coordinator
    ev({ event: "routed",  status: "routed" }),    // coordinator
    ev({ event: "status",  status: "in_progress", target_agent: "DbrePlanner" }), // planning
  ];
  expect(deriveStageTag(events)).toBe("planning");
});
