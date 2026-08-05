## 1. Routing: carry the open card id in the URL

- [x] 1.1 In `frontend/src/pages/SavedCardsPage.tsx`, update `handleOpen` to navigate to `/?card=<id>` (query param) in addition to passing `state: { card, cardId }`, so the id is in the URL from the first open
- [x] 1.2 In `frontend/src/routes.tsx`, read a `card` query param in `EditorRoute`; keep the existing `location.state` handoff as the instant-open path
- [x] 1.3 Add a small pure helper (e.g. in `src/lib/`) to parse/strip the `card` query param so route logic stays testable without a DOM

## 2. Routing: reload-restore fetch

- [x] 2.1 In `EditorRoute`, when `location.state` is absent but the `card` query param is present, fetch the card via `getCard(api, cardId)` and resolve `CardUrlData | null` to hand to `App`
- [x] 2.2 Skip the fetch entirely when there is no `card` param (plain load) or the user is not authenticated (signed-out invariant: zero API requests)
- [x] 2.3 Render a non-blocking loading state (spinner) for the reload case only; initial-open and empty loads keep their current zero-latency first paint
- [x] 2.4 Seed `App`'s `initialCardId` from the URL id on reload so the editor knows which saved card it is editing (re-save updates in place, not a duplicate)

## 3. Editor integration

- [x] 3.1 Verify `App` still initializes purely from `initialCard`/`initialCardId` (no new data-fetch effect inside `App`); the route resolves the card before mount
- [x] 3.2 Keep the existing remount-keying strategy intact (`key` changes when an incoming card is handed over), so navigating from `/cards` still applies a fresh card
- [x] 3.3 Ensure a failed/404 reload-fetch (including another user's card id) degrades cleanly: empty editor or a clear "could not open" state, never a crash, and never revealing whether the card exists

## 4. Leaving the saved card

- [x] 4.1 Ensure all "back to the editor" navigations target bare `/` with no `?card=` param and no `location.state`, so a subsequent reload lands on the empty editor (check `SavedCardsPage.tsx`, `SharedCardPage.tsx`, `AuthMenu`/header links)

## 5. Auth redirect

- [x] 5.1 Confirm the existing `signIn(targetPath)` redirect preserves the full path plus `?card=` query, so a signed-out visitor who signs in lands back on their open card and the reload-restore path runs

## 6. Tests and verification

- [x] 6.1 Add unit tests for the query-param parse/strip helper (present, absent, malformed)
- [x] 6.2 Add a test covering the reload-restore path: URL has id, no `location.state`, authenticated → fetch + load; no param → no fetch
- [x] 6.3 Add a test asserting a signed-out visitor with `?card=<id>` triggers no API call
- [x] 6.4 Add a test asserting a 404 / other-user's card id degrades without revealing existence
- [x] 6.5 Run `npm run lint`, `npm test`, and `npm run build` in `frontend/`; confirm all pass (no backend changes)
- [ ] 6.6 Manually verify: open a saved card → URL shows `?card=<id>`; reload restores it; "back to editor" clears the param and reload lands on empty editor; opening another user's card id does not reveal it
