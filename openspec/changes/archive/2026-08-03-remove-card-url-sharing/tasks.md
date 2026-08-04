## 1. Relocate the `CardUrlData` type

- [x] 1.1 Create `frontend/src/lib/cardData.ts` exporting the `CardUrlData` interface (pure types only — slots, title, hasFreeSpace, freeSpaceText, colorScheme, fontScheme, emojiScheme)
- [x] 1.2 Update `frontend/src/App.tsx` and `frontend/src/components/CardView.tsx` to import `CardUrlData` from `./lib/cardData` instead of `./lib/cardUrl`

## 2. Remove the encode/decode mechanism

- [x] 2.1 Delete `frontend/src/lib/cardUrl.ts` and its co-located `frontend/src/lib/cardUrl.test.ts`
- [x] 2.2 In `frontend/src/App.tsx`: remove the module-level `decodeCardFromUrl()` call, the `handleExportUrl` handler, the `onExportUrl` prop pass-through on `CardView`, and the now-unused imports (`decodeCardFromUrl`, `encodeCardToUrl`)
- [x] 2.3 Confirm the app tolerates a leftover `?card=` query param on load without error — the param is simply never inspected

## 3. Remove the URL-export UI

- [x] 3.1 In `frontend/src/components/CardView.tsx`: remove the `onExportUrl` prop from the component's props interface
- [x] 3.2 Remove the "Copy card link" `MenuItem` from the Export menu and the `handleExportUrl` handler it calls
- [x] 3.3 Remove the explanatory comment about the two coexisting sharing mechanisms, and the selectable-text fallback field that displayed the copied URL (now unused)
- [x] 3.4 Confirm the Export menu still offers PDF and PNG and that both still work

## 4. Clean up stale references

- [x] 4.1 In `frontend/src/lib/savedCard.ts`: update the comment that references `decodeCardFromUrl` (around line 66) so it no longer names a deleted function
- [x] 4.2 Grep the frontend for any remaining references to `cardUrl`, `encodeCardToUrl`, `decodeCardFromUrl`, or `?card=` and remove or update them

## 5. Amend AGENTS.md

- [x] 5.1 Delete the "`?card=` URL sharing is permanent…" bullet under Architectural constraints
- [x] 5.2 Revise the "fully usable signed out" bullet: keep card generation, randomize, print, and PNG in the signed-out set; remove sharing (and any mention of `?card=`) from it
- [x] 5.3 Remove the `encodeCardToUrl` / `decodeCardFromUrl` / `SCHEMA_VERSION` reference from that same bullet if it appears there

## 6. Tests and verification

- [x] 6.1 Run `npm run lint`, `npm test`, and `npm run build` from `frontend/`; confirm all pass
- [ ] 6.2 Manually verify: visiting a URL with a `?card=` param loads the normal empty editor (no error, no decode); the Export menu shows only PDF and PNG; signed-out card generation/print/PNG still work
