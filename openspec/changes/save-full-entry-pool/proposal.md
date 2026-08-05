## Why

Today a saved card stores only the 24/25 grid `slots` — the entries that
happened to be displayed. If the entry pool had more entries than the grid's
capacity (24 with a free space, 25 without), every entry that did not make it
onto the rendered card is silently dropped when the card is saved, and the
mandatory/enabled flags are lost for every entry on reopen (the load path
rebuilds the pool from slots with `mandatory: false`). A user who built a pool
of 40 road-trip entries, saved the card, and reopened it finds 16 of their
entries gone and their mandatory picks reset. The card generator already
supports pools larger than the grid (see `card-generation`); saving should not
be a destructive downgrade of that.

## What Changes

- The saved-card payload gains an **`entries`** field carrying the **full
  entry pool** at save time: every entry's text plus its `mandatory` and
  `enabled` flags, including entries beyond the grid's capacity and including
  disabled entries. The existing **`slots`** field is retained unchanged so the
  rendered grid stays pixel-identical (exact positions, including blanks).
- On open, the editor is reconstructed from `entries` (full pool, flags intact)
  while the grid layout is still reconstructed from `slots` — so the entry list
  shows *every* entry the user had, and the card still looks exactly as it did.
- Legacy saved cards (saved before this change) have no `entries`; opening them
  falls back to today's behavior (pool derived from slots, no flags), so nothing
  breaks. No backfill — the backend cannot recover entries it never received.
- All writes from the editor now carry the full pool; the backend validates it
  like any other untrusted payload (reject rather than default).
- Because share snapshots reuse the same payload, a shared card opened in the
  editor (or saved as a copy) will, going forward, also carry the full pool — a
  strict improvement that needs no separate work.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `card-library`: The "save the current card" requirement is amended so saving
  captures the full entry pool (text, mandatory, enabled) alongside the grid
  arrangement, not only the entries that happened to fit on the grid. A new
  requirement covers the inverse — opening a saved card restores that full
  entry pool, including entries that exceeded the grid's capacity, with flags
  intact, and degrades gracefully for legacy cards that predate the field.

## Impact

- **Stored shape (both packages):** add a required-on-write, optional-on-read
  `entries: { text, mandatory, enabled }[]` field to the payload, mirrored in
  `backend/src/lib/cardPayload.ts` and `frontend/src/lib/savedCard.ts`.
- **Contract tests:** `backend/src/lib/cardPayload.contract.test.ts` and
  `frontend/src/lib/savedCard.contract.test.ts` are updated **together** (per
  AGENTS.md's definition of done) — the pinned `WIRE_CARD` literal and the
  "exactly these top-level fields" assertion both gain `entries`.
- **Backend validation:** `parseCardPayload` validates the `entries` array
  (count cap, per-string length cap, boolean flags), rejects malformed input,
  and the entry bytes count toward the existing `MAX_PAYLOAD_BYTES`.
- **Frontend save path:** the editor's `entries` state flows into the payload
  (`toSavedCardPayload`), not just the rendered `slots`.
- **Frontend load path:** `cardStateFrom` prefers the saved `entries` when
  present, and reconstructs the grid from `slots` exactly as today.
- **No infra changes.** No change to routing, auth, or the API surface beyond
  the payload body.

## Sequencing

Touches the same payload modules and contract tests as the in-flight
`enhance-saved-cards-view` (which adds `thumbnailKey`). The two are
spec-orthogonal (different requirements) and merge cleanly at the field level;
the only coordination is updating the shared contract-test literals in one pass
when both land. Independent of `persist-open-card-on-refresh`; recommended
order is **this change first, then `persist-open-card-on-refresh`**, so a
refresh restores the *full* card in one pass.
