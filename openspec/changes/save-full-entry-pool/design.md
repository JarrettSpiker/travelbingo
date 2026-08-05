## Context

The stored card shape is a mirrored pair: `backend/src/lib/cardPayload.ts`
(`parseCardPayload`, rejects malformed input rather than repairing it) and
`frontend/src/lib/savedCard.ts` (`toSavedCardPayload` / `fromSavedCardPayload`,
which the frontend normalizes defensively). They are held in sync by two
contract tests (`backend/src/lib/cardPayload.contract.test.ts` and
`frontend/src/lib/savedCard.contract.test.ts`) that pin the same literal
`WIRE_CARD` and an "exactly these top-level fields" assertion. AGENTS.md's
definition of done requires both halves and both tests to move together.

Today the payload stores `slots: (string | null)[]` — the 24/25 grid cells.
Saving goes through `App.currentCardData()` (`App.tsx:114`), which builds a
`CardUrlData` from the rendered card (`cardToSlots`) and passes it to
`createCard`/`replaceCard` → `toSavedCardPayload`. The editor's *full* `entries`
state (the pool, with `mandatory` and `enabled` — see `BingoEntry` in
`bingo.ts:17`) never reaches the save path.

Loading goes through a single deserializer, `cardStateFrom` (`cardState.ts`),
whose `entriesFromSlots` rebuilds the pool as `{ text, mandatory: false }` from
the saved slots — losing any entry that was not on the rendered grid and
dropping every flag. This is why reopening a card with >24 entries is lossy.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Persist the full entry pool (text + mandatory + enabled) on save, including
  entries beyond grid capacity and disabled entries.
- Restore the full pool (with flags) on open, while keeping the rendered grid
  byte-for-byte identical (reconstructed from `slots` as today).
- Legacy cards open unchanged (graceful fallback, no backfill).
- Keep the two payload modules and two contract tests in lockstep.

**Non-Goals:**
- No backfill of legacy cards (the backend never received the lost entries).
- No change to the rendered grid layout or to `card-generation`.
- No change to share-link semantics, tokens, or revocation. Shares inherit the
  pool field automatically because they snapshot the same payload; that is an
  observed consequence, not a designed feature.
- No change to the `slots` field or its bounds; `slots` remains the source of
  truth for the rendered grid.

## Decisions

### Decision: Add `entries` alongside `slots`, keep both
**Choice: Payload carries `slots` (the grid, unchanged) **and** a new `entries`
(the full pool, with flags).**
- `slots` stays the authority for the rendered layout; reconstructing the grid
  from it is what makes an opened card pixel-identical today. Replacing it with
  a pool-derived grid would re-run selection and change positions.
