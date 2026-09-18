import { createApp, type App } from "./app.ts";
import {
  createJiraCli,
  createStoreCli,
  resolveJiraBin,
  type Cli,
} from "./cli.ts";
import { jiraCliConfigPath } from "./field-map.ts";
import { wantsPlane } from "./flags.ts";
import { createPlaneCli, planeHost, planeWorkspace } from "./plane.ts";
import { IssueStore } from "./store.ts";

export type Boot = {
  app: App;
  store: IssueStore;
  kind: "jira" | "store" | "plane";
};

export async function createBoardApp(opts: {
  raw: unknown;
  piped?: boolean;
  env?: NodeJS.ProcessEnv;
  flags?: string;
  fetch?: typeof fetch;
  retryDelayMs?: number;
}): Promise<Boot> {
  const env = opts.env ?? process.env;
  const flags = opts.flags ?? "";
  const store = IssueStore.fromRaw(opts.raw);
  const plane = wantsPlane(flags);
  const bin = resolveJiraBin(env.JIRA_BIN ?? "jira", env.PATH ?? "");
  const cli: Cli = plane
    ? createPlaneCli({
        host: planeHost(env),
        apiKey: env.PLANE_API_KEY ?? "",
        workspace: planeWorkspace(flags, env),
        flags,
        fetch: opts.fetch,
        retryDelayMs: opts.retryDelayMs,
      })
    : bin
      ? createJiraCli({
          bin,
          configPath: env.JIRA_CONFIG_FILE,
          token: env.JIRA_API_TOKEN,
          flags,
        })
      : createStoreCli(store, flags);
  const app = createApp({
    store,
    cli,
    flags,
    jiraConfigPath: jiraCliConfigPath(env),
    liveBackend: plane,
  });
  if (opts.piped) {
    app.hydrate(opts.raw);
  } else {
    const local = createStoreCli(store, flags);
    app.hydrate(JSON.parse(await local.list(app.flags)), { fromStore: true });
  }
  return { app, store, kind: plane ? "plane" : bin ? "jira" : "store" };
}

export async function refreshFromJira(
  app: App,
  kind: Boot["kind"],
  opts: { piped?: boolean } = {},
) {
  if (opts.piped) return;
  if (kind !== "jira" && kind !== "plane") return;
  await app.refresh();
}
