import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FactoryStageTag = "planning" | "desk" | "maker" | "coordinator" | "human-wait";

export type FactoryJobEvent = {
  ts: string;
  event: string;
  id: string;
  from_bot?: string;
  repo?: string;
  session?: string;
  orch_pane?: string;
  summary?: string;
  status?: string;
  detail?: string;
  target_agent?: string;
  pull_request_url?: string;
  plane_project?: string;
};

export type FactoryJob = {
  id: string;
  summary: string;
  status: string;
  /** null for terminal (done/cancelled) jobs */
  stageTag: FactoryStageTag | null;
  latestTs: string;
  pullRequestUrl?: string;
  planeProject?: string;
  detail?: string;
  session?: string;
  fromBot?: string;
};

// ---------------------------------------------------------------------------
// Ledger path
// ---------------------------------------------------------------------------

const DEFAULT_LEDGER_PATH =
  "~/code/software-factory/asf/runtime/factory-coordinator/jobs.jsonl";

export function resolveLedgerPath(env: Record<string, string | undefined> = process.env): string {
  const raw = env.FACTORY_LEDGER_PATH ?? DEFAULT_LEDGER_PATH;
  return raw.startsWith("~/") ? join(homedir(), raw.slice(2)) : raw;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export function parseJobsJsonl(text: string): FactoryJobEvent[] {
  const events: FactoryJobEvent[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      events.push(JSON.parse(trimmed) as FactoryJobEvent);
    } catch {
      // skip malformed lines
    }
  }
  return events;
}

// ---------------------------------------------------------------------------
// Stage-tag derivation (ADR 0018 mapping table)
// ---------------------------------------------------------------------------

function lc(...parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(" ").toLowerCase();
}

export function deriveStageTag(events: FactoryJobEvent[]): FactoryStageTag | null {
  if (!events.length) return null;
  const last = events[events.length - 1];

  // Terminal: no tag
  if (last.status === "done" || last.status === "cancelled") return null;

  const text = lc(last.detail, last.summary, last.target_agent, last.from_bot);
  const fromBot = lc(last.from_bot);
  const targetAgent = lc(last.target_agent);
  const detail = lc(last.detail);

  // 1. human-wait: blocked status OR human-gate language
  if (
    last.status === "blocked" ||
    /needs.{0,4}judgment|green.{0,4}light|await.{0,4}ship|awaiting.{0,4}ship|needs.{0,4}input|waiting.{0,4}operator|checks.{0,4}pass|verify.{0,4}pass|human.{0,4}gate/.test(text)
  ) {
    return "human-wait";
  }

  // 2. coordinator: queued/routed or Grokbot/switchboard
  if (
    last.status === "queued" ||
    last.status === "routed" ||
    /grokbot.{0,4}coordinator|intake.{0,4}switchboard/.test(fromBot) ||
    /routing|switchboard/.test(text)
  ) {
    return "coordinator";
  }

  // 3. planning: planner target_agent or planning-stage language
  if (
    /planner|plan_|stage_1a/.test(targetAgent) ||
    /planner|to.{0,2}spec|to.{0,2}tickets|grill.{0,4}with.{0,4}docs|stage_1/.test(text)
  ) {
    return "planning";
  }

  // 4. desk: desk= in detail or preflight/research language
  if (
    /desk=/.test(detail) ||
    /preflight|research.{0,4}gate|research.{0,4}dossier/.test(text)
  ) {
    return "desk";
  }

  // 5. maker: maker/implement/referee/omp/stage_2 target or PR language
  if (
    /maker|implement|referee|omp|stage_2/.test(targetAgent) ||
    /\bmaker\b|implement|referee|stage_2|pr.{0,4}open|pull.{0,4}request/.test(text)
  ) {
    return "maker";
  }

  // default: unclassified in_progress → coordinator
  return "coordinator";
}

// ---------------------------------------------------------------------------
// Grouping + classification
// ---------------------------------------------------------------------------

function extractPrUrl(detail: string | undefined): string | undefined {
  if (!detail) return undefined;
  const m = /https:\/\/github\.com\/[^\s"']+\/pull\/\d+/.exec(detail);
  return m?.[0];
}

export function groupByLatest(events: FactoryJobEvent[]): Map<string, FactoryJobEvent[]> {
  const map = new Map<string, FactoryJobEvent[]>();
  for (const ev of events) {
    if (!ev.id) continue;
    const list = map.get(ev.id);
    if (list) {
      list.push(ev);
    } else {
      map.set(ev.id, [ev]);
    }
  }
  return map;
}

function jobFromEvents(id: string, events: FactoryJobEvent[]): FactoryJob {
  const last = events[events.length - 1];
  const pullRequestUrl =
    events.map((e) => e.pull_request_url ?? extractPrUrl(e.detail)).find(Boolean);
  return {
    id,
    summary: last.summary ?? "",
    status: last.status ?? "",
    stageTag: deriveStageTag(events),
    latestTs: last.ts,
    ...(pullRequestUrl ? { pullRequestUrl } : {}),
    ...(last.plane_project ? { planeProject: last.plane_project } : {}),
    ...(last.detail ? { detail: last.detail } : {}),
    ...(last.session ? { session: last.session } : {}),
    ...(last.from_bot ? { fromBot: last.from_bot } : {}),
  };
}

export function classifyJobs(events: FactoryJobEvent[]): FactoryJob[] {
  const grouped = groupByLatest(events);
  const jobs: FactoryJob[] = [];
  for (const [id, evs] of grouped) {
    jobs.push(jobFromEvents(id, evs));
  }
  // Most-recent first
  jobs.sort((a, b) => b.latestTs.localeCompare(a.latestTs));
  return jobs;
}

// ---------------------------------------------------------------------------
// Cached ledger read
// ---------------------------------------------------------------------------

type LedgerCache = { path: string; mtime: number; jobs: FactoryJob[] };
let _cache: LedgerCache | null = null;

export type LedgerResult = { jobs: FactoryJob[]; error?: string };

export function readLedger(env: Record<string, string | undefined> = process.env): LedgerResult {
  const path = resolveLedgerPath(env);
  if (!existsSync(path)) {
    return { jobs: [], error: `Ledger not found: ${path}` };
  }
  try {
    const mtime = statSync(path).mtimeMs;
    if (_cache && _cache.path === path && _cache.mtime === mtime) {
      return { jobs: _cache.jobs };
    }
    const text = readFileSync(path, "utf8");
    const jobs = classifyJobs(parseJobsJsonl(text));
    _cache = { path, mtime, jobs };
    return { jobs };
  } catch (err) {
    return { jobs: [], error: String(err) };
  }
}
