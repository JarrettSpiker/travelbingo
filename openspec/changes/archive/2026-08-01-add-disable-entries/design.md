## Context

The app is client-side-only and stateless; a card is built from an in-memory entry pool (`src/lib/bingo.ts`). Each entry is currently `{ text, mandatory }`. The only way to keep an entry off a card today is to delete it. This change adds an `enabled` flag so an entry can be set aside without being lost, and threads it through selection and the entry-list UI. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Let users temporarily exclude an entry from the card (live and randomized) without deleting it.
- Keep disabled entries as real pool members for duplicate detection, so they can be toggled back on intact.
- Make the existing filled/extra counters and mandatory-overflow warning reflect only entries that can actually appear (enabled ones).

**Non-Goals:**
- No persistence of disabled state — the URL still encodes only the displayed card, not the full pool (unchanged).
- No bulk enable/disable actions (e.g. "disable all") in this iteration.
- No reordering, tagging, or grouping of entries.
- No change to the 5x5 grid, capacity rules, or client-side-only constraint.

## Decisions

- **Add an `enabled` flag to `BingoEntry`, defaulting to true.** The shape becomes `{ text, mandatory, enabled }`. Existing call sites that build entries without `enabled` rely on the default; `getUniqueEntries` SHALL preserve `enabled` (defaulting a missing value to true) alongside `mandatory`, so dedup keeps producing stable objects. Rationale: a boolean mirrors the existing `mandatory` flag and stays out of the URL's concern.
- **Dedup over all entries; filter disabled only at selection.** Duplicate detection (`getUniqueEntries` / the UI's duplicate check) SHALL consider disabled entries too — a disabled "Foo" still blocks adding another "Foo". Selection (`selectEntryTexts`) SHALL then exclude disabled entries before the capacity check and the mandatory/optional split. Because both `buildCard` and `randomizeCard` go through `selectEntryTexts`, this single filter point covers the live and randomized cards. Rationale: keeps one source of truth for "what's eligible" and avoids scattering disabled checks across the two builders.
- **Counters and the mandatory warning use enabled counts.** The entry-list "X / Y cells filled" and "extra" SHALL use the unique enabled-entry count; the mandatory-overflow warning SHALL fire on the enabled-mandatory count vs. capacity. Rationale: the UI should describe what can actually appear on the card, not entries the user has intentionally shelved.
- **Disabled wins over mandatory.** A disabled entry marked mandatory is not guaranteed a slot and never appears. The mandatory guarantee applies only to enabled mandatory entries. Rationale: disabling is an explicit user override of "appear on the card"; honoring mandatory over it would contradict the disable action.
- **UI: a per-row "Active" switch with strikethrough + dimmed styling for disabled rows.** Each entry row gets an MUI `Switch` (label "Active"). A disabled row renders its text struck-through at reduced opacity, and its Mandatory checkbox is disabled (greyed) while the entry is disabled, signalling that mandatory has no effect until the entry is re-enabled. Rationale: a switch reads as a clear on/off state; greying the mandatory control communicates the "disabled wins" rule at a glance.
- **URL sharing is unchanged.** Disabled entries are off-card and so are not part of the encoded slot arrangement; the disabled flag is not encoded. Reopening a URL imports its displayed entries as enabled (and non-mandatory), exactly as today. Rationale: expanding the URL to carry the full pool + disabled + mandatory flags would be a larger contract change and lengthen URLs further; the existing "URL encodes the card, not the pool" scope already covers this.

## Risks / Trade-offs

- [Disabled entries are silently lost when a card is shared via URL, since the flag and off-card entries are not encoded] → Accepted trade-off, identical in spirit to the existing limitation that the URL drops off-card entries and mandatory flags. A future "encode the full pool" change could address all three together.
- [Users may expect disabling to persist across sessions] → Mitigated by it being a session/pool-level concept (the app has no persistence by design); the entry list makes the disabled state visible so it isn't surprising.
- [Disabling entries one-by-one is tedious for large pools] → Accepted for this iteration; bulk actions are an explicit non-goal and can be revisited independently.

## Open Questions

- None material. (Bulk enable/disable and full-pool URL encoding were considered and deferred as non-goals.)
