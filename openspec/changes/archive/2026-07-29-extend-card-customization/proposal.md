## Why

The shipped app grew several card-customization features during iteration — selectable fonts, an independent title color, and an optional free space — that go beyond the original specs. The code already implements and shares them (including in the URL), but the specs never captured them. This change brings the specifications in line with the current behavior so they remain a faithful source of intent.

## What Changes

- Adds a **font scheme**: the user can independently choose a title font and a cell font from a fixed set of options, applied live and to the printed card.
- Adds a **title color** as a fourth, independently customizable (and randomizable) color, distinct from the cell text color.
- Makes the **center free space optional** (default on). When turned off, the grid uses all 25 cells for entries/blanks (25-entry capacity) and there is no special center cell.
- Extends **URL sharing** to encode the free-space toggle, the title color, and the font scheme, and introduces a schema version with backward-compatible decoding of older URLs.

These are already implemented; this change documents the shipped behavior.

## Capabilities

### New Capabilities
- `card-font-scheme`: Choosing the title and cell fonts for the card from a fixed set of options, applied to the on-screen and printed card.

### Modified Capabilities
- `card-color-scheme`: Color customization/randomization/defaults expand from three colors (background, cell, text) to four by adding an independent title color.
- `card-generation`: The center free space becomes optional (default on); grid capacity is 24 entries with a free space or 25 without. Mandatory-entry and randomization behavior reflows to "capacity" rather than a hardcoded 24.
- `card-entry-input`: Adds a control to include or exclude the center free space; the free-space text field is disabled when the free space is turned off.
- `card-url-sharing`: Exported URLs encode the free-space toggle, the title color, and the font scheme, and decoding tolerates older payloads via a versioned schema with sensible defaults.

## Impact

- **Frontend logic** (`src/lib/`): `fontScheme.ts` (new module), `colorScheme.ts` (adds `titleColor`), `bingo.ts` (adds `hasFreeSpace` option + 24/25 capacity), `cardUrl.ts` (schema v3 with `hf`, four color elements, and `ft`).
- **Frontend UI** (`src/components/`, `App.tsx`): new `FontSchemeForm`; updated `ColorSchemeForm`, `CardDetailsForm`, `CardGrid`, and `CardView`.
- No backend, persistence, or infrastructure changes; client-side only.
- All affected logic already ships today — no code changes are required by this change.
