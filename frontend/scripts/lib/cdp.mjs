/**
 * Minimal Chrome DevTools Protocol client.
 *
 * Node built-ins only — no Playwright, no Puppeteer, no browser extension.
 * Chrome itself is the only requirement. Shared by capture.mjs and
 * export-check.mjs; see frontend/DESIGN.md for how they fit the review loop.
 */
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

export const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const BASE = process.env.CAPTURE_BASE ?? "http://localhost:5173";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function retry(fn, attempts = 40, delay = 250) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      await sleep(delay);
    }
  }
  throw last ?? new Error("timed out");
}

function connect(url) {
  const ws = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let id = 0;
  ws.addEventListener("message", (e) => {
    const msg = JSON.parse(e.data);
    if (msg.method) {
      listeners.get(msg.method)?.forEach((fn) => fn(msg.params));
      return;
    }
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    if (msg.error) {
      entry.reject(new Error(JSON.stringify(msg.error)));
    } else {
      entry.resolve(msg.result);
    }
  });
  return {
    ready: new Promise((r) => ws.addEventListener("open", r)),
    on: (method, fn) => listeners.set(method, [...(listeners.get(method) ?? []), fn]),
    send: (method, params = {}) =>
      new Promise((resolve, reject) => {
        const n = ++id;
        pending.set(n, { resolve, reject });
        ws.send(JSON.stringify({ id: n, method, params }));
      }),
    close: () => ws.close(),
  };
}

/**
 * Launches headless Chrome on an ephemeral debugging port and attaches to its
 * first page target. Returns the client plus a `dispose` that shuts Chrome down
 * and removes its throwaway profile.
 */
export async function launch(outDir) {
  mkdirSync(outDir, { recursive: true });
  const port = 9333 + Math.floor(Math.random() * 400);
  const profile = join(outDir, ".chrome-profile");

  const chrome = spawn(
    CHROME,
    [
      "--headless",
      "--disable-gpu",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const wsUrl = await retry(async () => {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`);
    const page = (await res.json()).find((t) => t.type === "page");
    if (!page) throw new Error("no page target");
    return page.webSocketDebuggerUrl;
  });

  const cdp = connect(wsUrl);
  await cdp.ready;

  return {
    cdp,
    async dispose() {
      cdp.close();
      // Killing Chrome is asynchronous; deleting the profile while it is still
      // shutting down races and throws ENOTEMPTY.
      const exited = new Promise((r) => chrome.once("exit", r));
      chrome.kill();
      await Promise.race([exited, sleep(5000)]);
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      } catch {
        // A leftover profile is harmless; it lives inside the ignored output dir.
      }
    },
  };
}

/** Evaluates an expression in the page and returns its value. */
export async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception?.description ?? "evaluation failed");
  }
  return result.value;
}
