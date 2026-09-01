#!/usr/bin/env node
/**
 * Capture screenshots and print-PDFs of the running dev server.
 *
 * The visual half of the review loop in DESIGN.md. Drives headless Chrome over
 * the DevTools Protocol using only Node built-ins — no Playwright, no Puppeteer,
 * no browser extension. Chrome itself is the only requirement.
 *
 *   npm run dev                                  # in another terminal, on :5173
 *   node scripts/capture.mjs /                   # the light/dark x 390/1440 matrix
 *   node scripts/capture.mjs /ui --out shots     # the component gallery
 *   node scripts/capture.mjs / --pdf             # also print to PDF, Letter and A4
 *
 * Output goes to .captures/ (git-ignored) unless --out says otherwise.
 *
 * Why this exists: nothing in `npm run lint && npm test && npm run build` can
 * tell you the UI looks wrong. This can.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const CHROME =
  process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = 9333 + Math.floor(Math.random() * 400);
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:5173";

/** light/dark x mobile/desktop — the matrix DESIGN.md asks for. */
const VIEWPORTS = [
  { label: "390", width: 390, height: 844 },
  { label: "1440", width: 1440, height: 1000 },
];
const PAPER = [
  { label: "letter", width: 8.5, height: 11 },
  { label: "a4", width: 8.27, height: 11.69 },
];

const args = process.argv.slice(2);
const route = args.find((a) => !a.startsWith("-")) ?? "/";
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".captures";
const wantPdf = args.includes("--pdf");
const routeSlug = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";

/*
  The brand goes in the filename, not just in whichever terminal ran the server.

  Without it, capturing `/` against the office dev server silently overwrites
  the travel captures of the same route — and the two are meant to be compared,
  so the failure is a reviewer looking at one brand twice and concluding they
  agree. Defaults to `travel` to match `DEV_DEFAULT_BRAND` in vite.config.ts,
  which is what a dev server with no VITE_BRAND is actually serving.

  Set it to whatever the dev server was started with:
    VITE_BRAND=office npm run dev
    VITE_BRAND=office npm run capture -- /
*/
const brand = process.env.VITE_BRAND || "travel";
const slug = `${brand}-${routeSlug}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch {
      await sleep(250);
    }
  }
  throw new Error("timed out waiting for Chrome");
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

const profile = join(outDir, ".chrome-profile");
mkdirSync(outDir, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let failed = false;
try {
  const wsUrl = await waitFor(async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
    const page = (await res.json()).find((t) => t.type === "page");
    if (!page) throw new Error("no page target");
    return page.webSocketDebuggerUrl;
  });

  const cdp = connect(wsUrl);
  await cdp.ready;
  await cdp.send("Page.enable");
  await cdp.send("Network.enable");

  // Zero API calls on load for a signed-out visitor is an architectural
  // constraint, so the capture run checks it rather than trusting it.
  const apiCalls = [];
  cdp.on("Network.requestWillBeSent", ({ request }) => {
    if (request?.url?.includes("/api/")) apiCalls.push(request.url);
  });
  const url = `${BASE}${route}`;

  for (const scheme of ["light", "dark"]) {
    await cdp.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-color-scheme", value: scheme }],
    });
    for (const vp of VIEWPORTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      await cdp.send("Page.navigate", { url });
      await sleep(2500);
      const { data } = await cdp.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: true,
      });
      const file = join(outDir, `${slug}-${vp.label}-${scheme}.png`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(`  ${file}`);
    }
  }

  if (wantPdf) {
    await cdp.send("Emulation.clearDeviceMetricsOverride");
    for (const paper of PAPER) {
      await cdp.send("Page.navigate", { url });
      await sleep(2500);
      const { data } = await cdp.send("Page.printToPDF", {
        paperWidth: paper.width,
        paperHeight: paper.height,
        printBackground: true,
      });
      const file = join(outDir, `${slug}-${paper.label}.pdf`);
      writeFileSync(file, Buffer.from(data, "base64"));
      console.log(`  ${file}`);
    }
  }

  if (apiCalls.length) {
    console.log(`\n  note: ${apiCalls.length} API request(s) on load`);
  }
  cdp.close();
} catch (error) {
  failed = true;
  console.error(`capture failed: ${error.message}`);
  console.error(`is the dev server running on ${BASE}?`);
} finally {
  // Wait for Chrome to actually exit before removing its profile — killing it is
  // asynchronous, and deleting the directory out from under it races.
  const exited = new Promise((r) => chrome.once("exit", r));
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  try {
    rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    // A leftover profile is harmless; it is inside the (git-ignored) output dir.
  }
}

process.exit(failed ? 1 : 0);
