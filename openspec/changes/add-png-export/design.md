## Context

The card is already rendered as styled DOM in `CardGrid.tsx` (a `.bingo-card` wrapper containing an optional title heading and a 5×5 CSS grid of cells), with color scheme, font scheme, and a per-cell `--cell-font-scale` driving fixed-size cells. `CardView.tsx` currently exposes export affordances as two separate buttons — "Export URL" (generates the share URL into a copyable text field) and "Print / Save as PDF" (waits for `document.fonts.ready`, then calls `window.print()`). The app is client-side-only with no persistence beyond the URL. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Let the user download the current card as a standalone PNG that visually matches what is shown on screen and in print (title, colors, fonts, fixed-size cells with scaled text).
- Consolidate the existing export buttons into a single "Export" control with a menu, so PNG joins URL and PDF as one cohesive affordance rather than adding a third standalone button.
- Generate the PNG entirely in the browser, reusing the already-styled card DOM as the single source of truth for appearance.

**Non-Goals:**
- No other image formats (JPEG, SVG), no resolution/size picker, and no copy-to-clipboard for the image in this iteration — only a file download.
- No change to the URL payload, print layout, or the card-generation logic.
- No modification to the `card-url-sharing` capability: its "export URL" requirement is phrased abstractly ("when the user triggers the export action") and remains satisfied when surfaced as a menu item.

## Decisions

- **Render via `html-to-image` (`toPng`) on the existing card DOM node.** Capture the `.bingo-card` node (title + grid) so the PNG reuses the exact on-screen styling — color scheme, font scheme, and the per-cell `--cell-font-scale` — rather than re-implementing layout in a second renderer. Rationale: one source of truth for appearance; avoids duplicating the cell-font-scaling logic. Alternatives considered: a hand-rolled `<canvas>` redraw (crisper, zero dependency, but duplicates layout/font-scaling and diverges from screen styling); `html2canvas` (more mature but larger bundle and known color/CSS quirks). `html-to-image` is small and good enough for this simple, self-contained DOM.
- **Add a new runtime dependency on `html-to-image`.** This is the only dependency change. It is browser-side and tree-shakeable; only `toPng` is imported. Rationale: trades a small bundle increase for not maintaining a parallel canvas renderer.
- **Consolidate into a single "Export" button + MUI `Menu`.** Replace the "Export URL" and "Print / Save as PDF" buttons with one "Export" button that opens an MUI `Menu` offering Export URL, PDF, and PNG. Selecting an item closes the menu and runs that option. Rationale: three standalone buttons no longer scale; a menu is the idiomatic MUI pattern and keeps the card toolbar compact. "Export URL" retains its existing text-field + clipboard flow; "PDF" retains `document.fonts.ready.then(() => window.print())`.
- **`CardGrid` forwards a ref to its root `.bingo-card` node.** `CardView` needs the live DOM node to pass to `toPng`. `CardGrid` currently owns that node and exposes no ref, so it is changed to forward a ref to its root `div`. Rationale: the card's root is the precise capture boundary (title + grid, no controls).
- **Await `document.fonts.ready` before rendering, mirroring the print path.** Web fonts (`@fontsource/*`) must be loaded or the PNG can render with fallback typefaces. The print button already uses this guard; the PNG handler reuses the same approach. Rationale: consistent, font-accurate output.
- **Render at `pixelRatio: 2` for crisp output.** `toPng` is called with `{ pixelRatio: 2 }` so the downloaded image is sharp on high-DPI displays and when printed/embedded. Rationale: a 1× capture of a ~420px card would look soft when reused.
- **Download via a programmatic `<a download>` click.** Convert the `toPng` data URL to a download by creating an anchor element, setting `download` and `href`, clicking it, and removing it. Rationale: the standard, dependency-free browser download mechanism.
- **Filename from a pure `src/lib/` helper, with a co-located test.** When a title is set, derive the filename from it (sanitized: trimmed, unsafe filename characters removed/replace, length-capped, lowercased/normalized as needed) and append `.png`; otherwise fall back to a default such as `bingo-card.png`. The helper is pure (string in → string out) so it lives in `src/lib/` and is unit-tested, keeping the DOM/browser-coupled render+download logic in the component layer. Rationale: matches the repo convention that data/pure logic stays in `src/lib/` and stays testable.
- **Failure handling mirrors the existing clipboard fallback.** If `toPng` rejects (e.g., a tainted/cross-origin rendering issue), surface a short message indicating the PNG could not be generated, rather than failing silently. Rationale: consistent with how "Export URL" handles clipboard failure with a visible fallback.
- **Leave `card-url-sharing` unmodified.** Surfacing "Export URL" inside the same menu does not change its normative behavior (generate a URL encoding the card state and make it available). The shared menu is described from the `card-print-export` side only. Rationale: keep the spec delta focused; avoid editing a capability whose requirements are still met as written.

## Risks / Trade-offs

- [New runtime dependency increases bundle size slightly] → Accepted; `html-to-image` is small and only `toPng` is imported.
- [`html-to-image` relies on SVG `foreignObject`, which can mishandle some CSS or fail to inline web fonts] → Mitigated by awaiting `document.fonts.ready` before capture and by capturing the already-styled node. The `--cell-font-scale` is set inline on each cell, so it round-trips into the image. If a font fails to inline, the output still degrades to a visible fallback rather than failing the export silently.
- [The captured image may differ subtly from the on-screen card (anti-aliasing, exact color profiles)] → Accepted; reusing the same DOM/CSS minimizes divergence and is adequate for the use case (chat/deck/social sharing).
- [Filename sanitization varies by OS/browser] → Mitigated by the pure helper stripping a conservative set of unsafe characters and capping length; the fallback name covers the no-title case.
- [Menu adds one click vs. the old single-purpose buttons] → Accepted in exchange for a scalable, uncluttered toolbar as export options grow.

## Migration Plan

None. This is a client-side-only feature with no data format, URL schema, or persistence change. There is nothing to roll back beyond reverting the code; existing shared URLs and print behavior continue to work unchanged.

## Open Questions

- None material. (Other image formats, a resolution picker, and copy-image-to-clipboard were considered and deferred as non-goals.)
