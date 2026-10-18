import { readFileSync, writeSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBoardApp, refreshFromJira } from "./boot.ts";
import { resolveJiraBin } from "./cli.ts";
import { argvToFlags, setPlaneFlag } from "./flags.ts";
import { handleRequest } from "./http.ts";
import { writeJiraConfig } from "./jira-config.ts";
import { bindListen, resolveListen } from "./listen.ts";
import { DEFAULT_PLANE_HOST, planeHost, planeWorkspace } from "./plane.ts";
import { readOptionalStdin } from "./stdin.ts";
import { sendUi } from "./ui.ts";

async function readPipe(): Promise<unknown | null> {
  return readOptionalStdin();
}

function announce(line: string) {
  writeSync(1, `${line}\n`);
}

export async function runServer(opts: {
  root: string;
  fallback?: (req: IncomingMessage, res: ServerResponse) => void;
}) {
  const piped = await readPipe();
  const raw =
    piped ?? JSON.parse(readFileSync(join(opts.root, "fixtures/issues.json"), "utf8"));
  const flags = argvToFlags(process.argv);
  const booted = await createBoardApp({
    raw,
    piped: Boolean(piped),
    flags,
  });
  const live = {
    app: booted.app,
    store: booted.store,
    kind: booted.kind,
    raw,
  };

  async function switchSource(source: string) {
    if (source === "taskwarrior") {
      return { ok: false, kind: live.kind, source, reason: "Taskwarrior is not connected" };
    }
    if (source !== "plane" && source !== "jira") {
      return { ok: false, kind: live.kind, source, error: `Unknown source ${source}` };
    }
    if (source === "plane" && !process.env.PLANE_API_KEY?.trim()) {
      return { ok: false, kind: live.kind, source, reason: "Set PLANE_API_KEY to use Plane" };
    }
    const nextFlags = setPlaneFlag(live.app.flags, source === "plane");
    try {
      const next = await createBoardApp({ raw: live.raw, piped: false, flags: nextFlags });
      live.app = next.app;
      live.store = next.store;
      live.kind = next.kind;
      if (next.kind === "plane" || next.kind === "jira") {
        // Never block the switch on a slow upstream refresh; the Board fills in as it lands.
        const app = live.app;
        const kind = next.kind;
        void refreshFromJira(app, kind).catch((err) => {
          console.error(`${kind} Refresh after source switch failed`, err);
        });
        return { ok: true, kind: live.kind, source, refreshing: true };
      }
      return { ok: true, kind: live.kind, source };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, kind: live.kind, source, error: message };
    }
  }

  const server = createServer((req, res) => {
    if (handleRequest(req, res, { app: live.app, store: live.store, kind: live.kind, switchSource })) return;
    if (opts.fallback) {
      opts.fallback(req, res);
      return;
    }
    if (!sendUi(opts.root, req, res)) {
      res.statusCode = 404;
      res.end("pipe-kan UI is missing. Run bun run build.");
    }
  });

  const { host, port } = resolveListen();
  await bindListen(server, host, port);
  const origin = `http://127.0.0.1:${port}`;
  announce(`pipe-kan http://${host}:${port}`);
  if (live.kind === "plane") {
    // Listen first; the initial Plane refresh must not delay startup (it can take a minute).
    void refreshFromJira(live.app, live.kind, { piped: Boolean(piped) })
      .catch((err) => console.error(`${live.kind} Refresh failed`, err))
      .then(() => {
        const error = live.app.board().error;
        if (error) console.error(`${live.kind} Refresh failed; keeping last live Board`, error);
      });
  }
  if (live.kind === "plane") {
    announce(`cli plane ${planeHost()} ${planeWorkspace(flags)}`);
    announce(`Plane host default ${DEFAULT_PLANE_HOST}`);
  } else {
    const fakeConfig = writeJiraConfig(join(tmpdir(), "pipe-kan"), origin);
    announce(`cli ${live.kind === "jira" ? resolveJiraBin() : "store"}`);
    announce(`Fake Jira ${origin}/rest/api/2/search`);
    announce(`Fake Jira config ${fakeConfig}`);
  }

  if (live.kind === "jira") {
    try {
      await refreshFromJira(live.app, live.kind, { piped: Boolean(piped) });
    } catch (err) {
      console.error(`${live.kind} Refresh failed; keeping Fixture Board`);
      console.error(err);
    }
  }

}
