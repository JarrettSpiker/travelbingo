## Context

The account backend is a single DynamoDB table behind API Gateway HTTP API, where every entity is a `(PK, SK)` pair and every read/write of a card is authorized through one routine, `requireCardRole`, parametrized by role. The card data model and the shared-link model are the two precedents this change follows:

- `backend/src/lib/keys.ts` owns the table's key format, and the single-table membership design was built so "additional roles or shared resources can be added without restructuring existing data" — trips are exactly that case.
- `backend/src/routes/shares.ts` + `lib/shareToken.ts` (`putShareWithUniqueToken`) define the collision-retried opaque-token pattern trips reuse for invites.
- `backend/src/routes/cards.ts` defines the cascade-delete pattern (page the resource's partition, collect cross-partition keys, `deleteKeys`) and the denormalized-membership-for-single-query-listing pattern.
- `backend/src/lib/cardPayload.ts` is the validator: reject (never correct) untrusted payloads, with co-located contract tests mirrored in the frontend. A trip-card snapshot is a strict subset of this payload.
- On the frontend, account routes are additive and account-gated, and the signed-out editor makes zero API requests (`frontend/src/auth/AuthProvider.tsx` renders children immediately so auth never gates first paint).

See `proposal.md` for the motivation. This change adds a second resource type (trips) and a second role, reusing the above patterns rather than inventing new ones.

## Goals / Non-Goals

**Goals**
- Introduce trips, trip memberships, invite links, and trip-card snapshots as new key-prefixed entities in the **existing** single table — no new tables, no new GSIs.
- Authorize every trip operation through a single shared routine that mirrors `requireCardRole`, preserving the 404-on-missing-membership non-leak rule.
- Store trip cards as **render-only snapshots** (no editable entry pool), fully decoupled from the original card.
- Leave a stable seam for the *next* change (live gameplay) without implementing any of it now.
- Keep trips strictly additive: the signed-out editor and the frozen card renderer are untouched.

**Non-Goals**
- Live multiplayer gameplay, marking state, or winner detection — the next change.
- Live (non-snapshot) references to cards. Per the proposal, every add-to-trip snapshots.
- Transferring or relinquishing the administrator. An admin who wants out deletes the trip; admin transfer is a follow-up.
- Real-time delivery. Today's request/response Lambda is sufficient for organizing cards; gameplay will revisit transport.
- Any change to the saved-card shape, the card renderer, or the card contract tests.

## Decisions

### Decision: New key-prefix entities in the existing single table
Trips are added as new `(PK, SK)` shapes in `keys.ts`, parallel to the card shapes. No GSI: every access is either a primary-key Get, a PK + `begins_with(SK)` Query on a partition we already hold, or a cascade scan of a trip's own partition.

```
TRIP#<tripId>   META             ownerId, title, mode, startDate?, endDate?, createdAt, updatedAt
USER#<sub>      TRIP#<tripId>    role(admin|member), title, startDate?, endDate?, updatedAt   <- "my trips" listing row (title/dates denormalized, like cards)
TRIP#<tripId>   MEMBER#<sub>     role, createdAt                                            <- cascade-delete mirror
TRIP#<tripId>   TRIPCARD#<id>    snapshot{}, ownerId, assignedMemberId?, createdAt          <- render-only snapshot; assignedMemberId only in competitive trips
TRIP#<tripId>   INVITE#<token>   createdAt                                                  <- admin-facing pointer (list/revoke)
INVITE#<token>  META             tripId, title, createdAt, revokedAt?                       <- redemption record
```

This mirrors the card layout (`META`, membership + `MEMBER#` mirror, owner-facing pointer + standalone token record) so the existing listing/cascade/token patterns transfer directly. `title` (and the optional dates) are denormalized onto the `USER#` membership row for the same reason cards denormalize `title`: listing a user's trips stays a single Query with no per-trip lookup.

**Alternative considered:** a separate `Trips` table. Rejected — the single-table requirement explicitly anticipates new entity types as key prefixes, and a second table doubles the infra/Terraform surface for no gain.

### Decision: A sibling `requireTripRole`, not a generalized routine
Add `TripRole = "admin" | "member"` and a `requireTripRole(deps, userId, tripId, allowed)` that mirrors `requireCardRole` exactly: Get the `USER#<sub>` / `TRIP#<tripId>` membership, 404 if absent, 403 if the role is insufficient. Trip call sites pass `ADMIN_ONLY` or `ADMIN_OR_MEMBER` instead of `OWNER_ONLY`.

**Alternative considered:** generalize `requireCardRole` into a generic `requireRole(resourceType, …)`. Rejected: the card path is exercised by an existing test suite and feeds the frozen card behavior; routing it through a new abstraction risks that path for no real duplication savings (each routine is ~20 lines). Two siblings that share the `forbidden`/`notFound` HTTP helpers is the lower-risk choice.

### Decision: Trip cards are a render-only `TripCardSnapshot`
A trip card stores only what rendering, printing, PNG export, and (future) marking need: `slots`, `title`, `hasFreeSpace`, `freeSpaceText`, `colorScheme`, `fontScheme`, `emojiScheme`. It deliberately omits the editable `entries` pool, because a trip card is never re-opened in the editor and is never re-randomized. The snapshot is produced at add-time by projecting those fields off a validated `CardPayload`.

`assignedMemberId` rides on the same item (competitive trips only; absent in cooperative trips) and is the forward-compatible anchor for future per-member progress.

**Validation:** a new `backend/src/lib/tripPayload.ts` exposes `parseTripCardSnapshot` (the render-only subset) and `parseTripMeta`/`parseTripInput` (title, optional ISO dates with `start <= end`, mode allowlist). It reuses the exported constants already in `cardPayload.ts` (`MAX_SLOT_LENGTH`, `ALLOWED_FONTS`, the hex pattern, etc.) so the color/font/emoji/slot rules cannot drift from the card rules. The private per-field checkers in `cardPayload.ts` are left untouched (its behavior is frozen and contract-tested); `tripPayload.ts` re-applies the same rules against the shared constants.

**Decoupling from the original card:** the snapshot stores `ownerId` for attribution only — there is no foreign key to the card. `deleteCard` only scans `CARD#<cardId>` and its share/membership pointers, so deleting the original card never reaches trip-card items (which live under `TRIP#`). This is intentional: the trip keeps working, unchanged, even if the original card or its owner is gone.

**Alternative considered:** store the full `CardPayload` (including `entries`) for symmetry. Rejected — it bloats every trip-card item with data that is never read, and it would mislead future readers into thinking trip cards are editable.

### Decision: Invite links reuse the opaque-token pattern; invite *info* is public, *joining* is not
`POST /api/trips/{tripId}/invites` mints a token via the same collision-retried `putShareWithUniqueToken` shape used by share links (an `INVITE#<token>` pointer in the trip's partition plus an `INVITE#<token>` / `META` redemption record). `GET /api/invites/{token}` is a **public** route (like `resolveShare`) returning only `{ title, createdAt }` for a valid, unrevoked token, and 404 otherwise — so the `/invite/:token` landing page can show "You're invited to *Summer Road Trip*" before sign-in. This mirrors share links, where the unguessable token *is* the capability and the snapshot is served to anyone holding it.

`POST /api/invites/{token}/redeem` is **authenticated**: it creates the `USER#`/`TRIP#` membership (and the `MEMBER#` mirror), idempotently (redeeming as an existing member is a no-op, not a duplicate). Redemption enforces the per-trip member cap.

**Signed-out flow:** the `/invite/:token` route stores the destination and preserves it through the OAuth redirect (the app already preserves a return path across the Cognito callback for the card library; trips reuse that mechanism). On return, the now-signed-in user redeems automatically.

Revocation deletes the pointer and the redemption record; subsequent resolution is a 404 indistinguishable from "never existed." The admin-facing list comes from the `INVITE#` prefix query on the trip's partition.

### Decision: Per-trip mode stored once; assignment stored per card; visibility is trip-level
`mode` lives on the trip `META`. In cooperative trips, trip-card items simply omit `assignedMemberId`. In competitive trips, member-added cards are written with no `assignedMemberId` (unassigned pool); `PATCH /api/trips/{tripId}/cards/{tripCardId}` (admin only) sets/reassigns it, rejecting a target who is not a current member.

**Read authorization is trip-level, not card-level:** every member can read every trip card. The backend authorizes the trip membership once and returns all trip cards for that trip; there is no per-card membership check and no assignment-based filtering on reads. This realizes "all members see all cards; assignment only decides who plays."

### Decision: Bounds counted at operation time, mirroring `MAX_CARDS_PER_USER`
Three constants in `routes/trips.ts`, checked by counting the relevant items before the write (the same approach cards take at a cap of 200, where the count query is one page):

- `MAX_TRIPS_PER_USER` (proposed 50) — counted on trip create.
- `MAX_MEMBERS_PER_TRIP` (proposed 50) — counted on invite redeem.
- `MAX_TRIP_CARDS_PER_TRIP` (proposed 50) — counted on trip-card add.

A counter item would need its own transaction to stay consistent; counted queries are simpler and, at these caps, one page each.

### Decision: Cascade delete reuses the `deleteCard` paging pattern
`DELETE /api/trips/{tripId}` (admin only) pages the `TRIP#<tripId>` partition collecting every key. For each `MEMBER#<sub>` it also deletes the cross-partition `USER#<sub>` / `TRIP#<tripId>` listing row; for each `INVITE#<token>` pointer it also deletes the `INVITE#<token>` / `META` redemption record. All keys go through the existing `deleteKeys` batch helper. Trip-card snapshots live entirely inside the trip partition, so no cross-partition cleanup is needed for them.

Removing a single member (admin action) deletes that user's `USER#` listing row and the trip's `MEMBER#` mirror, and clears `assignedMemberId` on any trip cards assigned to them (a small update query, or a best-effort clear); it does **not** delete trip cards they added.

### Decision: Frontend routes are additive and account-gated
New routes: `/trips` (list), `/trips/new` (create), `/trips/:tripId` (detail — members, cards, invite management for admin, add/assign/remove for admin), and `/invite/:token` (public landing → prompt-to-sign-in → redeem). A "Trips" entry point appears in navigation only when signed in. All trip API calls live behind the existing auth-gated client; signed-out visitors never see the entry point and never issue a trip request, preserving the zero-requests-signed-out invariant.

## Risks / Trade-offs

- **Snapshots can drift from a card the owner "meant" to update.** → By design (frozen snapshots are the point, and gameplay needs a stable target). The spec makes "remove and re-add" the update path; the detail page surfaces the snapshot's `createdAt` and the adding member so staleness is visible.
- **An admin can strand a trip by leaving.** → Mitigated by refusing self-removal while they are the only admin (see spec). Admin transfer is deferred; until then, an admin who wants out deletes the trip.
- **Invite-info being public leaks the trip title to a token holder.** → Acceptable and consistent with share links: the token is unguessable and is the capability. Only `title` is exposed; members and cards require redemption + membership.
- **Counted bounds are not atomic with the write.** → Same trade-off as cards, acceptable at these caps; a concurrent pair of redeems could overshoot the member cap by one. Tolerable for a social feature; revisit only if abused.
- **Removing a member leaves their assigned cards pointing at a gone user.** → Cleared on removal (`assignedMemberId` unset → returns to the unassigned pool); the admin reassigns.
- **Two authorization routines (`requireCardRole`, `requireTripRole`) can drift.** → Mitigated by a shared test shape (both must 404-on-missing, 403-on-insufficient) and by keeping them small siblings rather than generalizing the frozen card path.

## Migration Plan

Additive and reversible. There is no data migration: trips are new key prefixes, invisible to existing card/share code paths.

1. Backend first: `keys.ts` trip helpers → `tripPayload.ts` validators (+ tests) → `auth.ts` `TripRole`/`requireTripRole` (+ tests) → `routes/trips.ts` (+ tests) → register routes in `router.ts`.
2. Infra: add the `/api/trips/*` and `/api/invites/*` route keys to the API Gateway HTTP API config in `infra/` (all authenticated except `GET /api/invites/{token}`, which is designated public, paralleling `GET /api/shares/{token}`). No new Lambda, table, or bucket.
3. Frontend: API client modules → pages → routes → navigation entry → invite-redemption-with-auth-preservation.
4. Deploy to dev (merge to `main` auto-deploys dev). Verify multi-user behavior with `scripts/dev-user.sh` to mint a second identity (Gmail plus-aliases yield the same `sub` and cannot be used).

Rollback is removing the routes and the navigation entry; existing card/share behavior is unaffected throughout.

## Open Questions

- **Gameplay transport.** Whether live gameplay will use polling, WebSocket APIs, or SSE. Deferrable: this change's schema (`tripCardId` as the stable progress anchor, assignment per card) is transport-agnostic.
- **Bound tuning.** 50/50/50 are first guesses; final numbers can be set as constants during implementation without touching the spec.
