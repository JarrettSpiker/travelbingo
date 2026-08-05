## 1. Shared types and bounds

- [ ] 1.1 Add an optional `entries?: BingoEntry[]` field to `CardUrlData` in `frontend/src/lib/cardData.ts`
- [ ] 1.2 Define the wire entry shape `{ text: string; mandatory: boolean; enabled: boolean }` in both `backend/src/lib/cardPayload.ts` and `frontend/src/lib/savedCard.ts`
- [ ] 1.3 Add `MAX_ENTRIES` (e.g. 256) to `backend/src/lib/cardPayload.ts`; mirror the constant in the frontend and pin it in both contract tests

## 2. Backend: validate the entry pool

- [ ] 2.1 Add a required `entries` array to `CardPayload` and `parseCardPayload` in `backend/src/lib/cardPayload.ts`: validate it is an array, reject when count exceeds `MAX_ENTRIES`, and validate each entry (`text` via the existing `requireString` with `MAX_SLOT_LENGTH`, strict-boolean `mandatory`, strict-boolean `enabled`)
- [ ] 2.2 Ensure the new field counts toward the existing `MAX_PAYLOAD_BYTES` size check (it is computed on the normalized payload, so verify `entries` is included)
- [ ] 2.3 Add unit tests in `backend/src/lib/cardPayload.test.ts` (or alongside): accepts a full pool larger than the grid; rejects missing `entries`; rejects a non-array; rejects over-count; rejects bad text and non-boolean flags

## 3. Frontend: payload encode/decode

- [ ] 3.1 Update `toSavedCardPayload` in `frontend/src/lib/savedCard.ts` to always emit `entries`: from `data.entries` when present, else derived via `entriesFromSlots(data.slots)` (so the share-copy / legacy path still sends a well-formed pool)
- [ ] 3.2 Update `fromSavedCardPayload` to read `entries` when present (validating/coercing text, `mandatory`, `enabled` defensively, as it does for other fields) and to omit it from the result when absent (so `cardStateFrom` falls back)
- [ ] 3.3 Update `SavedCardPayload` to include the `entries` field

## 4. Frontend: editor load path

- [ ] 4.1 Update `cardStateFrom` in `frontend/src/lib/cardState.ts` to build the entry pool from `data.entries` when present (flags intact), otherwise fall back to `entriesFromSlots(data.slots)`; the grid continues to come from `cardFromSlots(data.slots, …)`
- [ ] 4.2 Update `App.currentCardData()` in `frontend/src/App.tsx` to populate `entries` from the editor's live `entries` state (so saves carry the full pool)
- [ ] 4.3 Add/extend tests in `frontend/src/lib/cardState.test.ts`: pool restored from `entries` with flags; fallback to slots when `entries` absent; grid still derived from `slots` in both cases

## 5. Contract tests (update together)

- [ ] 5.1 Update the pinned `WIRE_CARD` literal in `backend/src/lib/cardPayload.contract.test.ts` to include `entries` (e.g. a pool larger than the 3 slots shown)
- [ ] 5.2 Update the "exactly these top-level fields" assertion in the backend contract test to include `entries`
- [ ] 5.3 Mirror both changes in `frontend/src/lib/savedCard.contract.test.ts` (same literal, same field list), and pin `MAX_ENTRIES`
- [ ] 5.4 Confirm the frontend round-trip test still passes: `toSavedCardPayload(fromSavedCardPayload(WIRE_CARD))` equals `WIRE_CARD`

## 6. Tests and verification

- [ ] 6.1 Run `npm run lint`, `npm test`, and `npm run build` in **both** `frontend/` and `backend/`; confirm all pass
- [ ] 6.2 Manually verify: build a pool with >24 entries (some mandatory, some disabled), save, reload the library, reopen — every entry is present with flags intact and the rendered grid is unchanged; open a legacy card (or one saved before deploy) and confirm it opens without error via the slots fallback
