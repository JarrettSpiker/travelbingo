## Context

The editor is reached via `EditorRoute` in `frontend/src/routes.tsx`. Today a
saved card is opened by `SavedCardsPage.handleOpen`, which calls
`getCard(api, cardId)` and then `navigate("/", { state: { card, cardId } })`.
`EditorRoute` reads that data out of React Router's `location.state` and passes
it to `App` as `initialCard` / `initialCardId`. Because `location.state` lives
only in memory, a browser reload discards it; `App`'s `useState` initializers
then see `null` and the editor comes back empty.

The editor's "which saved card am I editing" is held in `App` as `savedCardId`
(see `App.tsx:52`, seeded only from `initialCardId`). Reads of a saved card go
through `getCard` in `frontend/src/lib/cardsApi.ts`, which hits
`GET /api/cards/:id` — already authorized server-side by `requireCardRole`
(`backend/src/auth.ts`), which returns **404, not 403**, for a card the caller
has no membership for. That privacy guarantee is reused unchanged; this change
adds no new server surface.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- A reload of the editor while a saved card is open restores that card from the
  server by id.
- The open card is a first-class part of the URL from the *first* open (not only
  after a reload), so back/forward and bookmarks work.
- Zero API requests on a plain editor load (no card id) and for signed-out
  visitors — the existing signed-out invariant (`AGENTS.md`) is preserved.
- No backend change, no stored-shape change.

**Non-Goals:**
- Persisting *unsaved* editor edits across reload (local-storage draft restore
  is a separate concern; this change restores the last *saved* card).
- A new route or shareable "view" URL for saved cards — the param is on the
  existing editor route and is owner-gated, not a sharing mechanism. Sharing
  remains the server-backed share-link path.
- Restoring the card for a signed-out visitor (saved cards require an account).

## Decisions

### Decision: Carry the open card id in a query param, not a path segment
**Choice: `/?card=<id>` on the existing editor route.**
- Keeps the editor at `/` (every existing link to the editor stays valid) and
  avoids colliding with the `/cards` library route or introducing a new segment
  to wire into auth redirect URIs / CSP / the catch-all `*` redirect.
- The historical `?card=<base64>` URL-encoding mechanism was fully removed
  (AGENTS.md, archived `remove-card-url-sharing`); a bare card id is short and
  clearly distinguishable from that gone format, and that param is already
  documented as ignored, so reusing the name carries no live conflict.
- *Alternatives considered:* (1) a dedicated path like `/card/:id` — rejected as
  more routing surface (auth callback redirect URIs, catch-all behaviour) for
  no behavioral gain; (2) `sessionStorage` of the id — rejected because it
  fails for back/forward and bookmarks and is strictly less durable than the
  URL; (3) encoding the full card into the URL again — explicitly forbidden by
  the architecture.

### Decision: Keep `location.state` for the instant first paint; URL is the fallback
**Choice: Navigate with *both* `state: { card, cardId }` and `?card=<id>`.**
- On the initial open, the in-memory handoff is still the fastest path (no
  refetch); the editor paints immediately exactly as today. The URL param is
  there purely so a reload can recover.
- On reload, `location.state` is null but the URL carries the id; `EditorRoute`
  fetches via `getCard` and feeds the result into `App` as the `initialCard`,
  reusing the existing `cardStateFrom` path — no new state machine in `App`.
- *Consequence:* `App` gains a brief loading state for the reload case only
  (spinner while the fetch is in flight). The initial-open and empty cases keep
  their current zero-latency first paint.

### Decision: Where to perform the reload-fetch
**Choice: Fetch inside `EditorRoute` (or a thin wrapper), not inside `App`.**
- `App`'s `useState` initializers are synchronous and deliberately effect-free
  (the comment in `routes.tsx` notes App keeps initializers rather than gaining
  an effect). Doing the fetch in the route keeps that invariant: the route
  resolves "what card (if any) are we loading" — from `location.state` or by
  fetching on the id — and hands a resolved `CardUrlData | null` plus `cardId`
  down, so `App` stays a pure function of its props.
- *Alternative considered:* an effect inside `App` that reads the URL. Rejected
  because it breaks the "remount on incoming card" keying strategy and mixes
  data-fetching into the editor component.

### Decision: Clear the param when leaving for a fresh editor
**Choice: The editor's "back"/"new card" navigation target is bare `/`.**
- Existing "Back to the editor" / "Back to the card editor" buttons already
  navigate to `/`; ensuring they navigate to `/` *without* the `?card=` param
  (and without `location.state`) is what makes a subsequent reload land on the
  empty editor. No new UI control is needed.

### Decision: Auth-redirect preservation
**Choice: The Cognito redirect URI after sign-in returns the user to the
location they started from, param included.**
- Because the card id lives in the URL, the existing `signIn(targetPath)`
  pattern (which preserves the full path+query) already returns a signed-in
  user to the card they were trying to open. For a signed-out visitor hitting
  `/?card=<id>`, the spec requires no fetch and a sign-in prompt; after sign-in
  the redirect lands back on `/?card=<id>` and the reload-restore path runs.

## Risks / Trade-offs

- **[Card id in URL leaks via referrer/history]** → A card id in the address bar
  is a *reference*, not a capability: it is useless without the owner's
  membership, and `GET /api/cards/:id` returns 404 for everyone else. This is
  the same privacy posture the library already relies on for the id. Mitigation:
  none beyond the existing server-side check; document it. (If a user shares
  their address bar, they are sharing access to their own session, not the
  card.)
- **[Stale `?card=` lingers after the user navigates away]** → Mitigation: the
  "back to editor" navigations target bare `/`. The param is intentionally *not*
  scrubbed right after loading, since surviving reload is the point.
- **[Coordinate with `enhance-saved-cards-view`]** → That change also touches
  `SavedCardsPage.handleOpen` and the editor load path. Mitigation: this change
  is spec-additive (new requirement only, no rewrite of "list and open"), so
  there is no spec-clobber risk; implementation conflicts are line-level and
  resolved at apply time.
- **[Coordinate with `save-full-entry-pool`]** → That change alters what a
  reload restores (full pool vs. on-grid slots). The two are independent; order
  is a recommendation, not a dependency.

## Migration Plan

- Frontend-only; ships in a single deploy. No data migration, no infra change.
- Rollback: revert the frontend; the `?card=` param simply goes back to being
  ignored (its pre-existing behavior), and reload goes back to an empty editor.
  No server state to unwind.

## Open Questions
<!-- none -->
