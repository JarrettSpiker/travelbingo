## 1. Backend data model and validation

- [x] 1.1 Add trip key helpers to `backend/src/lib/keys.ts`: `tripMetaKey`, `tripMembershipKey`, `tripMemberKey` (cascade mirror), `tripCardKey`, `tripInvitePointerKey`, `inviteKey`, plus `TRIP_SK_PREFIX`, `MEMBER_SK_PREFIX` reuse, `TRIPCARD_SK_PREFIX`, `INVITE_SK_PREFIX`, and `tripPartition`/`tripIdFromMembershipSk`/`tokenFromInvitePointerSk` accessors. Keep the table-layout comment at the top of the file in sync with the new shapes.
- [x] 1.2 Create `backend/src/lib/tripPayload.ts`: `TripMode` type (`"cooperative" | "competitive"`), `TripCardSnapshot` interface (render-only subset of `CardPayload`: `slots`, `title`, `hasFreeSpace`, `freeSpaceText`, `colorScheme`, `fontScheme`, `emojiScheme`), and `parseTripCardSnapshot` / `parseTripInput` (title bounds, optional ISO `startDate`/`endDate` with `start <= end`, `mode` allowlist). Reuse the exported constants from `cardPayload.ts` (`MAX_SLOT_LENGTH`, `MAX_TITLE_LENGTH`, `ALLOWED_FONTS`, the hex pattern, emoji/slot caps) so the rules cannot drift.
- [x] 1.3 Co-locate `backend/src/lib/tripPayload.test.ts` covering: empty/oversized title, out-of-order dates, malformed dates, unsupported mode, snapshot missing each render field, snapshot with an `entries` field (must be ignored/rejected appropriately), and a valid snapshot round-trip.

## 2. Backend authorization

- [x] 2.1 Extend `backend/src/auth.ts`: add `TripRole = "admin" | "member"`, `ADMIN_ONLY` and `ADMIN_OR_MEMBER` role arrays, and `requireTripRole(deps, userId, tripId, allowed)` mirroring `requireCardRole` (Get the `USER#`/`TRIP#` membership, 404 if absent, 403 if role insufficient, return the membership).
- [x] 2.2 Co-locate `backend/src/auth.test.ts` additions (or a sibling `auth.trips.test.ts`) asserting: missing membership → 404; member vs admin role enforcement; role is derived only from the membership item.

## 3. Backend trip routes

- [x] 3.1 Create `backend/src/routes/trips.ts`. Implement trip lifecycle: `listTrips` (single Query on the caller's `USER#` partition, `begins_with(SK, "TRIP#")`, denormalized title/dates returned), `createTrip` (validate, count memberships against `MAX_TRIPS_PER_USER`, TransactWrite trip META + admin membership + admin MEMBER mirror), `getTrip` (admin-or-member; return meta + members + cards + admin's outstanding invites when caller is admin), `updateTrip` (admin only; title/dates), `deleteTrip` (admin only; cascade — page the `TRIP#` partition, collect cross-partition membership rows and invite records, `deleteKeys`). Refuse self-removal-of-only-admin inside delete/remove paths.
- [x] 3.2 Implement members + invites: `createInvite` (admin; reuse `putShareWithUniqueToken` shape for collision-retried token, write `INVITE#` pointer + `INVITE#`/`META` redemption record carrying `tripId`/`title`), `listInvites` (admin; `INVITE#` prefix query), `revokeInvite` (admin; delete pointer + record), `resolveInvite` (**public**; returns `{ title, createdAt }` for valid/unrevoked, else 404), `redeemInvite` (**authenticated**; idempotent membership create, enforce `MAX_MEMBERS_PER_TRIP`), `removeMember` (admin; delete the user's `USER#` row + the trip's `MEMBER#` mirror; clear `assignedMemberId` on their assigned cards; refuse if it would strand the trip).
- [x] 3.3 Implement trip cards: `addTripCard` (admin-or-member; `requireCardRole` on the source `cardId` with `OWNER_ONLY` so only a card owner can snapshot it, project the render-only `TripCardSnapshot` from the fetched card meta, count against `MAX_TRIP_CARDS_PER_TRIP`, write `TRIPCARD#<id>` with `ownerId`; in competitive trips store without `assignedMemberId`), `removeTripCard` (admin only), `assignTripCard` (admin only; competitive trips only; reject target who is not a current member; set/reassign `assignedMemberId`). All reads return every trip card to every member (no assignment-based filtering).
- [x] 3.4 Co-locate `backend/src/routes/trips.test.ts` using the existing in-memory fake `Deps` pattern: multi-user scenarios (admin vs member vs non-member vs signed-out), 404 non-leak for non-members, 403 for insufficient role, invite mint/redeem/revoke idempotency and unknown-vs-revoked indistinguishability, snapshot decoupling (edit/delete original does not change trip card), competitive assignment + non-member-target rejection, cooperative has-no-assignment, bounds enforcement, cascade delete completeness, and the signed-out `resolveInvite`-public / everything-else-authenticated split.

