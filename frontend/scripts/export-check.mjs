#!/usr/bin/env node
/**
 * Captures the card's PNG export by driving the real Export ▸ PNG flow.
 *
 * Steps 5 and 6 of the export regression checklist in DESIGN.md, automated. The
 * PNG is what users take away, and it is produced by `html-to-image` serialising
 * the card's *computed* styles — which makes it the output most likely to break
 * silently when the card renderer is restyled.
 *
 *   npm run dev                          # in another terminal
 *   node scripts/export-check.mjs        # writes .captures/export/*.png
 *
 * It clicks the real buttons rather than calling `toPng` directly, so the
 * filename logic and the `document.fonts.ready` gate are exercised too. Only the
 * final browser download is intercepted: the anchor's `click` is patched to hand
 * back the data URL instead of writing to the downloads folder.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { BASE, evaluate, launch, retry, sleep } from "./lib/cdp.mjs";

const args = process.argv.slice(2);
const outDir = args.includes("--out") ? args[args.indexOf("--out") + 1] : ".captures/export";

/**
 * Patches anchor downloads so a generated file is returned to us rather than
 * saved. Restores nothing — the page is discarded straight after.
 */
const INSTALL_INTERCEPT = `(() => {
  window.__exported = null;
  const original = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    if (this.download) {
      window.__exported = { name: this.download, href: this.href };
      return;
    }
    return original.call(this);
  };
  return true;
})()`;

/** Viewport centre of the first element whose trimmed text matches exactly. */
const centerOfText = (text, selector) => `(() => {
  const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})];
  const el = nodes.find((n) => n.textContent.trim() === ${JSON.stringify(text)});
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  return JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
})()`;

/**
 * Clicks with real input events rather than `element.click()`.
 *
 * Radix opens a dropdown on `pointerdown` and selects an item on `pointerup`;
 * a synthetic `click()` dispatches neither, so it silently does nothing. Real
 * events also mean this exercises the same path a user's mouse does, which is
 * the entire point of driving the UI instead of calling `toPng` directly.
 */
async function clickByText(cdp, text, selector) {
  const raw = await evaluate(cdp, centerOfText(text, selector));
  if (!raw) return false;
  const { x, y } = JSON.parse(raw);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await cdp.send("Input.dispatchMouseEvent", {
      type,
      x,
      y,
      button: "left",
      clickCount: 1,
    });
  }
  return true;
}

const { cdp, dispose } = await launch(outDir);
let failed = false;

try {
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1200,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // The gallery's CardView sample is a fully populated card — title, 26 entries
  // including a deliberately long one, and an emoji ring — with no sign-in and
  // no backend. That makes it the cheapest representative card to export.
  await cdp.send("Page.navigate", { url: `${BASE}/ui` });
  await sleep(3000);

  await evaluate(cdp, INSTALL_INTERCEPT);

  if (!(await clickByText(cdp, "Export", "button"))) {
    throw new Error("could not find the Export button on /ui");
  }
  await sleep(600);

  if (!(await clickByText(cdp, "PNG", '[role="menuitem"]'))) {
    throw new Error("could not find the PNG menu item");
  }

  const exported = await retry(async () => {
    const value = await evaluate(cdp, "window.__exported");
    if (!value) throw new Error("export not ready");
    return value;
  }, 40);

  const base64 = exported.href.split(",")[1];
  if (!base64) throw new Error("export produced no image data");
  const bytes = Buffer.from(base64, "base64");
  const file = join(outDir, exported.name);
  writeFileSync(file, bytes);

  // A PNG's IHDR carries its dimensions at a fixed offset.
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  console.log(`  ${file}`);
  console.log(`  ${width}x${height}, ${(bytes.length / 1024).toFixed(0)} KB`);

  if (bytes.length < 5000) {
    console.error("\nexport-check: the PNG looks suspiciously small — is the card rendering?");
    failed = true;
  }

  // The saved-card thumbnail comes off the same DOM node, downscaled, and is
  // dropped silently if it will not fit under the cap — so a visually heavier
  // card degrades the library to placeholders with no error anywhere.
  //
  // Run the real module against the real node. Vite serves source over HTTP in
  // dev, so it can be imported directly: no sign-in, no API call, and nothing
  // written to the deployed dev table or thumbnail bucket.
  const thumb = await evaluate(
    cdp,
    `(async () => {
      const mod = await import("/src/lib/cardThumbnail.ts");
      const node = document.querySelector(".card-view .bingo-card");
      if (!node) return { error: "no card node" };
      const dataUrl = await mod.generateCardThumbnail(node);
      if (!dataUrl) return { error: "generation returned null" };
      return {
        bytes: mod.estimateDataUrlBytes(dataUrl),
        cap: mod.MAX_THUMBNAIL_BYTES,
        href: dataUrl,
      };
    })()`,
  );

  if (thumb.error) {
    console.error(`export-check: thumbnail — ${thumb.error}`);
    failed = true;
  } else {
    const thumbFile = join(outDir, "thumbnail.png");
    writeFileSync(thumbFile, Buffer.from(thumb.href.split(",")[1], "base64"));
    const headroom = (100 * (1 - thumb.bytes / thumb.cap)).toFixed(0);
    console.log(`  ${thumbFile}`);
    console.log(
      `  thumbnail ${(thumb.bytes / 1024).toFixed(0)} KB of ` +
        `${(thumb.cap / 1024).toFixed(0)} KB cap (${headroom}% headroom)`,
    );
    if (thumb.bytes > thumb.cap) {
      console.error("\nexport-check: thumbnail exceeds the cap — saved cards would lose it.");
      failed = true;
    }
  }
} catch (error) {
  failed = true;
  console.error(`export-check failed: ${error.message}`);
  console.error(`is the dev server running on ${BASE}?`);
} finally {
  await dispose();
}

process.exit(failed ? 1 : 0);
