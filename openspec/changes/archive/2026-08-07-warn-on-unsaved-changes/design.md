## Context

The editor owns all card state in `frontend/src/App.tsx` as `useState` hooks (entries, title, free/has-free, the three schemes, the rendered `card`, and `savedCardId`). It already produces a complete, serializable snapshot via `currentCardData()` (`App.tsx:118`) and persists it via `saveCurrentCard()` (`App.tsx:135`), which updates `savedCardId` in place on a successful create. The editor route (`routes.tsx`) keys `<App>` by `location.key`, so opening another card remounts the editor with fresh initial state. There is currently no notion of "dirty" anywhere.

Every navigation that could discard work originates while the editor is mounted: the header's wordmark and nav links (`SiteHeader.tsx:62,68`), the account menu's "My saved cards" (`AuthMenu.tsx:85`), the library's open action (`SavedCardsPage.tsx:70`), and in-app back/forward. The app uses React Router v8, whose `useBlocker` intercepts in-app and history navigation while the editor component is on screen — but it does **not** intercept reload/tab-close/external navigation, which need `beforeunload`.

**Correction, found during implementation:** this design originally assumed `useBlocker` worked under the declarative `<BrowserRouter>` the app mounted. It does not. `useBlocker` calls `useDataRouterContext("useBlocker")`, which `invariant`s unless a **data router** is above it, and only `RouterProvider` supplies that context — `<BrowserRouter>` renders the declarative `<Router>`, which does not. Calling it as written throws at runtime. See the router decision below.

The existing `card-library` spec already declares an unimplemented "Opening a saved card would discard unsaved work" scenario; this change implements it and lifts the behavior into the new `unsaved-changes-guard` capability.

## Goals / Non-Goals

**Goals:**
- A single, robust derivation of "has unsaved changes" that cannot be missed by a future handler.
- One interception point that covers all in-app navigation away from the editor without instrumenting each link.
- A browser-level guard for reload/tab close/external navigation.
- Account-aware confirmation: signed-in users can save-and-leave; signed-out users are still warned.
- Preserve every existing invariant: the signed-out zero-requests-on-load guarantee, the frozen card renderer, and the saved-card contract tests are untouched.

