## 1. Emoji scheme logic (src/lib)

- [x] 1.1 Add `src/lib/emojiScheme.ts`: an `EmojiScheme` interface (`{ emojis: string[] }`), `DEFAULT_EMOJI_SCHEME` (empty), a pure `parseEmojis(input)` that splits to emoji grapheme clusters (handling ZWJ sequences and variation selectors), de-dupes, and keeps at most the first 5
- [x] 1.2 Add a pure `computeEdgeEmojiPositions(emojis, count)` to `src/lib/emojiScheme.ts` that returns deterministic percentage-based perimeter coordinates (seeded by a stable hash of the joined emojis), cycling the chosen emojis through the positions
- [x] 1.3 Add a co-located `emojiScheme.test.ts`: parse/clamp to 5, de-dupe, empty input → `[]`; deterministic positions are stable across calls, identical for the same set, and lie on the card perimeter

## 2. URL round-trip for the emoji scheme

- [x] 2.1 In `src/lib/cardUrl.ts`, add the emoji scheme to `CardUrlData` and the encoded payload (`e: string[]`), and bump `SCHEMA_VERSION` from 3 to 4
- [x] 2.2 Decode the emoji scheme in `decodeCardFromUrl`, defaulting `emojis` to `[]` when the field is absent (older `v3` payloads)
- [x] 2.3 Add/extend `cardUrl.test.ts` cases: emoji scheme round-trips exactly; an older `v3` payload without `e` decodes to no emojis; empty emoji set round-trips

## 3. Render the edge/border emoji ring

- [x] 3.1 In `src/components/CardGrid.tsx`, accept the `EmojiScheme` and render the chosen emojis as absolutely-positioned spans around the card's border/padding area using `computeEdgeEmojiPositions`, stacked behind the grid
- [x] 3.2 Ensure the ring renders in print (reuses existing `print-color-adjust` rules) and stays responsive (percentage coordinates) at the card's `max-width` and full print width

## 4. Emoji scheme UI and App wiring

- [x] 4.1 Add `src/components/EmojiSchemeForm.tsx`: a text field for entering emojis, using `parseEmojis` to normalize input, showing the parsed emoji set, with the form mirroring `ColorSchemeForm`/`FontSchemeForm` structure
- [x] 4.2 Thread `emojiScheme` state through `App.tsx`: initialize from the decoded URL, pass to `CardGrid`/`EmojiSchemeForm`, and include it in `handleExportUrl`

## 5. Suggestion data files and types

- [x] 5.1 Add `src/data/suggestedCells.json` (`{ categories: [{ id, label, cells: [] }] }`) and `src/data/suggestedThemes.json` (`{ themes: [{ id, label, colorScheme, fontScheme, emojiScheme }] }`) with a small starter set of categories and themes
- [x] 5.2 Add TS types for the data shapes in `src/lib/` (e.g., a `suggestions.ts`) and import the JSON statically so Vite bundles it; defensively tolerate missing/malformed arrays/entries

## 6. Suggestions dialog

- [x] 6.1 Add `src/components/SuggestionsDialog.tsx` (MUI `Dialog`) with two sections: **Themes** (preset cards that apply a theme's color + font + emoji schemes) and **Cells** (category selector → selectable cell chips)
- [x] 6.2 Cells "add" action: append the selected cells to the pool as enabled, non-mandatory entries, skipping case-insensitive/trimmed duplicates, and report which were skipped
- [x] 6.3 Add the "See suggestions" control in the app that opens the dialog, and wire the theme-apply and cells-add handlers through `App.tsx`

## 7. Tests and verification

- [x] 7.1 Add unit tests for the pure append-with-dedup helper (selected cells appended; duplicates skipped; result entries are enabled/non-mandatory)
- [x] 7.2 Run `npm run lint`, `npm test`, and `npm run build` from `frontend/`; confirm all pass
- [ ] 7.3 Manually verify: emoji ring renders and is stable across randomize; emoji scheme round-trips via Export URL; suggestions dialog applies a theme and appends cells (with duplicate skipping); empty/malformed data does not break the app
