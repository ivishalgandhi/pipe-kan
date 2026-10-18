import { createServer } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";

import { packageRoot, sendUi, uiDir } from "./ui.ts";

const servers: { close(): void }[] = [];

afterEach(() => {
  while (servers.length) servers.pop()?.close();
});

async function listen(root: string) {
  const server = createServer((req, res) => {
    if (!sendUi(root, req, res)) {
      res.statusCode = 404;
      res.end("no");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  servers.push(server);
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no port");
  return `http://127.0.0.1:${addr.port}`;
}

function fakeUi() {
  const root = mkdtempSync(join(tmpdir(), "pipe-kan-ui-"));
  mkdirSync(uiDir(root), { recursive: true });
  writeFileSync(join(uiDir(root), "index.html"), "<html>board</html>");
  writeFileSync(join(uiDir(root), "app.js"), "ok");
  return root;
}

test("package root is the install directory", () => {
  const root = packageRoot();
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { name: string };
  expect(pkg.name).toBe("pipe-kan");
});

test("built Board is served from dist/ui", async () => {
  const base = await listen(fakeUi());
  const html = await (await fetch(base + "/")).text();
  const js = await (await fetch(base + "/app.js")).text();
  expect(html).toBe("<html>board</html>");
  expect(js).toBe("ok");
});

test("unknown paths fall back to the Board", async () => {
  const base = await listen(fakeUi());
  const html = await (await fetch(base + "/browse/DEMO-1")).text();
  expect(html).toBe("<html>board</html>");
});

test("UI is missing until build", async () => {
  const base = await listen(mkdtempSync(join(tmpdir(), "pipe-kan-empty-")));
  const res = await fetch(base + "/");
  expect(res.status).toBe(404);
});

test("path traversal stays inside the UI", async () => {
  const root = fakeUi();
  writeFileSync(join(root, "secret.txt"), "nope");
  const base = await listen(root);
  const body = await (await fetch(base + "/../secret.txt")).text();
  expect(body).toBe("<html>board</html>");
});
