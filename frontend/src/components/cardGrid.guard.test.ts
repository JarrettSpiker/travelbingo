import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the bingo card renderer against incidental restyling.
 *
 * `CardGrid.tsx` plus the `.bingo-*` rules in `App.css` are the only part of the
 * app whose visual output is *user data*: colours, fonts, and emojis all come
 * from the user's saved schemes as inline styles. That same DOM feeds four
 * consumers — the on-screen preview, `@media print` (PDF), `html-to-image`'s PNG
 * export, and `lib/cardThumbnail.ts`. Restyling it changes what users have
 * already saved and exported.
 *
 * There is no DOM in this test suite, so this guard reads both files as text.
 * It is crude on purpose: it cannot tell you the card still *looks* right, only
 * that nobody has wired it up to the app's theme.
 */

const here = dirname(fileURLToPath(import.meta.url));
const cardGridSource = readFileSync(join(here, "CardGrid.tsx"), "utf8");
const appCss = readFileSync(join(here, "..", "App.css"), "utf8");

/** Every class the card renderer is allowed to put on an element. */
const ALLOWED_CLASSES = new Set([
  "bingo-card",
  "bingo-card-titlebar",
  "bingo-card-title",
  "bingo-card-body",
  "bingo-edge-emoji",
  "bingo-grid",
  "bingo-cell",
  // One per BingoCellKind, built by interpolation below.
  "bingo-cell-free",
  "bingo-cell-blank",
  "bingo-cell-entry",
  // The marking layer. It is part of the frozen renderer, not an overlay: the
  // X has to be inside `.bingo-card` or it vanishes from the PNG and the PDF.
  "bingo-cell-playable",
  "bingo-mark",
  "bingo-mark-stroke",
]);

/**
 * Static prefixes the renderer may interpolate onto (`bingo-cell-${cell.kind}`).
 * Anything else interpolated into a className is drift we want to hear about.
 */
const ALLOWED_INTERPOLATION_PREFIXES = ["bingo-cell-"];

/** Marker standing in for a `${...}` expression inside a template literal. */
const INTERPOLATION = "\u0000";

function classNameValues(source: string): string[] {
  const matches = [...source.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)];
  return matches.map(([, quoted, templated]) => quoted ?? templated);
}

