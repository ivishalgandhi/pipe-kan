import { readFileSync, writeSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createBoardApp, refreshFromJira } from "./boot.ts";
import { resolveJiraBin } from "./cli.ts";
import { argvToFlags } from "./flags.ts";
import { handleRequest } from "./http.ts";
import { writeJiraConfig } from "./jira-config.ts";
import { bindListen, resolveListen } from "./listen.ts";
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
  const { app, store, kind } = await createBoardApp({
    raw,
    piped: Boolean(piped),
    flags,
  });

  const server = createServer((req, res) => {
    if (handleRequest(req, res, { app, store })) return;
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
  const fakeConfig = writeJiraConfig(join(tmpdir(), "pipe-kan"), origin);
  announce(`pipe-kan http://${host}:${port}`);
  announce(`cli ${kind === "jira" ? resolveJiraBin() : "store"}`);
  announce(`Fake Jira ${origin}/rest/api/2/search`);
  announce(`Fake Jira config ${fakeConfig}`);


  if (kind === "jira") {
    try {
      await refreshFromJira(app, kind, { piped: Boolean(piped) });
    } catch (err) {
      console.error("jira Refresh failed; keeping Fixture Board");
      console.error(err);
    }
  }

}
