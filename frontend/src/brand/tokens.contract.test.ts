import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The token-parity guard — the highest-value check in the brand seam.
 *
 * A token the app refers to but a brand does not declare renders as *nothing*:
 * no console warning, no build error, no test failure anywhere else. An
 * unstyled element in one brand's dark mode is exactly the kind of defect that
 * survives review, because nobody looks at every surface of every brand in both
 * presentations on every change.
 *
 * So the contract is checked as text, from the two files that state it:
 *
 * - `base.css`'s `@theme inline` block is the shared *declaration* of which
 *   tokens exist. Every `var(--x)` in it is a promise the app makes.
 * - each `brand/<id>/theme.css` is a brand's *fulfilment* of that promise, and
 *   must keep it in both `:root` and `[data-theme="dark"]`.
 *
 * Deriving the list from the bridge rather than hardcoding it is the point:
 * adding a line to `@theme inline` is what obliges every brand to supply the
 * value, so a new token cannot be half-added.
 *
 * What this cannot check is *values*. That a brand's `--stamp` is
 * distinguishable from its `--destructive` is a human review item, per brand —
 * see DESIGN.md.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, "..");

/** Comments can contain braces and would break every block regex below. */
function stripComments(css: string): string {
  return css.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

/** The body of the first top-level `<selector> { ... }` block, or null. */
function blockBody(css: string, selectorPattern: string): string | null {
  const match = new RegExp(`${selectorPattern}\\s*\\{([^{}]*)\\}`).exec(css);
  return match ? match[1] : null;
}

function declaredProperties(body: string): Set<string> {
  return new Set([...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(([, name]) => name));
}

const baseCss = stripComments(readFileSync(join(srcDir, "base.css"), "utf8"));
const indexCss = stripComments(readFileSync(join(srcDir, "index.css"), "utf8"));

const brandIds = readdirSync(join(srcDir, "brand"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const brandCss = brandIds.map((id) => ({
  id,
  theme: stripComments(readFileSync(join(srcDir, "brand", id, "theme.css"), "utf8")),
  motifs: stripComments(readFileSync(join(srcDir, "brand", id, "motifs.css"), "utf8")),
}));

/**
 * The motif slots realized in CSS. The other three slots are `--stamp` and
 * `--shadow-raised` — covered by the token check below, since they are in the
 * bridge — and `MarkIcon`, which the `Brand` type makes non-optional.
 *
 * A brand that wants a slot to render nothing states it (`mask-image: none`)
 * rather than omitting it, so that this check can tell "deliberately empty"
 * apart from "forgotten".
 */
const MOTIF_SLOTS = ["panel-edge", "bg-page-texture"];

describe("brand token parity", () => {
  it("finds at least one brand to check", () => {
    // Every assertion below is a loop over brands; with none they would all
    // pass vacuously and the whole file would be decoration.
    expect(brandIds.length).toBeGreaterThan(0);
  });

  const bridge = blockBody(baseCss, "@theme inline");
  const bridgeTokens = [
    ...new Set([...(bridge ?? "").matchAll(/var\((--[a-z0-9-]+)\)/g)].map(([, name]) => name)),
  ].sort();

  it("reads the token bridge out of base.css", () => {
    expect(bridge, "base.css no longer has an `@theme inline` block").not.toBeNull();
    // A regex that silently matched nothing would make every check below pass.
    expect(bridgeTokens.length).toBeGreaterThan(10);
  });

  for (const { id, theme } of brandCss) {
    const light = blockBody(theme, ":root");
    const dark = blockBody(theme, '\\[data-theme="dark"\\]');

    it(`${id}: declares both presentations`, () => {
      expect(light, `brand/${id}/theme.css has no :root block`).not.toBeNull();
      expect(dark, `brand/${id}/theme.css has no [data-theme="dark"] block`).not.toBeNull();
    });

    it(`${id}: defines every bridged token in both presentations`, () => {
      const inLight = declaredProperties(light ?? "");
      const inDark = declaredProperties(dark ?? "");
      for (const token of bridgeTokens) {
        expect(inLight, `brand/${id} is missing ${token} in :root`).toContain(token);
        expect(inDark, `brand/${id} is missing ${token} in [data-theme="dark"]`).toContain(token);
      }
    });

    it(`${id}: declares the same token set in both presentations`, () => {
      // The converse of the check above: a token a brand declares in dark only
      // is dead in light, and one declared in light only is a value the dark
      // palette silently inherits. Neither is ever intended.
      expect([...declaredProperties(dark ?? "")].sort()).toEqual(
        [...declaredProperties(light ?? "")].sort(),
      );
    });

    it(`${id}: sets a chrome typeface`, () => {
      // Not in the bridge — it is a literal, so it lives in the brand's own
      // `@theme` block — but every brand still owes one, even if the answer is
      // the system stack.
      expect(theme, `brand/${id}/theme.css does not set --font-display`).toMatch(
        /--font-display\s*:/,
      );
    });
  }

  for (const { id, motifs } of brandCss) {
    it(`${id}: fills every motif slot`, () => {
      for (const slot of MOTIF_SLOTS) {
        expect(motifs, `brand/${id}/motifs.css does not define @utility ${slot}`).toMatch(
          new RegExp(`@utility\\s+${slot}\\s*\\{`),
        );
      }
    });
  }
});

describe("the shared style layer owns no brand values", () => {
  /*
    The drift this exists to catch is `npx shadcn add`, which writes new `:root`
    tokens into `src/index.css`. Left there they would sit *after* the brand
    import — CSS requires `@import` to precede all other rules — and silently
    override whichever brand was selected, in one presentation only. The fix is
    always the same: move them into every brand's `theme.css`, in both
    presentations, and add the bridge line to `base.css`.
  */
  it("index.css contains nothing but imports", () => {
    const rules = indexCss.replaceAll(/@import\s+[^;]+;/g, "").trim();
    expect(rules, `src/index.css has rules of its own:\n${rules}`).toBe("");
  });

  for (const [name, css] of [
    ["index.css", indexCss],
    ["base.css", baseCss],
  ] as const) {
    it(`${name} declares no token block`, () => {
      expect(blockBody(css, ":root"), `${name} declares a :root block`).toBeNull();
      expect(
        blockBody(css, '\\[data-theme="dark"\\]'),
        `${name} declares a [data-theme="dark"] block`,
      ).toBeNull();
      // shadcn's own dark selector, in case a future `add` uses it.
      expect(blockBody(css, "\\.dark"), `${name} declares a .dark block`).toBeNull();
    });
  }
});
