#!/usr/bin/env node
/**
 * Fails the build if the wrong code reached the production bundle.
 *
 * Two things are checked, and both are the same kind of check: a claim that
 * rests on the bundler dropping code, verified against the artifact rather than
 * assumed from the source.
 *
 * 1. **Dev-only code.** The component gallery is excluded by an
 *    `import.meta.env.DEV` guard around a dynamic import: Vite replaces the
 *    guard with `false`, the bundler drops the dead branch, and the chunk is
 *    never emitted. That is three inferences deep, and a refactor could quietly
 *    break any of them — a plain `if (DEV)` around a static import, for
 *    instance, keeps the code in the bundle.
 *
 * 2. **The other brands.** `src/brand/index.ts` selects one brand with a
 *    ternary against a compile-time literal, so the unselected brands' modules
 *    are dropped. Rewriting that as a map lookup, or importing `registry.ts`
 *    from application code, silently ships every brand — with no error, and
 *    with the wrong site's name sitting in a bucket it does not belong in.
 *
 * Runs as part of `npm run build`, which means CI enforces both on every deploy.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";
const BRAND_DIR = "src/brand";

/** Must stay in step with GALLERY_SENTINEL in src/dev/GalleryPage.tsx. */
const FORBIDDEN = [
  { needle: ["__TRAVELBINGO", "_DEV_GALLERY__"].join(""), what: "the component gallery" },
];

if (!existsSync(DIST)) {
  console.error(`check-bundle: ${DIST} not found — run this after \`vite build\`.`);
  process.exit(1);
}

/*
  The selected brand, from the same variable the build read. `vite.config.ts`
  has already refused to build without a valid one, so an unset value here means
  this script was run outside `npm run build` — refuse rather than skip the
  brand check silently.
*/
const selectedBrand = process.env.VITE_BRAND;
if (!selectedBrand) {
  console.error(
    "check-bundle: VITE_BRAND is not set. Run this via `npm run build`, which\n" +
      "passes through the same value `vite build` was given.",
  );
  process.exit(1);
}

/**
 * Each brand's identifying string, read from its own definition rather than
 * duplicated here — the name in the bundle is exactly the name in the source.
 */
function brandNames() {
  const names = new Map();
  for (const entry of readdirSync(BRAND_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const source = readFileSync(join(BRAND_DIR, entry.name, "index.ts"), "utf8");
    const match = /\bname:\s*"([^"]+)"/.exec(source);
    if (!match) {
      console.error(`check-bundle: cannot read a name out of ${BRAND_DIR}/${entry.name}/index.ts`);
      process.exit(1);
    }
    names.set(entry.name, match[1]);
  }
  return names;
}

const names = brandNames();
if (!names.has(selectedBrand)) {
  console.error(
    `check-bundle: VITE_BRAND="${selectedBrand}" has no definition in ${BRAND_DIR}/.`,
  );
  process.exit(1);
}

const bundles = readdirSync(DIST).filter((f) => f.endsWith(".js"));
if (bundles.length === 0) {
  console.error(`check-bundle: no .js files in ${DIST}; refusing to pass vacuously.`);
  process.exit(1);
}

const found = [];
let selectedNameSeen = false;

for (const file of bundles) {
  const source = readFileSync(join(DIST, file), "utf8");
  for (const { needle, what } of FORBIDDEN) {
    if (source.includes(needle)) found.push({ file, what });
  }
  for (const [id, name] of names) {
    if (!source.includes(name)) continue;
    if (id === selectedBrand) selectedNameSeen = true;
    else found.push({ file, what: `the ${id} brand ("${name}")` });
  }
}

/*
  The positive half. Without it every assertion above passes on a bundle that
  contains no brand at all — which is what a broken selector, an over-eager
  minifier, or a renamed field would actually produce.
*/
if (!selectedNameSeen) {
  console.error(
    `check-bundle: the selected brand's name ("${names.get(selectedBrand)}") does not\n` +
      `appear anywhere in ${DIST}. Either the brand module was dropped entirely or\n` +
      "the wrong brand was built.",
  );
  process.exit(1);
}

/*
  The delivered document, not just the bundle.

  `index.html`'s `<head>` is written by the `brandHtml` plugin in
  vite.config.ts, from the same `meta.json` the app imports. Nothing else checks
  that the plugin ran: a regex in it that stops matching — because someone
  reformatted `index.html` — fails silently and ships a page whose title,
  description, and favicon are the placeholder ones. The bundle would still be
  correct, so every other check here would pass.
*/
const indexHtmlPath = "dist/index.html";
if (!existsSync(indexHtmlPath)) {
  console.error(`check-bundle: ${indexHtmlPath} not found.`);
  process.exit(1);
}

const html = readFileSync(indexHtmlPath, "utf8");
const meta = JSON.parse(readFileSync(join(BRAND_DIR, selectedBrand, "meta.json"), "utf8"));

const htmlProblems = [];
const title = /<title>([^<]*)<\/title>/.exec(html);
if (!title) htmlProblems.push("has no <title>");
else if (title[1] !== meta.title) {
  htmlProblems.push(`title is "${title[1]}", expected "${meta.title}"`);
}

const icon = /<link rel="icon"[^>]*href="([^"]*)"/.exec(html);
if (!icon) htmlProblems.push("has no icon link");
else if (icon[1] !== meta.faviconPath) {
  htmlProblems.push(`icon is "${icon[1]}", expected "${meta.faviconPath}"`);
}

if (!html.includes(`content="${meta.description}"`)) {
  htmlProblems.push("does not carry the brand's description");
}

if (htmlProblems.length > 0) {
  for (const problem of htmlProblems) {
    console.error(`check-bundle: ${indexHtmlPath} ${problem}`);
  }
  console.error(
    "\nThe brandHtml plugin in vite.config.ts did not rewrite the document head.\n" +
      "Check that its regexes still match the markup in index.html.",
  );
  process.exit(1);
}

if (found.length > 0) {
  for (const { file, what } of found) {
    console.error(`check-bundle: ${what} leaked into dist/assets/${file}`);
  }
  console.error(
    "\nSomething is no longer being eliminated. For the gallery, check that the\n" +
      "import is dynamic (`lazy(() => import(...))`) and guarded by\n" +
      "`import.meta.env.DEV`. For a brand, check that `src/brand/index.ts` still\n" +
      "selects with a ternary and that nothing outside a test imports\n" +
      "`src/brand/registry.ts`.",
  );
  process.exit(1);
}

console.log(
  `check-bundle: ${bundles.length} bundle(s) + index.html clean — ` +
    `brand "${selectedBrand}" only, no dev-only code shipped.`,
);
