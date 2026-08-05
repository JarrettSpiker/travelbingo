## Why

When a signed-in user opens a saved card from their library, the card is handed
to the editor through React Router's in-memory `location.state`. A page reload
wipes that state, so the editor comes back empty and the card the user was
viewing is gone — even though it still exists on the server under a stable id.
Users expect a refresh to keep the card they were looking at.

## What Changes

- Opening a saved card records **which** card is open in the URL (a `?card=<id>`
  query parameter on the editor route), so the open-card identity survives
  reload, back/forward, and bookmarking. The existing `location.state` handoff
  is kept for the instant, no-refetch first paint; the URL is the durable
  fallback.
- On editor load, when no in-memory `location.state` is present but the URL
  carries a `?card=<id>`, the editor SHALL fetch that saved card by id and load
  it (the same path the library's "open" action uses today). This fetch happens
  only for a signed-in user with a card id in the URL; a signed-out visitor, or
  a signed-in visitor on a bare `/`, makes **zero** API requests on load, as
  today.
- The `?card=<id>` query parameter is removed from the address bar when the user
  moves on to a fresh/empty editor (e.g. via the "Back to the editor" link), so
  it does not become a lingering pointer to a card the user is no longer
  editing. It is *not* scrubbed after loading — the whole point is that it
  survives a refresh.
- Reloading restores the **saved** card exactly as it was last saved. Unsaved
  in-progress edits are not persisted across reload (out of scope; see
  Non-Goals).

## Capabilities

### New Capabilities
<!-- none — covered as a modification to an existing capability -->

### Modified Capabilities
- `card-library`: A new requirement makes opening a saved card durable across a
  page reload — the open card's identity is reflected in the URL, and a reload
  re-fetches and re-loads that card rather than presenting an empty editor. The
  new requirement also fixes the auth/privacy boundary in URL form (a card id in
  the URL is not a capability; the server's existing membership check still
  gates access, and a card id belonging to another user is indistinguishable
  from a non-existent one). This is added as a new requirement rather than a
  rewrite of "list and open" so it does not clobber the in-flight
  `enhance-saved-cards-view` change, which rewrites that same requirement.

## Impact

- **Frontend routing** (`src/routes.tsx`): `EditorRoute` reads a `?card=<id>`
  query param; when `location.state` is absent but the param is present, it
  triggers a fetch of that card.
- **Frontend editor** (`src/App.tsx`): accepts a card id to load on mount (or
  the loading is lifted into `EditorRoute`); the editor's "which saved card am
  I" state (`savedCardId`) is seeded from the URL on reload, not just from
  navigation state.
- **Frontend library page** (`src/pages/SavedCardsPage.tsx`): the "open" action
  navigates to `/?card=<id>` in addition to passing `location.state`, so the URL
  carries the id from the first open (not only after a reload).
- **Frontend "back to editor" navigation**: clears the `?card=` param so it does
  not linger.
- **No backend changes.** The existing `GET /api/cards/:id` (authorized through
  `requireCardRole`, 404 for non-members) is reused unchanged.
- **No stored-shape changes.** This change does not alter the saved-card
  payload, so it does not touch the contract tests or the payload modules.

## Sequencing

Independent of `save-full-entry-pool` at the spec level, but the two compose:
once the entry pool is persisted, a refresh restores the *full* card (every
entry) rather than only the 24/25 that fit the grid. Recommended order is
**`save-full-entry-pool` first, then this change**, so reload-restore is
complete in one pass. If this change lands first, reload-restore is still
correct — it simply restores only the on-grid entries until the other change
ships. Both changes touch the editor load path but not the same lines.
