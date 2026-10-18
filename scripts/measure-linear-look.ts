import { spawn, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const origin = process.env.PIPE_KAN_ORIGIN ?? "http://127.0.0.1:5199";
const label = process.argv[2] ?? "sample";

type Cdp = {
  send: (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;
  close: () => void;
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForJson(url: string) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    try {
      const res = await fetch(url);
      if (res.ok) return res.json();
    } catch {
      /* chrome still starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`chrome did not open ${url}`);
}

async function launchChrome(): Promise<{ child: ChildProcess; port: number; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), "pipe-kan-chrome-"));
  const port = await freePort();
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${dir}`,
      `--remote-debugging-port=${port}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  await waitForJson(`http://127.0.0.1:${port}/json/version`);
  return { child, port, dir };
}

function connect(url: string): Promise<Cdp> {
  const ws = new WebSocket(url);
  let seq = 0;
  const pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (err: Error) => void }>();
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      resolve({
        send(method, params) {
          const id = ++seq;
          return new Promise((done, fail) => {
            pending.set(id, { resolve: done, reject: fail });
            ws.send(JSON.stringify({ id, method, params }));
          });
        },
        close() {
          ws.close();
        },
      });
    });
    ws.addEventListener("error", () => reject(new Error("cdp socket failed")));
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown>; error?: { message?: string } };
      if (!message.id || !pending.has(message.id)) return;
      const waiter = pending.get(message.id)!;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message ?? "cdp error"));
      else waiter.resolve(message.result ?? {});
    });
  });
}

async function evaluate<T>(cdp: Cdp, expression: string): Promise<T> {
  const result = await cdp.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  const remote = result.result as { value?: T; description?: string } | undefined;
  const exception = result.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
  if (exception) throw new Error(exception.exception?.description ?? exception.text ?? "evaluate failed");
  return remote?.value as T;
}

const COLD = `(() => new Promise((resolve) => {
  const started = performance.now();
  const tick = () => {
    const columns = document.querySelectorAll('[data-slot="kanban-column"]');
    if (columns.length) {
      const mark = performance.getEntriesByName("pipe-kan:cold-load").at(-1);
      resolve({
        domMs: Math.round(performance.now()),
        markedMs: mark && "duration" in mark ? Math.round(mark.duration) : null,
        columns: columns.length,
      });
      return;
    }
    if (performance.now() - started > 25000) {
      resolve({ error: "no column", text: (document.body?.innerText ?? "").slice(0, 240) });
      return;
    }
    setTimeout(tick, 40);
  };
  tick();
}))()`;

const CARDS = `(() => [...document.querySelectorAll('[data-slot="kanban-item"]')].map((node) => node.getAttribute("data-value")).sort().join("|"))()`;

const POINT = (source: string) => `(() => {
  const el = ${source};
  if (!el) return null;
  const box = el.getBoundingClientRect();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, text: (el.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 80) };
})()`;

async function mouseClick(cdp: Cdp, point: { x: number; y: number }) {
  await cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
}

async function waitForCardChange(cdp: Cdp, before: string, markName: string) {
  const started = Date.now();
  while (Date.now() - started < 8000) {
    const now = await evaluate<string>(cdp, CARDS);
    const marked = await evaluate<number | null>(
      cdp,
      `(() => { const mark = performance.getEntriesByName(${JSON.stringify(markName)}).at(-1); return mark && "duration" in mark ? Math.round(mark.duration) : null; })()`,
    );
    if (now && now !== before) {
      return { domMs: Date.now() - started, markedMs: marked, cards: now };
    }
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  const now = await evaluate<string>(cdp, CARDS);
  return { error: "switch idle", domMs: Date.now() - started, before, now };
}

async function sample(cdp: Cdp) {
  await cdp.send("Page.navigate", { url: origin });
  const cold = await evaluate<Record<string, unknown>>(cdp, COLD);
  const beforeProject = await evaluate<string>(cdp, CARDS);
  const switcher = await evaluate<{ x: number; y: number; text: string } | null>(
    cdp,
    POINT(`document.querySelector('[aria-label="Switch workspace"]')`),
  );
  let project: Record<string, unknown> = { error: "no switcher" };
  if (switcher) {
    await mouseClick(cdp, switcher);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const projectPoint = await evaluate<{ text: string } | null>(
      cdp,
      `(() => {
        const el = [...document.querySelectorAll("button")].find((button) => /Aphrodite|Acme-product|\\bAPH\\b/.test(button.textContent ?? ""));
        if (!(el instanceof HTMLElement)) return null;
        el.click();
        return { text: (el.textContent ?? "").replace(/\\s+/g, " ").trim().slice(0, 80) };
      })()`,
    );
    if (!projectPoint) {
      const sampleButtons = await evaluate<string[]>(
        cdp,
        `(() => [...document.querySelectorAll("button")].map((button) => (button.textContent ?? "").trim()).filter(Boolean).slice(0, 24))()`,
      );
      project = { error: "no project target", sample: sampleButtons };
    } else {
      project = { ...(await waitForCardChange(cdp, beforeProject, "pipe-kan:project-switch")), target: projectPoint.text };
    }
  }
  await cdp.send("Page.navigate", { url: origin });
  await evaluate(cdp, COLD);
  const beforeWorkspace = await evaluate<string>(cdp, CARDS);
  const workspacePoint = await evaluate<{ text: string } | null>(
    cdp,
    `(() => {
      const cards = [...document.querySelectorAll('[data-slot="kanban-item"]')].map((node) => node.getAttribute("data-value") ?? "");
      const onPersonal = cards.length > 0 && cards.every((key) => key.startsWith("personal/"));
      const want = onPersonal ? "work/PULSE" : "personal/PULSE";
      const el = document.querySelector('[data-smoke="team-scope"][data-team="' + want + '"]')
        ?? [...document.querySelectorAll("button")].find((button) => (button.textContent ?? "").trim() === want)
        ?? [...document.querySelectorAll("button")].find((button) => /Acme Demo/.test(button.textContent ?? ""));
      if (!(el instanceof HTMLElement)) return null;
      el.scrollIntoView({ block: "center" });
      el.click();
      return { text: (el.getAttribute("data-team") || el.textContent || "").trim().slice(0, 80) };
    })()`,
  );
  const workspace = workspacePoint
    ? { ...(await waitForCardChange(cdp, beforeWorkspace, "pipe-kan:workspace-switch")), target: workspacePoint.text }
    : { error: "no workspace target" };
  return { cold, project, workspace };
}

async function main() {
  const chrome = await launchChrome();
  try {
    const list = (await waitForJson(`http://127.0.0.1:${chrome.port}/json/list`)) as { webSocketDebuggerUrl: string; type: string }[];
    const page = list.find((item) => item.type === "page");
    if (!page) throw new Error("no chrome page");
    const cdp = await connect(page.webSocketDebuggerUrl);
    await cdp.send("Runtime.enable");
    await cdp.send("Page.enable");
    const runs = [];
    const samples = Number(process.env.SAMPLES ?? 3);
    for (let index = 0; index < samples; index += 1) runs.push(await sample(cdp));
    const line = JSON.stringify({ label, origin, runs });
    console.log(line);
    cdp.close();
  } finally {
    chrome.child.kill("SIGTERM");
    rmSync(chrome.dir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
