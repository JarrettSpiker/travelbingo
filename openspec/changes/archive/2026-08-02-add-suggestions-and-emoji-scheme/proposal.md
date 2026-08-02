## Why

A blank bingo card and a raw color/font palette can be intimidating. Users starting from scratch have to dream up every entry and hand-tune colors and fonts before they get something usable. Curated starter content (categorized cell suggestions and ready-made themes) lets a new user go from empty to a complete, good-looking card in a few clicks, while a new emoji decoration gives the card more personality. All of this keeps the app client-side-only: the curated content ships as bundled data, and the emoji choice round-trips through the share URL like the other schemes.

## What Changes

- **Emoji edge/border scheme (new customization).** The user can choose **1 to 5 emojis** that are scattered around the **edge/border of the card** (around the grid's perimeter). A new scheme joins the existing color and font schemes: it has a default (no emojis), is edited via its own form, is rendered by the card on screen and in print, and is carried through the share URL. Emoji positions are deterministic for a given emoji set, so a card looks the same every time it is rendered or reopened from a URL.
- **Suggestions system (new).** A **"See suggestions"** control opens a dialog that offers:
  - **Suggested cells**, organized into **categories** (e.g. Travel, Sports). The user picks a category, then selects individual cells from it. Selected cells are **appended** to the entry pool; any that duplicate existing entries (case-insensitive, trimmed) are skipped and flagged.
  - **Suggested themes**, each a preset bundle of a **color scheme, a font scheme, and an emoji scheme**. Applying a theme sets all three schemes at once.
- **Bundled data.** The suggested cells and suggested themes are authored as **JSON files** under `src/data/` and imported at build time (no network calls). Malformed or empty data degrades gracefully rather than breaking the app.
- **URL round-trip.** The emoji scheme is added to the encoded card state. The URL schema version is bumped accordingly, and older URLs decode with the default (no emojis).

## Capabilities

### New Capabilities
- `card-emoji-scheme`: Let the user choose 1–5 emojis that decorate the card's edge/border, rendered deterministically, with a default of none, applying on screen and in print.
- `card-suggestions`: Offer curated starter content — categorized suggested cells (browse → select → append) and suggested theme presets (color + font + emoji) — loaded from bundled JSON.

### Modified Capabilities
- `card-url-sharing`: The encoded card state now includes the emoji scheme, so an exported URL reproduces the emoji decoration; older URLs without it decode to the default (no emojis).

## Impact

- **Frontend data** (`src/data/suggestedCells.json`, `src/data/suggestedThemes.json`): new bundled JSON files plus TS types describing their shape. Authored as app content for easy editing.
- **Frontend logic** (`src/lib/`): add `emojiScheme.ts` (type, default, emoji parse/clamp to 1–5, and a pure deterministic edge-position function) with a co-located test; extend `cardUrl.ts` to encode/decode the emoji scheme (schema version bump) with a test.
- **Frontend UI** (`src/components/`): add `EmojiSchemeForm` (choose 1–5 emojis) and a `SuggestionsDialog` (Themes tab + Cells category→select flow); extend `CardGrid` to render the edge/border emoji ring; thread the new scheme and suggestion handlers through `App.tsx`.
- **Dependencies**: none added — JSON imports are native to Vite/TypeScript.
- No backend, no persistence beyond the URL, and no infrastructure changes. The print layout gains the emoji decoration as part of normal card rendering; PNG export fidelity for emojis is noted as a future concern (PNG export itself is a separate, not-yet-implemented proposal).
