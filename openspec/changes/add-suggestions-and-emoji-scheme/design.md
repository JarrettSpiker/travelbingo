## Context

The app is client-side-only and stateless. A card is rendered by `CardGrid.tsx` from a `BingoCard`, and its appearance is driven by two existing schemes held as App state: a `ColorScheme` and a `FontScheme` (`src/lib/colorScheme.ts`, `src/lib/fontScheme.ts`), each a plain interface with a default and co-located tests. The exact card state — including both schemes — is encoded into a share URL by `src/lib/cardUrl.ts` using a versioned, base64url JSON payload (currently schema `v3`); the `card-url-sharing` capability requires older payloads to decode forward-compatibly with defaults. Vite is configured minimally (`@vite/plugin-react` only); JSON imports are native, while YAML would need a plugin. There is no suggestions/picker UI today: entries are typed by hand in `EntryInput.tsx`, and schemes are tuned by hand in `ColorSchemeForm.tsx` / `FontSchemeForm.tsx`. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Add a third scheme — an **emoji scheme** (1–5 emojis) — that follows the existing scheme pattern: a plain type + default + co-located test, edited via its own form, rendered by the card, and URL-encoded.
- Render the chosen emojis as a **deterministic edge/border ring** around the grid, stable across re-renders and URL round-trips.
- Provide curated starter content (categorized cells + theme presets) from **bundled JSON**, applied via a suggestions dialog, appending cells to the pool with duplicate-skipping.
- Keep everything client-side and add **no new dependencies**.

**Non-Goals:**
- No emoji background scatter (the decoration is an edge/border ring, not a full-card watermark).
- No "re-roll"/re-scatter button; placement is deterministic for a given emoji set.
- No per-category editing, search, or user-authored categories; the data files are the only source.
- No network loading or runtime fetching of suggestion/theme data.
- No change to the 5×5 grid, capacity, or selection logic. PNG export fidelity for emojis is a future concern tied to the separate, not-yet-implemented PNG-export proposal.

## Decisions

