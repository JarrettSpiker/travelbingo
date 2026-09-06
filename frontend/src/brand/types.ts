import type { LucideIcon } from "lucide-react";

/**
 * The closed set of brands.
 *
 * `BRAND_IDS` in `vite.config.ts` carries the same list — that file runs in
 * Node and cannot import this one, so the duplication is *checked* rather than
 * avoided: `brand.contract.test.ts` reads the config as text and asserts the
 * two agree. Adding a brand means editing both, and forgetting one is a red
 * test rather than a build that silently cannot select the new brand.
 */
export type BrandId = "travel" | "office";

/**
 * The raw, unvalidated suggestion data a brand ships.
 *
 * `unknown` on purpose: `src/lib/suggestions.ts` owns the normalizer, and
 * typing this as the normalized shape would assert a guarantee the JSON does
 * not carry. `brand.contract.test.ts` asserts every brand's data survives
 * normalization to at least one category and one theme, which is the check that
 * actually matters — malformed JSON otherwise degrades silently to an empty
 * suggestions dialog.
 */
export interface BrandSuggestions {
  readonly cells: unknown;
  readonly themes: unknown;
}

/**
 * The user-visible text that differs between brands.
 *
 * Not an i18n framework, and deliberately not one: there is a single locale, so
 * the problem is brand variance, not language. A plain interface buys what a
 * message catalogue would not — `tsc -b` enforces both directions, so a key in
 * the interface that a brand omits is a compile error and a key a brand invents
 * is an excess-property error. There is no runtime lookup, therefore no missing
 * key at runtime and no key-string typo, and jump-to-definition works.
 *
 * **The rule that keeps this from metastasizing: a string belongs here only
 * when the brands' values actually differ.** `Save`, `Cancel`, `PDF`, `PNG`,
 * `Add selected`, `Entries`, `Look & feel`, and `Card details` read the same in
 * every brand and stay inline where they are. The failure being avoided is
 * turning every component into an indirection with no payoff.
 *
 * The corollary is `noun` below. Most trip strings differ only in that one
 * word — "Delete this trip?" against "Delete this meeting?" is the same
 * sentence — so they are composed at the call site from the noun rather than
 * duplicated whole. A key earns its place here when the brands would want a
 * different *sentence*, not merely a different noun inside one.
 */
export interface BrandCopy {
  /**
   * The four forms of the brand's word for a shared, time-boxed group of
   * cards. Interpolated into sentences: `Delete this ${noun.trip}?`.
   *
   * Capitalized variants are **explicit keys, not a `capitalize()` helper**.
   * "all-hands" capitalizes to "All-hands", not "All-Hands", and that is not a
   * rule worth letting a helper guess at. Four fields cost nothing and are
   * always right.
   */
  readonly noun: {
    readonly trip: string;
    readonly trips: string;
    readonly Trip: string;
    readonly Trips: string;
  };

  readonly nav: {
    /** The header link. Its route stays `/trips` in every brand. */
    readonly trips: string;
  };

  /**
   * Sentences whose *structure* varies, not just the noun inside them. Each of
   * these would be phrased differently by a brand that is not about travel.
   */
  readonly trips: {
    /** Pitch shown to a signed-out visitor on the list page. */
    readonly signedOutPitch: string;
    /** Shown when the list loads and is empty. */
    readonly emptyState: string;
    /** Why the mode control is disabled after creation. Possessive — awkward to compose. */
    readonly modeHint: string;
    /**
     * Warning that cards already added cannot reach the chosen win condition.
     *
     * The one function here, because it is the one string that pluralizes. A
     * brand that pluralizes its noun differently owns that decision in its own
     * file rather than having a count spliced into it at the call site.
     */
    readonly winConditionUnreachable: (count: number) => string;
    /** What deleting takes with it. */
    readonly deleteWarning: string;
    /** What removing a member does and does not take with them. */
    readonly removeMemberWarning: string;
    /** Shown once the end date has passed. */
    readonly endedNotice: string;
    /** Access was lost between loads — removed, or deleted. */
    readonly noLongerAvailable: string;
    /** Not found, or the visitor was never a member. The two are deliberately not distinguished. */
    readonly notFoundOrNotMember: string;
    /** The reasons an invite token may not resolve, as a parenthetical. */
    readonly inviteInvalidReason: string;
  };

  readonly editor: {
    /** Example card title. The clearest single place the brand's subject shows. */
    readonly titlePlaceholder: string;
    /**
     * Example bingo entry, in the entry field's placeholder.
     *
     * The most-read example text in the app — it sits under the cursor on the
     * first screen a visitor sees, and it is where they learn what kind of
     * thing goes on a card.
     */
    readonly entryPlaceholder: string;
  };

  readonly share: {
    /** Heading for a shared card that was saved without a title. */
    readonly fallbackCardName: string;
  };

  readonly exportFile: {
    /** Filename for a PNG export of a card with no title. */
    readonly defaultPngName: string;
  };

