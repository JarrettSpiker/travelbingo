## 1. Shared types and bounds

- [x] 1.1 Add an optional `entries?: BingoEntry[]` field to `CardUrlData` in `frontend/src/lib/cardData.ts`
- [x] 1.2 Define the wire entry shape `{ text: string; mandatory: boolean; enabled: boolean }` in both `backend/src/lib/cardPayload.ts` and `frontend/src/lib/savedCard.ts`
- [x] 1.3 Add `MAX_ENTRIES` (256) to `backend/src/lib/cardPayload.ts`; mirror the constant in the frontend and pin it in both contract tests

## 2. Backend: validate the entry pool

- [x] 2.1 Add a required `entries` array to `CardPayload` and `parseCardPayload` in `backend/src/lib/cardPayload.ts`: validate it is an array, reject when count exceeds `MAX_ENTRIES`, and validate each entry (`text` via the existing `requireString` with `MAX_SLOT_LENGTH`, strict-boolean `mandatory`, strict-boolean `enabled`)
- [x] 2.2 Ensure the new field counts toward the existing `MAX_PAYLOAD_BYTES` size check (computed on the normalized payload, which now includes `entries`)
- [x] 2.3 Add unit tests in `backend/src/lib/cardPayload.test.ts`: accepts a full pool larger than the grid; rejects missing `entries`; rejects a non-array; rejects over-count; rejects bad text and non-boolean flags; counts toward the byte cap

## 3. Frontend: payload encode/decode

- [x] 3.1 Update `toSavedCardPayload` in `frontend/src/lib/savedCard.ts` to always emit `entries`: from `data.entries` when present, else derived via `entriesFromSlots(data.slots)` (so the share-copy / legacy path still sends a well-formed pool)
- [x] 3.2 Update `fromSavedCardPayload` to read `entries` when present (validating/coercing text, `mandatory`, `enabled` defensively) and to omit it from the result when absent (so `cardStateFrom` falls back)
- [x] 3.3 Update `SavedCardPayload` to include the `entries` field

## 4. Frontend: editor load path

- [x] 4.1 Update `cardStateFrom` in `frontend/src/lib/cardState.ts` to build the entry pool from `data.entries` when present (flags intact), otherwise fall back to `entriesFromSlots(data.slots)`; the grid continues to come from `cardFromSlots(data.slots, …)`
- [x] 4.2 Update `App.currentCardData()` in `frontend/src/App.tsx` to populate `entries` from the editor's live `entries` state (so saves carry the full pool)
- [x] 4.3 Extend `frontend/src/lib/cardState.test.ts`: pool restored from `entries` with flags; fallback to slots when `entries` absent; grid still derived from `slots` in both cases; regression test that randomize → save → reload preserves the grid and the full pool

## 5. Contract tests (update together)

- [x] 5.1 Update the pinned `WIRE_CARD` literal in `backend/src/lib/cardPayload.contract.test.ts` to include `entries` (a pool larger than the 3 slots shown, with a mandatory and a disabled entry)
- [x] 5.2 Update the "exactly these top-level fields" assertion in the backend contract test to include `entries`
- [x] 5.3 Mirror both changes in `frontend/src/lib/savedCard.contract.test.ts` (same literal, same field list), and pin `MAX_ENTRIES`
- [x] 5.4 Confirm the frontend round-trip test still passes: `toSavedCardPayload(fromSavedCardPayload(WIRE_CARD))` equals `WIRE_CARD`

## 5b. Backend routes (explicit field-list sites that enumerate CardPayload)

- [x] 5b.1 `cards.ts` `toCardPayload` (GET) returns `entries`
- [x] 5b.2 `cards.ts` `replaceCard` `UpdateExpression` SETs `entries` (so re-save persists the new pool)
- [x] 5b.3 `shares.ts` share snapshot includes `entries` (shares inherit the pool — a strict improvement)

## 6. Tests and verification

- [x] 6.1 Run `npm run lint`, `npm test`, and `npm run build` in **both** `frontend/` and `backend/`; confirm all pass
- [x] 6.2 Manually verify: build a pool with >24 entries (some mandatory, some disabled), randomize, save, reload, reopen — every entry is present with flags intact and the rendered grid is unchanged; open a legacy card (or one saved before deploy) and confirm it opens without error via the slots fallback