- **Model the emoji scheme like the existing schemes.** Add `EmojiScheme = { emojis: string[] }` with `DEFAULT_EMOJI_SCHEME = { emojis: [] }` in `src/lib/emojiScheme.ts`, mirroring how `ColorScheme`/`FontScheme` are structured (interface + default + test). App holds it as state alongside the other two schemes and passes it to `CardGrid`. Rationale: consistency and a single mental model for "things that style the card."
- **Parse/clamp emoji input to 1–5 in a pure helper.** A text field accepts typed/pasted emojis; a pure `parseEmojis(input): string[]` splits the string into emoji grapheme clusters (accounting for ZWJ sequences and variation selectors), de-dupes, and keeps at most the first 5. This lives in `src/lib/` and is unit-tested; the form just calls it. Rationale: keeps grapheme parsing testable and out of the component.
- **Deterministic edge/border placement via a pure, seeded function.** A pure `computeEdgeEmojiPositions(emojis: string[], count: number): { x: number; y: number; emoji: string; rotation: number }[]` returns percentage coordinates distributed around the card's rectangular perimeter, with a deterministic seed derived from the emoji set (e.g., a stable hash of the joined emojis). The chosen emojis cycle through the `count` positions. Rationale: the same emoji set always yields the same ring, which is required for stable re-rendering and exact URL restoration without encoding positions. Position coordinates are percentages so the ring lays out responsively across card sizes and renders identically on screen, in print, and in a future PNG.
- **Render the ring in `CardGrid` as absolutely-positioned emoji spans** in the card's padding/border area (a relatively-positioned `.bingo-card` ancestor), placed by the percentage coordinates from the pure function, behind the grid content (lower stacking order). Rationale: reuses the existing card DOM as the single source of layout; the ring reads as a border decoration around the grid. Print fidelity is inherited because the same DOM/CSS is printed (the existing print path already uses `print-color-adjust: exact`).
- **Bump the URL schema `v3 → v4` and add an emoji field.** Add `e: string[]` (the chosen emojis) to `EncodedPayload`; encode it in `encodeCardToUrl`; decode it in `decodeCardFromUrl` with `emojis: payload.e ?? []` so older `v3` payloads (no `e`) default to no emojis. Keep the existing validation/defaulting style. Rationale: minimal, backward-compatible extension that satisfies the round-trip requirement; emojis are UTF-8 strings handled cleanly by the existing base64url JSON codec.
- **Bundled JSON for suggestion/theme data, imported as modules.** Add `src/data/suggestedCells.json` (`{ categories: [{ id, label, cells: string[] }] }`) and `src/data/suggestedThemes.json` (`{ themes: [{ id, label, colorScheme, fontScheme, emojiScheme }] }`), imported via static ESM imports so Vite bundles them at build time. TS types for the shapes live in `src/lib/` (e.g., a `suggestions.ts` or within a data types module). Rationale: native Vite/TS JSON imports, zero dependencies, and the files stay hand-editable — matching the chosen format decision and the client-side-only constraint.
- **Suggestions UI: one MUI `Dialog` with two sections — Themes and Cells.** A "See suggestions" control opens the dialog. The **Cells** section shows category choices first, then the selected category's cells as toggleable chips; a confirm action appends selected cells to the pool. The **Themes** section shows theme presets; applying one sets color + font + emoji schemes together. Rationale: one entry point is less cluttered than two; a dialog is the idiomatic MUI pattern for focused, dismissible flows; the category→cells flow matches the requested interaction.
- **Append suggested cells with duplicate-skipping, computed purely.** The "add selected cells" handler appends the selected strings that do not duplicate existing entries (case-insensitive, trimmed, reusing the existing normalization rule), and reports the skipped ones. The dedup decision can be a small pure helper so it is testable. New entries are added as enabled, non-mandatory (matching `add-disable-entries` defaults). Rationale: non-destructive; reuses the existing duplicate rule so behavior is consistent with manual entry.
- **Graceful degradation for suggestion data.** Treat the imported JSON defensively: tolerate missing `categories`/`themes` arrays and malformed entries by filtering them out, so empty/broken data yields an empty (not broken) suggestions dialog. Rationale: mirrors the robustness philosophy already required by `card-url-sharing`; bundled data should never hard-crash the app.

## Risks / Trade-offs

- [Emoji glyphs depend on the platform's emoji font] → On screen and via the browser print path this is reliable across major platforms. PNG export (separate, unbuilt proposal) renders via SVG `foreignObject`, where emoji-font availability can vary; noted as a future concern, not addressed here. Mitigated for now by scoping the spec to screen and print.
- [Deterministic placement means two cards with the same emojis share a ring] → Accepted; predictability and exact URL restoration matter more than per-card uniqueness, and the user did not ask to re-roll.
- [Edge ring layout must stay sensible across card sizes (screen vs print vs the card's `max-width: 420px`)] → Mitigated by using percentage-based perimeter coordinates from the pure function, so the ring scales with the card.
- [The ring could visually crowd very small cards or long titles] → Mitigated by placing emojis only in the border/padding area outside the grid and keeping counts modest; the default (no emojis) avoids the issue entirely.
- [Hand-authored JSON is the sole source of content quality] → Accepted; the data files are deliberately separated from logic for easy editing, and a small starter set is provided rather than aiming for exhaustive coverage.
- [Schema bump to `v4` slightly lengthens URLs by the emoji bytes] → Accepted; emojis are a few bytes each and at most 5 are encoded.

## Migration Plan

None for data or infrastructure. The URL schema moves `v3 → v4` but decoding remains backward-compatible: existing `v3` links open exactly as before and simply default to no emojis, consistent with the established forward-compat decode behavior. Rolling back means reverting the code; no stored data exists.

## Open Questions

- None material. (Background-vs-edge was resolved in favor of an edge/border ring; append-vs-replace in favor of append; and JSON-vs-YAML in favor of JSON. Emoji re-roll and per-category search were considered and deferred as non-goals.)
