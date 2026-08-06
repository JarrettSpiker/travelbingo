#!/usr/bin/env node
/**
 * Fails the build if dev-only code reached the production bundle.
 *
 * The component gallery is excluded by an `import.meta.env.DEV` guard around a
 * dynamic import: Vite replaces the guard with `false`, Rollup drops the dead
 * branch, and the chunk is never emitted. That is three inferences deep, and a
 * refactor could quietly break any of them — a plain `if (DEV)` around a static
 * import, for instance, keeps the code in the bundle.
 *
 * So the exclusion is checked rather than assumed. Runs as part of `npm run
 * build`, which means CI enforces it on every deploy.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "dist/assets";

/** Must stay in step with GALLERY_SENTINEL in src/dev/GalleryPage.tsx. */
const FORBIDDEN = [
  { needle: ["__TRAVELBINGO", "_DEV_GALLERY__"].join(""), what: "the component gallery" },
];

if (!existsSync(DIST)) {
  console.error(`check-bundle: ${DIST} not found — run this after \`vite build\`.`);
  process.exit(1);
}

const bundles = readdirSync(DIST).filter((f) => f.endsWith(".js"));
if (bundles.length === 0) {
  console.error(`check-bundle: no .js files in ${DIST}; refusing to pass vacuously.`);
  process.exit(1);
}

const found = [];
for (const file of bundles) {
  const source = readFileSync(join(DIST, file), "utf8");
  for (const { needle, what } of FORBIDDEN) {
    if (source.includes(needle)) found.push({ file, what });
  }
}

if (found.length > 0) {
  for (const { file, what } of found) {
    console.error(`check-bundle: ${what} leaked into dist/assets/${file}`);
  }
  console.error(
    "\nThe dev-only guard is no longer removing this code. Check that the import\n" +
      "is dynamic (`lazy(() => import(...))`) and guarded by `import.meta.env.DEV`.",
  );
  process.exit(1);
}

console.log(`check-bundle: ${bundles.length} bundle(s) clean — no dev-only code shipped.`);