**Non-Goals:**
- Persisting unsaved editor state across a reload (explicitly out of scope per the existing `card-library` reload scenario; if the user proceeds past the warning, today's restore-last-saved behavior applies).
- A general "are you sure" framework for non-editor routes (the library and share page hold no dirty state).
- Auto-save or draft storage.

## Decisions

### Decision: Derive dirty state by comparing the current snapshot to a baseline, not via a per-handler boolean
Dirty = the editor's `currentCardData()` differs from a **baseline** snapshot held in a `useRef<CardUrlData>` inside `App`. The baseline is seeded from the initial card on mount (the opened card, or the empty editor) and refreshed to equal `currentCardData()` immediately after a successful save.

**Why over a `setDirty(true)` flag in every handler:** the editor has ~10 mutating handlers today (`handleAddEntry`, `handleEditEntry`, `handleRandomize`, scheme setters, …) and adding more is easy. A boolean relies on every handler remembering to flip it; a comparison cannot be missed. Randomize is the subtle case — it changes the rendered grid arrangement but no entries — and the comparison catches it because `currentCardData().slots` (via `cardToSlots`) changes. The cost is a structural equality check per render, which is negligible against a 24-ish-slot card.

**Alternative considered:** tracking a per-field "version" counter incremented on each setState. Rejected — it duplicates the comparison and is equally easy to forget in a new handler.

The structural equality lives in a new pure helper `frontend/src/lib/cardData.ts` (e.g. `cardDataEquals(a, b)`), deep-comparing entries (text + mandatory + enabled), slots, title, free-space, and the three schemes, with a co-located `cardData.test.ts`. Keeping it in `src/lib/` preserves the framework-agnostic, unit-testable boundary.

### Decision: `main.tsx` mounts a data router so `useBlocker` exists at all
`createBrowserRouter` + `RouterProvider` replace `<BrowserRouter>`, with a single catch-all route (`path: "*"`) whose element is the provider tree (`TooltipProvider` → `AuthProvider` → `AppRoutes`). Routing stays declarative and stays in `routes.tsx`: those `<Routes>` are descendant routes of the catch-all, so no route definition moves and no page changes.

**Why this over the alternatives:** hand-rolling interception under the declarative router means wrapping every navigation source (`SiteHeader`, `AuthMenu`, `SavedCardsPage`) plus a `popstate` sentinel for back/forward — the scattered, incomplete per-link instrumentation this design rejects below, and it would miss any navigation added later. Shipping only `beforeunload` would leave the header-link, open-card, and back/forward scenarios — the substance of the proposal — unimplemented.

The providers moving inside the route element is safe precisely because the route matches every path: the element never changes across a navigation, so React keeps those instances, and the session state in them, mounted. It is written as a static element rather than a component so `main.tsx` still exports nothing (a component declaration there trips the fast-refresh lint rule).

### Decision: One `useBlocker` in `App` covers all in-app navigation; `beforeunload` covers the rest
A hook (new `frontend/src/hooks/useUnsavedChangesGuard.ts`) calls React Router v8's `useBlocker(() => isDirty)` and registers a `beforeunload` listener that is armed only while dirty. Because every navigation that would discard work happens while the editor (`App`) is mounted, a single blocker in `App` intercepts header links, the account-menu item, the library's open action, and in-app back/forward — with no per-link instrumentation.

**Why not wrap each `navigate`/`Link`:** there are several navigation sources across components (`SiteHeader`, `AuthMenu`, `SavedCardsPage`), and instrumentation would be scattered and incomplete (back/forward cannot be wrapped). `useBlocker` intercepts at the router, so it also covers navigations added later without extra wiring.

When the blocker reports `state === "blocked"`, the hook surfaces a `Blocker` object so `App` can render the confirm dialog. "Stay" calls `blocker.reset()`; "leave without saving" calls `blocker.proceed()`; "save and leave" awaits the save, refreshes the baseline on success, then calls `blocker.proceed()`.

**Interaction with reload-restore:** `useBlocker` does not intercept `Cmd+R` / tab close / external links, so the `beforeunload` listener handles those. If the user proceeds past it, the existing reload behavior (re-fetch and restore the last **saved** card, dropping edits) applies unchanged — the two mechanisms compose; `beforeunload` only adds a chance to cancel.

### Decision: The "save and leave" path reuses the editor's existing save flow
The confirm dialog's save action calls the same `saveCurrentCard()` already used by the header Save button (`App.tsx:135`), then refreshes the baseline. This reuses the existing thumbnail generation, create-vs-replace logic, and error handling, so there is one save code path. On failure the dialog stays open, reports the error, and does **not** proceed — the user can retry or pick "leave without saving".

### Decision: Signed-out confirmation offers only "leave" and "stay"
Saving to the library requires an account, and the architectural rule is that account features stay additive. A signed-out user therefore cannot save from the dialog, and the dialog will not kick off a sign-in redirect mid-navigation (that would strand the user between routes). The signed-out user is still warned, so they can stay and print/export the card. The save action is rendered conditionally on the authenticated status from `useAuth`.

### Decision: Confirm dialog is a shadcn `Dialog`, with a gallery entry
The confirm is a new `frontend/src/components/UnsavedChangesDialog.tsx` built on the existing shadcn `Dialog` primitive, consistent with `ShareLinkDialog`. It receives the in-flight save state and auth status as props and reports the user's choice via callbacks, keeping `App` as the single state owner. Per the repo's definition of done it gets a gallery entry in `src/dev/gallery/registry.tsx` (signed-in and signed-out variants), and `coverage.test.ts` must stay green.

## Risks / Trade-offs

- **[React Router `useBlocker` and the keyed remount]** The editor remounts on a fresh `location.key` when opening a card; the blocker that catches the open-navigation lives on the *current* (pre-navigation) instance, which is correct. → Verify in QA that opening a card while dirty is caught and that, after "leave", the new card's editor is clean (baseline seeded from the opened card).
- **[Stale `isDirty` in the blocker closure]** The blocker callback must see the latest dirty value. Because `App` re-renders on every state change and passes a fresh closure, React Router re-evaluates it. → Derive `isDirty` during render (not inside the callback) and assert in a unit test that a post-save baseline makes a navigation proceed.
- **[Strict-mode double-invocation]** `beforeunload` registration runs in an effect; guard add/remove so React 19 StrictMode's mount-unmount-mount does not leave a dangling listener. → Use the effect's cleanup to `removeEventListener`.
- **[Browser beforeunload copy is not customizable]** Modern browsers ignore custom text and show a generic message. → Accepted; the in-app dialog carries the real copy, and `beforeunload` is the last-resort guard for reload/close only.
- **[Blocking non-editor routes is a non-goal]** If a future route holds dirty state it will need its own guard. → Documented as a non-goal; no shared abstraction is built speculatively.
- **[Comparison cost]** A per-render deep compare of ~24 slots + entries is trivial. → No memoization needed initially; revisit only if profiling shows cost.

## Migration Plan

This is a frontend-only change, additive except for the router swap in `main.tsx` (same URLs, same routes, same history behaviour). Deployment is the standard push-to-`main` (dev) → reviewer-gated prod flow. No data migration, no backend or infra change, and no change to the saved-card shape — the contract tests are untouched. Rollback is reverting the frontend; there is no server-side state to unwind.
