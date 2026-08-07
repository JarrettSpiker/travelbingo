## Context

The account backend is a single DynamoDB table whose key layout `backend/src/lib/keys.ts` owns, where every entity is a `(PK, SK)` pair. That file already declares a profile shape that nothing in the codebase has ever read or written:

```
USER#<sub>   PROFILE   email, googleSubject, createdAt, lastSeenAt
```

`profileKey(userId)` exists and is exported. So the storage seam for a per-user profile is already in place and already anticipated by the single-table design ("new entity types as key prefixes, without provisioning new storage"). This change makes the first real use of it.

Two more existing patterns this change reuses rather than invents:

- **Identity is established exactly once**, in `backend/src/auth.ts` `getUserId`, from the `sub` claim API Gateway's authorizer already verified. Every route derives the caller from that and ignores any user id in the body/path/query.
- **Persisted state is validated, never corrected.** `backend/src/lib/cardPayload.ts` rejects untrusted payloads rather than defaulting them — the opposite of the account-free URL decoder. The display name follows the same rule.

See `proposal.md` for motivation. On the frontend, the identity surface is a single line — `frontend/src/components/AuthMenu.tsx` shows `{email ?? "Account"}` — and the architectural constraint that auth effects live only in `frontend/src/auth/AuthProvider.tsx` decides where the profile fetch goes.

## Goals / Non-Goals

**Goals**
- Make the first use of the existing `profileKey`: a per-user profile whose initial field is a display name.
- Authorize the profile by the caller's own verified identity alone — no membership, no per-endpoint check.
- Surface the display name in the account menu (falling back to email), and give the user a `/settings` page to set and clear it.
- Leave a clean seam so future settings (notification preferences for trips, etc.) extend the same profile and page without restructuring.

**Non-Goals**
- Notification preferences, trip preferences, or any setting other than the display name. The page is structured to admit them later; none ship now.
- Surfacing the display name on trip members. That is the `add-trips` change's concern and reads the same profile field; this change establishes the field and the account-menu display only.
- Denormalizing the display name onto card/trip membership listing rows. The profile is the source of truth; listings continue to show the title. (Cards have no per-user label today, so this is not a regression.)
- Any change to sign-in/session behavior, the editor, the frozen card renderer, the saved-card shape, or the contract tests.

## Decisions

### Decision: The profile lives at the existing `USER#<sub>` / `PROFILE` key
Store `displayName`, `createdAt`, and `updatedAt` on the profile item that `profileKey` already points at. Update the layout comment at the top of `keys.ts` to match the fields actually stored. No new table, no GSI, no new partition shape — `USER#<sub>` is already a partition the cards code queries, and `PROFILE` is already a reserved sort key there.

**Alternative considered:** a new `SETTINGS#`/`PROFILE#` sort-key prefix or a separate `USERSETTINGS#<sub>` partition. Rejected — the `PROFILE` SK is already declared for exactly this, and adding a second shape for the same concept would be the kind of drift the single-table rule exists to prevent.

### Decision: Authorization is identity-keyed, not membership-keyed
The profile routes do **not** go through `requireCardRole` (or a sibling). The profile key is built from `getUserId(claims)` — the caller's own verified `sub` — so a user can only ever read or write `USER#<own-sub>/PROFILE`. The key *is* the authorization; there is no resource to be a "member" of.

This is a deliberate, bounded exception to the "every resource access through one shared check" requirement in `backend-api`. That requirement governs *shared* resources (cards, trips) where one user can hold a role on another user's object. A self-profile is not shared: there is no second user, no role to check, and no membership to leak. Routing it through `requireCardRole` would be meaningless (the caller is always the "owner" of their own identity) and would suggest a shared-resource semantics the profile does not have. The `backend-api` requirements that *do* apply — identity from verified credentials only, untrusted payloads validated, single table by key prefix — are all satisfied unchanged.

Routes use `/api/me/profile` (not `/api/users/{id}/profile`) so a user id never appears in the URL, reinforcing that the id is never a request input.

**Alternative considered:** a generic `requireSelf`/`requireProfileRole`. Rejected as ceremony over `getUserId` — it would wrap a single non-conditional check and add a second authorization abstraction to maintain for no safety gain.

### Decision: `GET` returns an empty profile when no item exists; `PUT` upserts
`GET /api/me/profile` returns `200` with `{ displayName: null }` when no profile item exists — not `404`. A profile is implied by the account; the absence of a stored item just means "no display name set." This means the profile is written lazily, on the first `PUT`, and sign-in never needs to create one.

`PUT /api/me/profile` takes `{ displayName }`, validates it, and writes the whole profile document: `createdAt` is set on first write and preserved on update; `updatedAt` is always refreshed. The response is the new profile, so the client updates its cached state from the server's view rather than echoing the request.

