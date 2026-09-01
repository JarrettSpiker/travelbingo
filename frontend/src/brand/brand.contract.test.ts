import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_REGISTRY } from "./registry";
import { normalizeCategories, normalizeThemes } from "../lib/suggestions";
import { FONT_OPTIONS } from "../lib/fontScheme";

/**
 * Keeps the brand seam whole.
 *
 * Three distinct failures are covered here, none of which any other check sees:
 *
 * 1. A brand that exists but cannot be selected — a definition the build-time
 *    ternary in `index.ts` never names. It would typecheck, ship, and simply
 *    never appear.
 * 2. A brand id in the TypeScript union that `vite.config.ts` does not accept,
 *    or the reverse. The config runs in Node and cannot import the union, so
 *    the two lists are duplicated; this is what makes the duplication safe.
 * 3. Suggestion data that normalizes to nothing. `normalizeCategory` and
 *    `normalizeTheme` are deliberately defensive — malformed JSON yields an
 *    empty list rather than an exception — so a brand can ship an empty
 *    suggestions dialog with everything else green.
 *
 * `index.ts` and `vite.config.ts` are read as *text*. Importing `index.ts`
 * would evaluate whichever brand the test runner's `VITE_BRAND` happens to
 * select and tell us nothing about the others; importing the Vite config would
 * pull the whole plugin graph into a suite with no DOM.
 */

const here = dirname(fileURLToPath(import.meta.url));

const selectorSource = readFileSync(join(here, "index.ts"), "utf8");
const viteConfigSource = readFileSync(join(here, "..", "..", "vite.config.ts"), "utf8");

const registryIds = Object.keys(BRAND_REGISTRY).sort();

/** Directories under `src/brand/` — the on-disk brands, whatever TS thinks. */
const brandDirs = readdirSync(here, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe("brand registry", () => {
  it("finds at least one brand", () => {
    expect(registryIds.length).toBeGreaterThan(0);
  });

  it("has an entry for every brand directory", () => {
    // `satisfies Record<BrandId, Brand>` in registry.ts already makes a missing
    // *id* a compile error. This catches the other direction: a brand whose
    // files exist but which was never added to the union or the registry, and
    // which is therefore unbuildable rather than merely unreachable.
    expect(registryIds).toEqual(brandDirs);
  });

  it("is reachable in its entirety from the build-time selection", () => {
    // Every registered brand must be named by `index.ts` — as the constant
    // while there is one brand, as an arm of the ternary once there are more.
    // A brand the selector never names cannot be built, no matter what
    // VITE_BRAND says.
    for (const id of registryIds) {
      const symbol = `${id}Brand`;
      expect(selectorSource, `src/brand/index.ts never selects ${symbol}`).toContain(symbol);
    }
  });

  it("agrees with the build's closed list of brand ids", () => {
    const declared = /const BRAND_IDS = \[([^\]]*)\]/.exec(viteConfigSource);
    expect(declared, "vite.config.ts no longer declares BRAND_IDS").not.toBeNull();
    const configIds = [...declared![1].matchAll(/'([^']+)'|"([^"]+)"/g)]
      .map(([, single, double]) => single ?? double)
      .sort();
    expect(configIds).toEqual(registryIds);
  });
});

describe.each(registryIds)("brand: %s", (id) => {
  const brand = BRAND_REGISTRY[id as keyof typeof BRAND_REGISTRY];

  it("declares an id matching its registry key", () => {
    expect(brand.id).toBe(id);
  });

  it("has a non-empty name and storage prefix", () => {
    expect(brand.name.trim()).not.toBe("");
    expect(brand.storagePrefix.trim()).not.toBe("");
  });

  it("offers only themes whose fonts a saved card will accept", () => {
    /*
      The failure this prevents: a user applies a suggested theme, fills in a
      card, hits Save, and gets a 400 from `validateFontScheme` — an error
      arriving at the last possible moment, about a font they never chose, from
      a list the app itself offered them.

      The allowlist is read from `FONT_OPTIONS` rather than from the backend's
      `ALLOWED_FONTS`, because this package cannot import across the package
      boundary. The two lists are already held byte-identical by
      `backend/src/lib/cardPayload.contract.test.ts`, which asserts exactly
      that — so checking against this side is checking against both.
    */
    const allowed = new Set(FONT_OPTIONS.map((option) => option.value));
    for (const theme of normalizeThemes(brand.suggestions.themes)) {
      for (const [role, font] of Object.entries(theme.fontScheme)) {
        expect(allowed, `${id} theme "${theme.id}" uses an unaccepted ${role}: ${font}`).toContain(
          font,
        );
      }
    }
  });

  it("supplies suggestion content that survives normalization", () => {
    // Not "the JSON parses" — the dialog shows what the normalizer returns, and
    // a shape change that drops every entry is invisible until someone opens it.
    expect(normalizeCategories(brand.suggestions.cells).length).toBeGreaterThan(0);
    expect(normalizeThemes(brand.suggestions.themes).length).toBeGreaterThan(0);
  });
});

describe("copy is complete in every brand", () => {
  /**
   * Every leaf path in a copy object, e.g. `trips.deleteWarning`. Functions are
   * leaves too — `winConditionUnreachable` is one.
   */
  function leafPaths(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      leafPaths(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  const firstId = registryIds[0];
  const expected = leafPaths(
    BRAND_REGISTRY[firstId as keyof typeof BRAND_REGISTRY].copy,
  ).sort();

  it("declares a non-trivial set of keys", () => {
    expect(expected.length).toBeGreaterThan(5);
  });

  it.each(registryIds)("%s has exactly the shared key set", (id) => {
    // `BrandCopy` already makes a missing key a compile error and an extra key
    // an excess-property error, so this is belt-and-braces — it earns its place
    // by covering anything the interface leaves optional, and by naming the
    // offending path rather than pointing at a type.
    const brand = BRAND_REGISTRY[id as keyof typeof BRAND_REGISTRY];
    expect(leafPaths(brand.copy).sort(), `${id} disagrees with ${firstId}`).toEqual(expected);
  });

  it.each(registryIds)("%s leaves no copy value empty", (id) => {
    const brand = BRAND_REGISTRY[id as keyof typeof BRAND_REGISTRY];
    const walk = (value: unknown, path: string): void => {
      if (typeof value === "string") {
        expect(value.trim(), `${id}.${path} is empty`).not.toBe("");
      } else if (typeof value === "function") {
        // Exercise both branches of anything that pluralizes.
        for (const count of [1, 2]) {
          expect(String(value(count)).trim(), `${id}.${path}(${count}) is empty`).not.toBe("");
        }
      } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) walk(child, `${path}.${key}`);
      }
    };
    walk(brand.copy, "copy");
  });
});

describe("brands are distinguishable", () => {
  it("uses a unique storage prefix per brand", () => {
    const prefixes = registryIds.map(
      (id) => BRAND_REGISTRY[id as keyof typeof BRAND_REGISTRY].storagePrefix,
    );
    expect(new Set(prefixes).size).toBe(prefixes.length);
  });

  it("uses a unique name per brand", () => {
    // `check-bundle.mjs` proves one brand shipped by looking for the *other*
    // brands' names in `dist/`. Two brands sharing a name would make that check
    // pass vacuously.
    const names = registryIds.map((id) => BRAND_REGISTRY[id as keyof typeof BRAND_REGISTRY].name);
    expect(new Set(names).size).toBe(names.length);
  });
});