## 4. Backend wiring

- [x] 4.1 Register all trip routes in `backend/src/router.ts`'s `ROUTES` map: `GET/POST /api/trips`, `GET/PATCH/DELETE /api/trips/{tripId}`, `POST /api/trips/{tripId}/invites`, `GET /api/trips/{tripId}/invites`, `DELETE /api/trips/{tripId}/invites/{token}`, `DELETE /api/trips/{tripId}/members/{userId}`, `POST /api/trips/{tripId}/cards`, `PATCH/DELETE /api/trips/{tripId}/cards/{tripCardId}`, `GET /api/invites/{token}` (marked `public: true`), `POST /api/invites/{token}/redeem`. Mirror the existing route-key comments.
- [x] 4.2 Run `npm run lint && npm test && npm run build` in `backend/`; all must pass.

## 5. Infra

- [x] 5.1 Add the new route keys to the API Gateway HTTP API configuration in `infra/`, all carrying the Cognito authorizer **except** `GET /api/invites/{token}`, which is designated public (parallel to `GET /api/shares/{token}`). No new Lambda, DynamoDB table, bucket, or Cognito change.
- [ ] 5.2 `terraform plan` against dev confirms only the API Gateway route additions; no destructive diffs to the `prevent_destroy` DynamoDB table or user pool.

## 6. Frontend types and API client

- [x] 6.1 Create the shared frontend types mirroring the backend: `frontend/src/lib/tripTypes.ts` (`Trip`, `TripMode`, `TripCardSnapshot`, `TripMember`, `Invite`). Keep them aligned with `backend/src/lib/tripPayload.ts` by hand-mirroring (the repo's convention for cross-package types).
- [x] 6.2 Create `frontend/src/lib/tripApi.ts` client functions for every trip endpoint, using the existing auth-gated fetch wrapper used by the card library/share-link clients. Add a co-located `tripApi.test.ts` or unit-test any pure helpers.
- [x] 6.3 Ensure no trip module is imported by any signed-out code path; confirm trip API calls only fire behind the auth check (preserving the zero-requests-signed-out invariant).

## 7. Frontend pages and routing

- [x] 7.1 Create `TripsPage` (`/trips`): lists the signed-in user's trips (title, dates, role), with create affordance and loading/empty/error states.
- [x] 7.2 Create `TripFormPage` (`/trips/new` and edit mode): title, mode (cooperative/competitive), optional start/end dates, with inline validation matching the backend rules (empty title, end-before-start).
- [x] 7.3 Create `TripDetailPage` (`/trips/:tripId`): members list, trip cards grid (all cards visible to all members), and admin-only controls (invite mint/list/revoke, remove member, remove card, assign/reassign in competitive trips, edit trip, delete trip). Member controls: add a card from their library (snapshots) and a "copy to my library" affordance on a trip card. Surface each trip card's `createdAt`/adding-member so snapshot staleness is visible.
- [x] 7.4 Create `InvitePage` (`/invite/:token`): public landing showing the trip title; if signed-out, prompt to sign in preserving the token through the OAuth callback (reuse the app's existing return-path mechanism), then auto-redeem on return; if signed-in, redeem and route to the trip.
- [x] 7.5 Register the four routes in `frontend/src/routes.tsx`, all guarded by the signed-in check except `/invite/:token`'s public-landing branch. Add a "Trips" navigation entry visible only when signed in.
- [x] 7.6 Add a gallery entry for each new component in `frontend/src/dev/gallery/registry.tsx` (and any new states) so `coverage.test.ts` stays green — required by the repo's definition of done. (No new `src/components/*.tsx` files were added: trip UI is composed from existing components inside `src/pages/`, so `coverage.test.ts` passes with no registry change.)

## 8. Verification

- [x] 8.1 `npm run lint && npm test && npm run build` pass in **both** `frontend/` and `backend/`.
- [ ] 8.2 Visual QA via `npm run capture -- /trips`, `/trips/new`, `/trips/:tripId`, and `/invite/:token` in light and dark at 390px and 1440px; confirm the signed-out capture reports zero `/api/` requests on `/` and no "Trips" entry point.
- [ ] 8.3 Multi-user verification in dev using `scripts/dev-user.sh` to create a second identity: admin creates trip, mints invite, second user redeems, both add cards, admin assigns (competitive) and removes, admin removes a member and confirms the removed user's trip disappears from their list while added cards remain.
- [x] 8.4 Confirm the frozen card renderer and `App.css` are untouched (`cardGrid.guard.test.ts` passes unchanged) and the saved-card contract tests are unchanged.
