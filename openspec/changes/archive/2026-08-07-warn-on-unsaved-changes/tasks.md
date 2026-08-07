## 1. Dirty-state derivation (pure logic)

- [x] 1.1 Add `cardDataEquals(a, b)` to `frontend/src/lib/cardData.ts`: structural equality over `CardUrlData` — entries (text + mandatory + enabled), slots, title, `hasFreeSpace`, `freeSpaceText`, and the color/font/emoji schemes. Return `true` for identity and for two `null`/undefined baselines; short-circuit on length and reference-equal schemes.
- [x] 1.2 Co-locate `frontend/src/lib/cardData.test.ts` covering: identical snapshots; a single changed entry text; a changed mandatory/enabled flag; a changed grid arrangement (randomized `slots` with identical entries); changed title/free-space; a changed scheme; an empty editor vs. an edited one; and a post-save baseline that matches current (clean).

## 2. Editor dirty baseline

- [x] 2.1 In `frontend/src/App.tsx`, add a `baselineRef = useRef<CardUrlData>()` seeded from `currentCardData()` on first render via lazy init, so an opened card and an empty editor both start clean.
- [x] 2.2 Refresh `baselineRef.current = currentCardData()` at the end of `saveCurrentCard()` only on a successful create/replace (after `setSavedCardId`), so a failed save leaves the card dirty and the baseline unchanged.
- [x] 2.3 Derive `const isDirty = !cardDataEquals(currentCardData(), baselineRef.current)` during render and expose it (plus a "save then leave" entry point) to the guard hook/dialog.

## 3. Navigation-blocking hook

- [x] 3.0 Switch `frontend/src/main.tsx` from `<BrowserRouter>` to `createBrowserRouter` + `RouterProvider` with one catch-all route holding the provider tree. Added during implementation: `useBlocker` requires a data router, which the declarative router does not provide, so 3.1 would throw without this. `routes.tsx` is unchanged.
- [x] 3.1 Create `frontend/src/hooks/useUnsavedChangesGuard.ts` (new `hooks/` directory) calling React Router v8's `useBlocker(() => isDirty)`, returning the blocker plus the `isDirty` flag. Document that the blocker is a single interception point covering header links, the account-menu item, open-card, and in-app back/forward.
- [x] 3.2 In the same hook, register a `beforeunload` listener (in a `useEffect`, with cleanup `removeEventListener`) that is active only while `isDirty` and sets `event.returnValue` / calls `preventDefault()` so reload, tab close, and external navigation prompt. Guard add/remove so React 19 StrictMode's double-invoke leaves no dangling listener.
- [x] 3.3 Co-locate `useUnsavedChangesGuard.test.tsx` (or a test exercising the pure `isDirty` wiring): a clean editor's `useBlocker` does not block; a dirty editor blocks; after a successful save (baseline refreshed) navigation proceeds. Keep React/DOM dependencies out of the `src/lib/` equality helper.

## 4. Unsaved-changes confirm dialog

- [x] 4.1 Create `frontend/src/components/UnsavedChangesDialog.tsx` on the existing shadcn `Dialog` primitive (consistent with `ShareLinkDialog`). Props: `open`, `blocker` (React Router `Blocker` or null), `authStatus` (signed-in vs. signed-out), `saving`, `error`, and callbacks `onSaveAndLeave`, `onLeaveWithoutSaving`, `onStay`. "Stay" → `blocker.reset()`; "Leave without saving" → `blocker.proceed()`; "Save and leave" → `onSaveAndLeave`.
- [x] 4.2 Render the "Save and leave" action only when authenticated; signed-out shows just "Leave without saving" and "Stay", per the additive-accounts constraint. Disable actions and show a "Saving…" state while `saving`; surface `error` with a retry path and do NOT proceed on failure.
- [x] 4.3 Wire `App.tsx` to render the dialog from the hook's blocked state, passing a `saveAndLeave` that calls `saveCurrentCard()` and, on success, refreshes the baseline and calls `blocker.proceed()`; on failure keeps the dialog open and reports the error.

## 5. Gallery entry and visual QA setup

- [x] 5.1 Add a gallery entry for `UnsavedChangesDialog` in `frontend/src/dev/gallery/registry.tsx` covering the signed-in (three-action) and signed-out (two-action) variants, and a saving/error state. Required so `coverage.test.ts` stays green (repo definition of done).

## 6. Verification

- [x] 6.1 Run `npm run lint && npm test && npm run build` in `frontend/`; all must pass. (No backend or infra change — backend commands are unaffected, but confirm none were touched.)
- [x] 6.2 Visual QA via `npm run capture -- /ui` plus the dialog variants, in light and dark at 390px and 1440px; confirm the signed-out `/` capture still reports zero `/api/` requests on load.
- [x] 6.3 Signed-in flow in dev: edit a card, click "My cards" and confirm the dialog appears; choose Stay (editor intact), Save and leave (card saved then navigated, dirty cleared), and Leave without saving (navigated, changes discarded). Confirm opening another saved card while dirty is intercepted, and that the newly opened editor starts clean.
- [x] 6.4 Signed-out flow in dev: build a card with no account, attempt navigation, and confirm the warning omits the save option; reload and tab close prompt the browser guard while dirty and do not while clean.
- [x] 6.5 Confirm the frozen card renderer and `App.css` are untouched (`cardGrid.guard.test.ts` passes unchanged) and the saved-card contract tests are unchanged.
