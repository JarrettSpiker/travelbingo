## Why

A user editing a card can lose their unsaved work in a single click. Clicking "My cards" in the header, choosing another card to open, hitting the browser's back button, or reloading the tab all discard whatever they were building — with no warning. The `card-library` spec already promises a confirmation in this situation ("Opening a saved card would discard unsaved work → the system SHALL confirm"), but nothing implements it: there is no notion of "dirty" state anywhere in the editor, so the library's open action and every header link navigate away unconditionally.

## What Changes

- **The editor gains a notion of "unsaved changes" (dirty state).** The editor's current state is compared against a baseline — the card it was opened with, updated to match the editor after every successful save — so any edit, randomize, or scheme change marks the card dirty until it is saved.
- **Navigation away from a dirty editor is blocked and confirmed.** An in-app confirm dialog appears before the editor is left — covering header links ("My cards", the wordmark, "Editor"), the account menu's "My saved cards", opening a different saved card, and in-app back/forward. The dialog lets the user **Save and leave** (when signed in), **Leave without saving**, or **Stay**.
- **Reload, tab close, and external navigation prompt the browser's native guard.** A `beforeunload` handler is armed only while the editor is dirty, so the browser warns before the document is unloaded.
- **A new `unsaved-changes-guard` capability** owns the dirty-tracking and confirmation behavior generally, and the existing `card-library` requirement is amended so its "open would discard unsaved work" scenario is governed by this single guard rather than restating it.
- **Unchanged:** card generation, the frozen card renderer, save/share behavior, the saved-card shape and contract tests, and the signed-out, zero-API-requests-on-load invariant. The guard works whether or not the user is signed in; only the "Save and leave" action is account-gated.

## Capabilities

### New Capabilities
- `unsaved-changes-guard`: The editor tracks whether its current card has changes the user has not saved, and — while it does — intercepts navigation that would discard those changes (in-app route changes, history navigation, reload, and tab close) with a confirmation that lets the user save first, leave anyway, or stay.

### Modified Capabilities
- `card-library`: The "A signed-in user can list and open their saved cards" requirement's "Opening a saved card would discard unsaved work" scenario is amended to reference the `unsaved-changes-guard` capability as the single owner of that confirmation, so the behavior is specified in one place.

## Impact

- **Frontend editor** (`frontend/src/App.tsx`): owns the dirty baseline (the card the editor opened with, refreshed after each save) and exposes a `isDirty` derivation and a "save then leave" action to the guard.
- **New pure logic** (`frontend/src/lib/`, co-located test): structural equality over `CardUrlData` to derive dirty state from two snapshots, with no React/DOM dependencies.
- **New guard hook** (`frontend/src/hooks/`, a new directory): wires React Router v8's `useBlocker` (in-app and history navigation) and the `beforeunload` listener (reload/tab close/external) to the dirty flag, rendering the confirm dialog.
- **New confirm dialog** (`frontend/src/components/`): the "Unsaved changes" dialog built on the existing shadcn `Dialog`, with account-aware actions and a gallery entry.
- **No backend change.** No new API routes, storage, or schema change; the saved-card contract tests are untouched.
- **No infra change.**
- **Specs:** one new capability (`unsaved-changes-guard`); one modified capability (`card-library`).