  /**
   * The footer and the feedback dialog it opens.
   *
   * Everything here is chrome, so it varies by brand in register rather than in
   * meaning. The office brand in particular must stay deadpan: a feedback form
   * is exactly the surface where the satire collapses if the interface starts
   * being funny about itself.
   */
  readonly feedback: {
    /** The footer link, and the dialog's own title. */
    readonly linkLabel: string;
    /** One line under the dialog title saying what this is for. */
    readonly intro: string;
    /** Label for the message field. */
    readonly messageLabel: string;
    /** Placeholder for the message field — the brand's idea of a useful report. */
    readonly messagePlaceholder: string;
    /** Label for the optional contact field. Must read as optional. */
    readonly contactLabel: string;
    /**
     * What the address will be used for, stated before the person types one.
     * This is the consent, so it says what happens rather than reassuring.
     */
    readonly contactHint: string;
    /** The submit button. */
    readonly submitLabel: string;
    /** Shown after a successful submission. */
    readonly successMessage: string;
    /** Shown when the per-account cap is reached — not an error, a limit. */
    readonly capReachedMessage: string;
    /** Shown when the submission failed for any other reason. */
    readonly errorMessage: string;
    /**
     * Shown to a signed-out visitor in place of the form.
     *
     * Names Google explicitly. On the office brand the consent screen carries
     * the *travel* brand's name — a deliberate accepted trade recorded in
     * `add-office-brand` task 0.4 — and meeting that cold, having clicked
     * "send feedback", reads like a phishing page. Forewarning costs one clause.
     */
    readonly signedOutPrompt: string;
  };
}

/**
 * A brand's marketing surface — everything that goes in `<head>`.
 *
 * Lives in `brand/<id>/meta.json` rather than in this module's TypeScript,
 * because `vite.config.ts` must read the same data the app does and it runs in
 * Node: importing `brand/<id>/index.ts` from the config would drag
 * `lucide-react`, and therefore React, into config load. JSON has no import
 * graph, is `JSON.parse`d by the config, imported normally by the app, and
 * typed with `satisfies BrandMeta` — the same pattern the suggestion data uses.
 */
export interface BrandMeta {
  /** Must equal the `Brand.name` of the brand that owns it. */
  readonly name: string;
  /** The document title. Not just the name — this is a search result. */
  readonly title: string;
  /** The meta description and the OG/Twitter description. Under ~155 chars. */
  readonly description: string;
  /**
   * `theme-color`, one per presentation. These are the sRGB resolution of the
   * brand's `--background` in `theme.css`, and nothing can check that they
   * still match — moving the palette means recomputing them.
   */
  readonly themeColorLight: string;
  readonly themeColorDark: string;
  /**
   * The mark's two colours, as they appear in the favicon SVG.
   *
   * A favicon is a static asset: it never sees the app's stylesheet, so it
   * cannot read a custom property and its colours are duplicated by hand from
   * `--primary` / `--primary-foreground`. Declaring them here lets
   * `meta.contract.test.ts` assert the SVG still contains them, which converts
   * a comment asking for hand-syncing into a test. It cannot verify the hex is
   * the right resolution of the oklch — that needs a colour library — but it
   * catches the palette moving without the favicon following, which is the
   * failure that actually happens.
   */
  readonly markHex: string;
  readonly markFgHex: string;
  /** Absolute path, served from `public/`. */
  readonly faviconPath: string;
}

/**
 * Everything about a brand that a React component needs to *read*.
 *
 * The split, and there is exactly one rule: a value lives here if a component
 * reads it, and in `theme.css`/`motifs.css` if a stylesheet applies it. Nothing
 * appears in both. Colours, radii, shadows, and the motif utilities are CSS;
 * names, copy, icons, and content are here.
 *
 * `MarkIcon` as a component inside a data object is fine — `lucide-react` ships
 * per-icon ESM, so the unselected brand's icon is dropped with the rest of its
 * module.
 */
export interface Brand {
  readonly id: BrandId;
  /** The product name, as shown in the wordmark and the document title. */
  readonly name: string;
  /**
   * Namespace for this brand's `localStorage` keys.
   *
   * Not strictly required — the two brands are different origins, so their
   * storage is already isolated — but it removes a hardcoded product name from
   * three lines of otherwise brand-agnostic code.
   */
  readonly storagePrefix: string;
  /** The wordmark's mark. One of the five motif slots; see `motifs.css`. */
  readonly MarkIcon: LucideIcon;
  /**
   * The icon standing for a trip / meeting series, on the list tiles, the
   * details panel, the members panel, and the invite page.
   *
   * Separate from `MarkIcon` because it means a different thing: the mark is
   * the product, this is one object inside it. A brand whose noun is "meeting"
   * wants a calendar here and would look odd repeating its wordmark.
   */
  readonly TripIcon: LucideIcon;
  readonly copy: BrandCopy;
  readonly suggestions: BrandSuggestions;
  readonly meta: BrandMeta;
}
