## 1. Entry data model and selection logic

- [x] 1.1 Add an `enabled: boolean` field to `BingoEntry` (default true), and default a missing `enabled` to true inside `getUniqueEntries` while preserving the flag alongside `mandatory`
- [x] 1.2 Exclude disabled entries from selection in `selectEntryTexts` (after dedup, before the capacity check and the mandatory/optional split) so both `buildCard` and `randomizeCard` omit them
- [x] 1.3 Confirm disabled entries are still considered by duplicate detection (add/edits of a disabled entry's text are rejected)

## 2. Entry-list UI

- [x] 2.1 Add a per-row "Active" switch to `EntryInput` and an `onToggleEnabled(index)` handler threaded through `App` state
- [x] 2.2 Render disabled rows struck-through at reduced opacity; disable (grey out) the Mandatory checkbox while an entry is disabled
- [x] 2.3 Compute the "cells filled" / "extra" counters and the mandatory-overflow warning from enabled entries only

## 3. Tests and verification

- [x] 3.1 Add unit tests: disabled entries excluded from the live card and the randomized card; disabled entries do not count toward capacity; all enabled entries show when they fit
- [x] 3.2 Add unit tests: a disabled mandatory entry does not appear; mandatory guarantee applies to enabled mandatory entries; more enabled mandatory entries than capacity still renders gracefully
- [x] 3.3 Add a unit test that a duplicate of a disabled entry is still rejected
- [x] 3.4 Run `npm run lint`, `npm test`, and `npm run build` from `frontend/`; confirm all pass
