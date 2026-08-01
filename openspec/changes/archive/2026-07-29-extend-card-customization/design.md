## Context

The app is client-side-only and stateless (see the archived `add-bingo-card-generator` change). Three customization features shipped during iteration without spec coverage: a font scheme, a title color, and an optional free space. This change documents that behavior; the code already implements it. The one externally-visible compatibility surface is the shared-URL format, where existing links must keep working.

## Goals / Non-Goals

**Goals:**
- Specify the font scheme, title color, and optional free space exactly as they behave today.
- Specify the URL format changes (including the new fields and schema versioning) so the share/export contract is accurate.
- Keep older exported URLs working without manual intervention.

**Non-Goals:**
- No new features beyond what already ships — this is a documentation catch-up, not a behavior change.
- No changes to card-building purity, the client-side-only constraint, or the 5x5 grid.
- No server-side persistence or font hosting.

## Decisions

- **Font scheme is a curated, fixed list of five options, applied independently to the title and to cells.** The options are: Default (`system-ui, sans-serif`), Serif (`Georgia, 'Times New Roman', serif`), Monospace (`'Courier New', Courier, monospace`), Rounded (`'Comic Sans MS', 'Comic Sans', cursive`), and Condensed (`'Arial Narrow', Arial, sans-serif`). Title and cell fonts default to the system option. Rationale: a fixed list uses widely-available font stacks so rendering is reliable with no font loading or hosting; offering it per-region (title vs cells) gives useful flexibility. Alternative considered: a free-text font input — rejected because arbitrary font names are unreliable across operating systems and printers.
- **Title color is a fourth, independent color.** It is customizable and randomizable alongside background, cell, and text colors, and it defaults to a dark grey (`#1a1a1a`). Rationale: the title often wants to contrast with or differ from the cell text, so coupling it to the text color would be limiting. Alternative considered: deriving the title color from the text color — rejected as too inflexible.
- **The free space is optional, on by default, via a single toggle.** Turning it off makes all 25 cells entry/blank slots (25-entry capacity) and disables the free-space text input; turning it back on restores the center free cell (24-entry capacity) and re-enables the text input. This resolves the "no free space" open question that the original design deferred. Rationale: default-on preserves the familiar bingo layout, while the toggle serves users who want 25 entries. Capacity is expressed as 24 (with free space) or 25 (without) wherever the spec previously hardcoded 24.
- **URL payload is schema version 3 with backward-compatible decoding.** The `card` query parameter base64url-encodes a JSON object: `{ v: 3, s: string[], t: string, hf: boolean, f: string, c: [background, cell, text, title], ft: [titleFont, cellFont] }`, where `s` uses the empty string for blank slots. Decoding tolerates older payloads by defaulting any missing field: title `""`, `hf` `true`, free-space text `""`, the fourth color (`titleColor`) to the default title color, and the font scheme to the system default. Rationale: existing v1/v2 links (three colors, no fonts, no free-space flag) must still reproduce a sane card.

## Risks / Trade-offs

- [A randomized title color can produce low contrast against the background, harming title legibility] → Accepted trade-off, identical to the baseline's random-color risk; the user can re-randomize or manually adjust.
- [Older URLs silently gain default values for new fields (e.g. the system font, default title color, free space on)] → Accepted; the result is a sensible, legible card rather than an error.
- [The curated font list is opinionated and excludes fonts some users may want] → Accepted for now; a custom-font option could be revisited later without changing this contract.
- [Expressing capacity as "24 or 25" in the specs is slightly more complex than a hardcoded 24] → Accepted as the cost of an optional free space; the per-card capacity is deterministic from the toggle state.

## Migration Plan

No code or data migration is required — the behavior already ships. For shared URLs, the backward-compatible decoder is the migration: v1/v2 links decode with defaults for the new fields. To roll back a spec-only change like this, revert the spec deltas; the running app is unaffected.