describe("card renderer guard", () => {
  it("uses only allowlisted bingo-* classes", () => {
    const values = classNameValues(cardGridSource);
    expect(values.length).toBeGreaterThan(0);

    for (const value of values) {
      const tokens = value.replaceAll(/\$\{[^}]*\}/g, INTERPOLATION).split(/\s+/).filter(Boolean);

      for (const token of tokens) {
        if (!token.includes(INTERPOLATION)) {
          expect(ALLOWED_CLASSES, `unexpected class "${token}" in CardGrid.tsx`).toContain(token);
          continue;
        }
        const prefix = token.slice(0, token.indexOf(INTERPOLATION));
        expect(
          ALLOWED_INTERPOLATION_PREFIXES,
          `unexpected interpolated class prefix "${prefix}" in CardGrid.tsx`,
        ).toContain(prefix);
      }
    }
  });

  it("names no bingo-* class anywhere in the file that is not allowlisted", () => {
    // The check above reads whole `className` values, so a class contributed by
    // an interpolation — `${playable ? " bingo-cell-playable" : ""}` — is
    // invisible to it: the interpolation collapses to a marker and only its
    // prefix is checked. This scans the source text instead, so any class the
    // renderer can emit has to be declared above however it gets there.
    const referenced = new Set(
      [...cardGridSource.matchAll(/\bbingo-[a-z0-9-]+/g)].map(([token]) => token),
    );
    for (const token of referenced) {
      // The literal text of `bingo-cell-${cell.kind}`, whose completions are
      // covered by the three bingo-cell-<kind> entries in the allowlist.
      if (token === "bingo-cell-") continue;
      expect(ALLOWED_CLASSES, `unexpected class "${token}" in CardGrid.tsx`).toContain(token);
    }
  });

  it("has no className form this guard cannot read", () => {
    // If someone switches to `className={cn(...)}` or a variable, the regex above
    // stops seeing it and the allowlist check silently passes on nothing. Keep the
    // two counts in step so that failure is loud instead.
    const declared = [...cardGridSource.matchAll(/className=/g)].length;
    expect(classNameValues(cardGridSource)).toHaveLength(declared);
  });

  it("keeps the card's own rules in App.css", () => {
    for (const selector of [
      ".bingo-card",
      ".bingo-grid",
      ".bingo-cell",
      ".bingo-cell-free",
      ".bingo-cell-blank",
      ".bingo-mark",
      ".bingo-mark-stroke",
      ".bingo-cell-playable",
    ]) {
      expect(appCss, `App.css no longer defines ${selector}`).toContain(selector);
    }
    expect(appCss, "App.css no longer has an @media print block").toMatch(/@media\s+print/);
  });

  it("keeps the marking layer printing in colour", () => {
    // Without `print-color-adjust: exact` a browser is free to drop the
    // stroke's fill, and a marked card prints as an unmarked one — a document
    // that is silently wrong rather than obviously broken. The same rule
    // already covers the cells; the marks have to be in it too.
    const printBlock = /@media\s+print\s*\{([\s\S]*)\}/.exec(appCss);
    expect(printBlock, "App.css no longer has an @media print block").not.toBeNull();

    const rules = [...printBlock![1].matchAll(/([^{}]+)\{([^}]*)\}/g)];
    const markRule = rules.find(([, selectors]) => selectors.includes(".bingo-mark-stroke"));
    expect(markRule, "@media print no longer styles .bingo-mark-stroke").toBeDefined();
    expect(markRule![2], ".bingo-mark-stroke must print in colour").toMatch(
      /print-color-adjust\s*:\s*exact/,
    );
  });

  it("renders only elements with no UA typography to lose", () => {
    // A UA-stylesheet rule loses to any author rule, so an element whose
    // typography comes from the UA default is one `h1,h2,h3 { font-size:
    // inherit }` away from silently changing — which is exactly what Tailwind's
    // preflight does. `div` and `span` have nothing to lose; anything else must
    // be added here deliberately, and pin its own type in App.css below.
    const allowedTags = new Set(["div", "span", "h3"]);
    const tags = new Set(
      [...cardGridSource.matchAll(/<([a-z][a-z0-9]*)[\s/>]/g)].map(([, tag]) => tag),
    );
    expect(tags.size).toBeGreaterThan(0);
    for (const tag of tags) {
      expect(allowedTags, `CardGrid.tsx renders <${tag}>, which may carry UA styles`).toContain(tag);
    }
  });

  it("pins the card title's own type rather than inheriting the UA's", () => {
    // The <h3> title rendered at the UA's 1.17em/bold for as long as nothing
    // else claimed those properties. Tailwind's preflight claimed them, and the
    // title silently dropped to 16px/400 — in the app, the PDF, the PNG, and
    // the saved thumbnail at once. That is a real defect, not just a change: a
    // title at body size and weight stops reading as a title.
    //
    // The general rule this stands for: `App.css` being unlayered protects the
    // card only where it actually declares a property. Whatever the card's
    // appearance depends on, declare it here. Removing MUI proved the point
    // twice more — its CssBaseline had been lending the card `letter-spacing`
    // and font smoothing — though those two were cosmetically neutral and were
    // deliberately not carried forward.
    // Comments first: a `}` inside one ends the `[^}]*` body early, and the
    // assertions below then pass against prose instead of declarations.
    const declarations = appCss.replaceAll(/\/\*[\s\S]*?\*\//g, "");
    const rule = /\.bingo-card-title\s*\{([^}]*)\}/.exec(declarations);
    expect(rule, "App.css no longer defines .bingo-card-title").not.toBeNull();
    expect(rule![1], ".bingo-card-title must declare its own font-size").toMatch(/font-size\s*:/);
    expect(rule![1], ".bingo-card-title must declare its own font-weight").toMatch(
      /font-weight\s*:/,
    );
  });

  it("forces the printed page out of dark mode", () => {
    // The printed card is a document with no dark mode. That used to hold by
    // accident, because the app's dark palette lived behind
    // `@media (prefers-color-scheme: dark)`, which never matches while printing.
    // Once the theme moved to a `data-theme` attribute — which applies in every
    // medium — a dark-mode visitor printed a near-black page: `color-scheme:
    // dark` darkens the canvas, and the canvas paints outside the cascade that
    // hides everything else.
    const printBlock = /@media\s+print\s*\{([\s\S]*)\}/.exec(appCss);
    expect(printBlock, "App.css no longer has an @media print block").not.toBeNull();
    expect(printBlock![1], "@media print must pin color-scheme back to light").toMatch(
      /color-scheme\s*:\s*light\s*!important/,
    );
  });

  it("keeps the brand out of the card", () => {
    // The card is a document made of user data. It does not get a brand any
    // more than it gets a dark mode: the same card saved under either brand
    // must print, export, and thumbnail identically, and a link minted under
    // one must render the same under the other.
    //
    // The realistic breach is small and reasonable-looking — someone reaching
    // for `brand.copy` to label an empty cell, or `brand.name` in a watermark.
    // One line here is what stands between that and a per-brand PDF.
    for (const [name, source] of [
      ["CardGrid.tsx", cardGridSource],
      ["App.css", appCss],
    ] as const) {
      expect(source, `${name} imports the brand module`).not.toContain("@/brand");
      expect(source, `${name} imports the brand module`).not.toContain("/brand");
      expect(source, `${name} reads brand data`).not.toContain("brand.");
    }
  });

  it("keeps app design tokens out of the card", () => {
    // `html-to-image` clones the node and serialises computed styles, so modern
    // colour syntaxes are the most likely source of a silent export regression.
    // The user's own hex values are fine; anything resolved from the app theme
    // is not, because the exported PNG must not depend on how the app is themed.
    for (const [name, source] of [
      ["CardGrid.tsx", cardGridSource],
      ["App.css", appCss],
    ] as const) {
      expect(source, `${name} references an app design token`).not.toContain("var(--color-");
      expect(source, `${name} uses oklch(), which html-to-image may not serialise`).not.toContain(
        "oklch(",
      );
    }
  });
});
