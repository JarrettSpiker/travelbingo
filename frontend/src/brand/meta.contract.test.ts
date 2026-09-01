import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BRAND_REGISTRY } from "./registry";

/**
 * Keeps each brand's marketing surface honest.
 *
 * The favicon check is the one that earns its place. A favicon is a static
 * asset — it never sees the app's stylesheet, so it cannot read a custom
 * property, and its two colours are copied from `--primary` and
 * `--primary-foreground` by hand. `public/favicon-travel.svg` used to carry a
 * comment asking whoever moved the palette to remember; this turns that comment
 * into a test.
 *
 * What it cannot do is verify the hex is the correct sRGB resolution of the
 * oklch token — that needs a colour library this project has no other use for.
 * What it does catch is the failure that actually happens: the palette moves,
 * the favicon does not follow, and the pinned tab quietly disagrees with the
 * page it opens.
 */

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "..", "public");

/** Google truncates around here; longer is not wrong, just wasted. */
const MAX_DESCRIPTION = 155;

const brands = Object.entries(BRAND_REGISTRY);

describe("brand metadata", () => {
  it("finds at least one brand", () => {
    expect(brands.length).toBeGreaterThan(0);
  });
});

describe.each(brands)("brand: %s", (id, brand) => {
  const meta = brand.meta;

  it("names the brand it belongs to", () => {
    // `meta.json` is read twice by different code — by the app through
    // `index.ts`, and by `vite.config.ts` as plain JSON for the `<head>` — so a
    // name that disagrees with the brand it sits next to would show up in the
    // document title and nowhere else.
    expect(meta.name).toBe(brand.name);
  });

  it("has a title and a description worth serving", () => {
    expect(meta.title.trim()).not.toBe("");
    expect(meta.description.trim()).not.toBe("");
    expect(
      meta.description.length,
      `${id}'s description is ${meta.description.length} chars; keep it under ${MAX_DESCRIPTION}`,
    ).toBeLessThanOrEqual(MAX_DESCRIPTION);
  });

  it("has a title that is more than the bare product name", () => {
    // The title is a search result and a shared-link headline, not a label.
    expect(meta.title).not.toBe(meta.name);
  });

  it("declares colours as six-digit sRGB hex", () => {
    // `theme-color` and an SVG `fill` are both painted outside the app's
    // stylesheet, so oklch — which the tokens use — is not an option here.
    for (const key of ["themeColorLight", "themeColorDark", "markHex", "markFgHex"] as const) {
      expect(meta[key], `${id}.${key}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("ships the favicon it points at", () => {
    expect(meta.faviconPath.startsWith("/"), `${id} favicon path must be absolute`).toBe(true);
    const file = join(publicDir, meta.faviconPath.replace(/^\//, ""));
    expect(existsSync(file), `${id} declares ${meta.faviconPath}, which is not in public/`).toBe(
      true,
    );
  });

  it("has a favicon carrying the mark colours it declares", () => {
    const svg = readFileSync(join(publicDir, meta.faviconPath.replace(/^\//, "")), "utf8");
    expect(svg, `${meta.faviconPath} no longer uses markHex ${meta.markHex}`).toContain(
      meta.markHex,
    );
    expect(svg, `${meta.faviconPath} no longer uses markFgHex ${meta.markFgHex}`).toContain(
      meta.markFgHex,
    );
  });
});

describe("brands do not share a marketing surface", () => {
  it("uses a distinct favicon per brand", () => {
    // Two brands pointing at one file is how a rebrand silently ships the old
    // mark: the favicon check above would pass for both.
    const paths = brands.map(([, brand]) => brand.meta.faviconPath);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("uses a distinct title per brand", () => {
    const titles = brands.map(([, brand]) => brand.meta.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
