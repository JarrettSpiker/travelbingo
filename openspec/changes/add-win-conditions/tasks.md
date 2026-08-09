## 1. Backend win logic

- [ ] 1.1 Create `backend/src/lib/winCondition.ts`: `WinCondition = "line" | "two-lines" | "full-card"`, `DEFAULT_WIN_CONDITION = "line"`, and `LINES` derived from the grid size rather than written out by hand (5 rows + 5 columns + 2 diagonals = 12 lines of 5 indices). Export `completedLines(marked)`, `hasWon(marked, condition)`, and `squaresFromWin(marked, markable, condition)` returning `0` when won and `Infinity` when unreachable. Keep it pure — no DynamoDB, no HTTP, no dependency on `Deps`.
- [ ] 1.2 Co-locate `backend/src/lib/winCondition.test.ts`. Enumerate all twelve lines explicitly in the test as a fixed table, so a change to the derivation fails loudly. Cover: each row, each column, each diagonal; a crossing row and column counting as two lines; a line one square short counting as none; `full-card` needing every markable square; `squaresFromWin` taking the cheapest route when one line is closer than another; `squaresFromWin` returning `0` on a won card; and `Infinity` when every line contains a position outside `markable`.
- [ ] 1.3 Extend `backend/src/lib/tripPayload.ts`: add `winCondition` to `TripInput` and `TripUpdateInput` (optional on both, defaulting to `"line"` on create), validated against the allowlist and rejected — never corrected — when unsupported. `mode` must stay absent from `TripUpdateInput`. Extend `tripPayload.test.ts` with the accepted values, an unsupported value, and a confirmation that `mode` in an update payload is still rejected.

## 2. Backend trip and win wiring

- [ ] 2.1 In `backend/src/routes/trips.ts`, store `winCondition` on the trip `META` in `createTrip` and allow `updateTrip` to change it. Do **not** denormalize it onto the `USER#`/`TRIP#` listing rows — the trips list does not render it, and `updateTrip`'s transaction already fans out to every member and is bounded at 51 actions.
- [ ] 2.2 Read the trip's win condition schema-on-read everywhere it is consumed: an item with no `winCondition` attribute is a `"line"` trip. Return it on `getTrip` and on the trips listing derived value, so the frontend never has to know the default.
- [ ] 2.3 Extend `markTripCardSlot` in `backend/src/routes/trips.ts`: after the set update, build the marked set and the markable set (positions where `snapshot.slots[i]` is not `null`), call `hasWon`, and when it passes write `wonAt` and `winnerId` with a `ConditionExpression: "attribute_not_exists(wonAt)"` so the first achievement sticks. `winnerId` is the assignee in a competitive trip and the calling member in a cooperative one. Swallow the conditional-check failure — losing the race means someone else's record is already there, which is the correct outcome, not an error.
- [ ] 2.4 Confirm `unmarkTripCardSlot` performs **no** win evaluation and never clears `wonAt`/`winnerId`.
- [ ] 2.5 Include `wonAt` and `winnerId` on each trip card in the `getTrip` and `getTripProgress` responses, straight from the stored attributes with no re-evaluation.
- [ ] 2.6 Extend `backend/src/routes/trips.test.ts`: create with and without a win condition; unsupported value rejected on create and on update; admin can change the condition and a member cannot; changing it leaves marks and a recorded win untouched; a mark that completes a line records `wonAt`/`winnerId`; a further mark does not overwrite the record; unmarking below the threshold leaves the record; the competitive winner is the assignee and the cooperative winner is the marker; two concurrent completing marks yield exactly one record; a trip can carry two won cards.
- [ ] 2.7 Run `npm run lint && npm test && npm run build` in `backend/`; all must pass.

## 3. Frontend win logic

- [ ] 3.1 Create `frontend/src/lib/winCondition.ts` hand-mirroring `backend/src/lib/winCondition.ts`, with a header comment naming the backend file as its counterpart, following the convention documented in `frontend/src/lib/tripTypes.ts`. Derive `LINES` from `GRID_SIZE` in `frontend/src/lib/bingo.ts` rather than restating the geometry.
- [ ] 3.2 Co-locate `frontend/src/lib/winCondition.test.ts` with the **same** test table as `backend/src/lib/winCondition.test.ts`, including the explicit twelve-line enumeration, so the two implementations cannot drift without a test failing on one side.
- [ ] 3.3 Add a `markableSlots(snapshot)` helper (or reuse the cell kinds from `frontend/src/lib/bingo.ts`) so `squaresFromWin` and the unreachable check have the same notion of which positions hold an entry as the backend does.
- [ ] 3.4 Extend `frontend/src/lib/tripTypes.ts`: `WinCondition`, `winCondition` on `TripDetail`/`TripSummary` as appropriate, `wonAt?` and `winnerId?` on `TripCard`, and `winCondition` on `TripInput`/`TripUpdate`.

## 4. Frontend trip pages

- [ ] 4.1 Add a win-condition `Select` to `frontend/src/pages/TripFormPage.tsx`, beside the existing mode control. Unlike mode — which is read-only after creation (`TripFormPage.tsx:202-206`) — this control stays editable on the edit form. Label the options in plain language ("One line", "Two lines", "Full card") and explain that a line means any row, column, or diagonal.
- [ ] 4.2 Warn on `TripFormPage` when the chosen win condition cannot be reached by a card already in the trip. It is a warning, not a refusal: more cards may still be added.
- [ ] 4.3 On `frontend/src/pages/TripDetailPage.tsx`, show the trip's win condition, and per card show the distance to the target from `squaresFromWin` against the live marks, an unreachable indicator where it applies, and a winner badge naming the member and the date for any card carrying `wonAt`.
- [ ] 4.4 Celebrate when the member's own mark completes the target — a clear, dismissible message on the card. Present a recorded win and the card's current marks as two separate truths, so a card that was won and then unmarked below the threshold reads correctly rather than contradicting itself.
- [ ] 4.5 Add gallery entries in `frontend/src/dev/gallery/registry.tsx` for the new states: a card one square from winning, a won card with its badge, a card whose target is unreachable, and the win-condition select in each of its three values.

## 5. Verification

- [ ] 5.1 `npm run lint && npm test && npm run build` pass in **both** `frontend/` and `backend/`.
- [ ] 5.2 Confirm the mirrored `winCondition.ts` files agree by running both packages' test suites; the shared test table is the only thing linking them.
- [ ] 5.3 Visual QA via `npm run capture -- /trips/new` and `/trips/:tripId` in light and dark at 390px and 1440px, with a card one square away, a won card, and an unreachable card on screen.
- [ ] 5.4 Confirm the card renderer is untouched: `cardGrid.guard.test.ts` passes unchanged and `CardGrid.tsx`/`App.css` carry no diff from this change — a win is announced around the card, not drawn on it.
- [ ] 5.5 Multi-member verification in dev with `scripts/dev-user.sh`: in a competitive two-lines trip, the assignee completes a row then a crossing column and the win records on the second; the admin then tightens the trip to a full card and the recorded win survives; the assignee unmarks a square and the badge stays while the distance-to-target updates; a second member's card wins independently and both wins show.
- [ ] 5.6 Confirm the saved-card contract tests are unchanged — this change does not touch the stored card shape or `TripCardSnapshot`.