- `entries` is the authority for the entry *list* (the editor's pool), carrying
  everything `slots` cannot: entries beyond capacity, disabled entries, and
  mandatory/enabled flags.
- *Alternatives considered:* (1) store only the pool and re-derive the grid on
  open — rejected because re-running selection (with its randomness) would not
  reproduce the exact saved arrangement; (2) store the pool and a separate
  "arrangement" index list — strictly more complex than keeping `slots`.

### Decision: `entries` is required on write, optional on read
**Choice: `parseCardPayload` requires `entries`; the read path treats it as
optional and falls back to `entriesFromSlots(slots)` when absent.**
- Consistent with `cardPayload.ts`'s "reject rather than default" rule for
  *persisted* state: every new save carries a full pool.
- Optional-on-read is required for backward compatibility: legacy cards and any
  share snapshot taken from one lack the field. The frontend's
  `fromSavedCardPayload` already defaults rather than throws (defense in depth),
  so an absent `entries` maps cleanly to the existing `entriesFromSlots` path.
- The frontend's `toSavedCardPayload` always emits `entries`: from
  `data.entries` when the editor supplies it, and by deriving from `slots`
  otherwise (the legacy/share-copy save path, where `CardUrlData` may lack a
  pool). That guarantees every save the backend sees is well-formed, so the
  backend can require the field without breaking the share-copy flow.
- *Alternative considered:* optional on both sides. Rejected because it weakens
  the persisted contract and lets a buggy client silently store a lossy card.

### Decision: The entry shape on the wire is `{ text, mandatory, enabled }`
**Choice: Mirror `BingoEntry` directly, with `enabled` explicit (not optional).**
- The editor's `BingoEntry.enabled` is optional and defaults to true in memory;
  on the wire it is persisted explicitly so the stored value is unambiguous and
  the backend can validate a real boolean (matching `hasFreeSpace`'s strict
  boolean check).
- `text` is capped at the existing `MAX_SLOT_LENGTH` (entries are the same
  strings that can appear in slots), and the pool count is capped by a new
  `MAX_ENTRIES`.
- Mandatory/enabled flags are strict booleans on the wire (reject otherwise).

### Decision: Bound the pool with a dedicated count cap
**Choice: Add `MAX_ENTRIES` (e.g. 256), and keep counting total bytes against
the existing `MAX_PAYLOAD_BYTES`.**
- `MAX_SLOTS` (64) bounds the grid; the pool can legitimately be larger, so it
  needs its own cap. 256 is far beyond any realistic bingo pool and far below
  DoS territory, and the byte cap remains the real backstop.
- Mirrored in both contract tests alongside the existing `MAX_SLOTS` pin.

### Decision: Route the pool through `CardUrlData.entries`, optional
**Choice: Add an optional `entries?: BingoEntry[]` to `CardUrlData`, and teach
`cardStateFrom` to prefer it.**
- `CardUrlData` is already the lingua franca passed to `cardStateFrom`, the API
  wrapper, and `CardView`. Adding an optional field there is the smallest change
  that reaches the single deserializer, and keeps share-snapshot cards flowing
  through the same path.
- `cardStateFrom`: if `data.entries` is present, build the pool from it (flags
  intact); otherwise fall back to `entriesFromSlots(data.slots)`. In both cases
  the grid is still `cardFromSlots(data.slots, …)`.
- `App.currentCardData()` populates `entries` from the editor's live `entries`
  state, which it already holds.

## Risks / Trade-offs

- **[Payload grows]** → A large pool adds bytes, but `MAX_PAYLOAD_BYTES`
  (40 KB today) is the hard backstop and a realistic pool is tiny. Mitigation:
  explicit `MAX_ENTRIES` count cap so a pathological client cannot OOM the
  synchronous JSON validator.
- **[Contract-test coordination with `enhance-saved-cards-view`]** → That change
  adds `thumbnailKey`; this change adds `entries`. Both edit the same `WIRE_CARD`
  literal and the "exactly these top-level fields" assertion. Mitigation: the
  two fields are independent; whoever lands second rebases the shared literal in
  one edit. Both changes must update *both* contract tests (already required by
  AGENTS.md).
- **[Legacy cards lose entries permanently]** → Unavoidable: the backend never
  had them. Mitigation: graceful fallback (no error), and the user can re-add
  entries; subsequent saves capture the full pool.
- **[Share snapshots now carry the pool]** → Strict improvement; a shared card
  opened in the editor restores the full pool. No privacy impact (the pool is
  card content the share already disclosed via `slots`). No spec change to
  `card-share-links`.

## Migration Plan

- Ship backend and frontend together (single `main` branch auto-deploys dev).
- Backend accepts the new required-on-write field on deploy; the frontend
  always sends it, so the pair is consistent from the first post-deploy save.
- Existing rows in DynamoDB are untouched and still readable (optional-on-read
  fallback). They upgrade to full-pool cards the next time the owner saves.
- Rollback: reverting both packages restores today's behavior. Cards saved with
  `entries` after deploy are still readable by the rolled-back frontend — the
  old `fromSavedCardPayload` ignores unknown fields, and `entriesFromSlots`
  rebuilds the pool from `slots` as before. So a rollback is *safe* but lossy
  for the pool on cards saved during the window (the `slots` are intact).

## Open Questions
<!-- none -->