**Alternative considered:** `PATCH` for partial updates. Rejected as premature — with one field, full replacement is unambiguous, and the profile reads naturally as a single self-owned document. When notification preferences arrive they ride on the same `PUT` body (or the route is revisited then); the spec describes the observable read/write behavior, not the verb.

### Decision: A new `profilePayload.ts` validator, mirroring `cardPayload.ts`
`backend/src/lib/profilePayload.ts` exports `MAX_DISPLAY_NAME_LENGTH` (proposed **50**) and `parseDisplayName(input)`: reject non-strings and values over the bound with `400`; trim; treat an empty-after-trim value as `null` (clear). Co-locate `profilePayload.test.ts` covering null/empty/oversized/non-string/whitespace-only and a valid round-trip, mirroring how `cardPayload.test.ts` exercises its validator.

The frontend mirrors `MAX_DISPLAY_NAME_LENGTH` as a constant (with a comment that it mirrors the backend) so client-side validation cannot drift past the server's bound. Unlike the saved-card shape, a single bounded string does not warrant a cross-package contract test; the mirrored constant with a comment is the proportionate safeguard.

### Decision: The profile is fetched once per signed-in session, inside `AuthProvider`
The profile fetch lives in the auth-resolution effect already in `frontend/src/auth/AuthProvider.tsx` — it fires once, after authentication resolves, and stores `displayName` in the auth context alongside `email`. This satisfies two constraints at once: the display name is app-wide (the account menu, the settings page, and future trip-member labels all read one source), and the auth-effect-only-in-`AuthProvider` rule is respected (the fetch never moves into `App.tsx`).

The fetch is non-blocking and non-fatal: until it resolves, or if it fails transiently, `displayName` is `null` and the menu falls back to the email from the ID token. It is issued only on the authenticated path, so the signed-out zero-requests-on-load invariant is untouched.

The context exposes a way to update the cached profile (the settings page calls it after a successful save), so the account menu reflects a new display name without a page reload — the scenario the spec requires.

**Alternative considered:** fetch the profile lazily on the settings page only. Rejected — the account menu is on every page and must show the display name, so a lazy fetch would either leave the menu showing stale email on other pages or duplicate the fetch per page.

### Decision: `AuthMenu` prefers display name, then email, then a fallback
`AuthMenu.tsx`'s trigger becomes `{displayName ?? email ?? "Account"}`, and the dropdown gains a "Settings" item (alongside "My saved cards") naviging to `/settings`. The settings page itself is account-gated (redirects signed-out visitors, like `/cards`) and issues zero requests when signed out.

## Risks / Trade-offs

- **A profile fetch is added to every signed-in session start.** → One extra request per authenticated load, never made signed out. Acceptable: authenticated users already make requests (token refresh, card fetches), and the fetch is non-blocking. The fallback to email means a slow or failed profile fetch degrades to today's behavior, not an error.
- **A second authorization pattern (identity-keyed) alongside the membership routine could drift.** → Bounded to `/api/me/*` and documented here; the membership routine still governs every *shared* resource. Drift is also bounded by the spec scenario "a profile write cannot target another user," which pins the identity-only behavior.
- **The display name is user-controlled text that trips will show to other members.** → Rendered as text (React escapes it), and the length bound caps abuse. No HTML is ever interpreted.
- **No cross-package contract test for the display-name bound.** → A single bounded string is far lower risk than the card shape; the mirrored constant + comment is proportionate, and the backend rejects anything over the bound regardless of what the client allowed.

## Migration Plan

Additive and reversible. The `PROFILE` sort key is already declared; this change merely writes to it for the first time. No existing data is read or migrated.

1. **Backend:** `lib/profilePayload.ts` (+ test) → `routes/profile.ts` (`getProfile`, `updateProfile`, both identity-keyed via `getUserId`) → register `GET /api/me/profile` and `PUT /api/me/profile` in `router.ts`; update the `keys.ts` layout comment.
2. **Infra:** add the two authenticated route keys to the API Gateway HTTP API config (both behind the existing Cognito authorizer). `terraform plan` against dev should show only those route additions.
3. **Frontend:** `lib/profileApi.ts` client → profile fetch + `displayName`/updater in `AuthProvider`/`authContext` → `SettingsPage` at `/settings` → route + "Settings" nav/menu entry → `AuthMenu` display-name line → gallery entry.
4. **Deploy to dev** (merge to `main` auto-deploys dev). Verify signed out: zero `/api/` requests on `/` and no "Settings" entry. Verify signed in: set/clear a display name, confirm the menu updates without a reload.

Rollback is removing the two routes and the nav entry; existing card/share/session behavior is unaffected throughout.

## Open Questions

- **Display-name length bound.** 50 is a first guess for a short human label; the final number is a constant tunable during implementation without touching the spec.
- **Whether to also seed `email` on the profile item at first write** (for future admin/debug, since it already lives in the ID token). Deferable — not needed to display a name, and YAGNI until a second consumer wants it.
