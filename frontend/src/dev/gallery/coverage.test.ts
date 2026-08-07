import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Keeps the gallery honest.
 *
 * A gallery that has drifted out of date is worse than no gallery, because it
 * produces confident, wrong screenshots. This test catches the case the other
 * two defences cannot: a component added without a gallery entry.
 *
 * The other two: the gallery imports the real components, so a *changed*
 * component updates itself; and an AGENTS.md rule covers new *states* of an
 * existing component, which nothing mechanical can detect.
 *
 * The registry is read as text rather than imported, because importing it would
 * pull React, MUI, and emoji-picker-react into a suite that has no DOM.
 */

const here = dirname(fileURLToPath(import.meta.url));
const registrySource = readFileSync(join(here, "registry.tsx"), "utf8");

/** Keys only — the loaders are never called, so no module is evaluated. */
const componentModules = import.meta.glob("../../components/*.tsx");

const componentFiles = Object.keys(componentModules)
  .map((path) => path.slice(path.lastIndexOf("/") + 1))
  // Co-located tests are not components.
  .filter((file) => !file.endsWith(".test.tsx"))
  .sort();

describe("gallery coverage", () => {
  it("finds the component library", () => {
    // Guards against the glob silently matching nothing after a move, which
    // would make every assertion below vacuously pass.
    expect(componentFiles.length).toBeGreaterThan(0);
  });

  it.each(componentFiles)("has a gallery entry for %s", (file) => {
    const source = `src/components/${file}`;
    expect(
      registrySource,
      `${file} has no gallery entry. Add one to src/dev/gallery/registry.tsx ` +
        `with source: "${source}" so the component stays visually reviewable.`,
    ).toContain(`source: "${source}"`);
  });
});
