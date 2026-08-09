## Why

Today a saved card is a private, single-owner object: the only way to put a card in front of other people is to mint a share link that hands each recipient an independent, disconnected copy. There is no notion of a *group* of people sharing a bingo experience around one event — a road trip, a holiday, a conference. Friends each build their own card in isolation, with no shared context, no assignment of "who's playing what," and no place to see the cards gathered together.

Trips fill that gap. A trip is a shared, account-scoped container that gathers members and bingo cards under a single title (and an optional date range), so a group can organize the cards for an event in one place. Membership is invitation-based and revocable; cards are added as frozen, render-only snapshots, so the trip keeps working even if the original card or its owner is later removed. Trips are strictly additive: the signed-out, account-free editor is untouched, and a signed-out visitor still makes zero API requests.

## What Changes

- A **new "Trips" resource type**: a signed-in user can create a trip (title + optional start/end date), and becomes its **administrator**. The creator is the trip's admin for its lifetime.
- **Trip membership** via **revocable invite links**: the admin mints an opaque, unguessable invite token (mirroring the existing share-link pattern). A signed-in visitor redeems it to join as a **member**. The admin can remove members at any time. Trip existence is never leaked to signed-out or non-member visitors.
- **A second authorization role and resource type** alongside today's card `owner` membership: trips introduce a `member`/`admin` role and a parallel `requireTripRole` check, extending the single shared-authorization rule that today only governs cards. A missing trip membership returns 404, identical to today's card non-leak rule.
- **Adding cards to a trip as frozen snapshots**: any member can add a card from their own library to the trip. A trip card stores a **render-only snapshot** (the on-grid `slots`, title, free-space, and the color/font/emoji schemes) — **not** the editable entry pool, because a trip card is never re-opened in the editor. The original card and the snapshot are fully decoupled: editing or deleting the original leaves the trip card intact, and removing a trip card never touches the owner's library.
- **A per-trip mode — cooperative or competitive** — set at creation. In **cooperative** trips every member plays every card together. In **competitive** trips the admin assigns each trip card to a specific member (cards added by members land in an unassigned pool first). **All members can see all cards in a trip regardless of assignment**; assignment only decides who plays which card, not who can see it. This is the forward-compatible seam for future live gameplay.
- **"My trips" listing**: a signed-in user can see every trip they are a current member of and reopen one, sorted by start date / recent activity. Leaving the signed-out editor untouched, all trip UI is account-gated and issues zero requests signed out.
- **Bounded resource usage**: per-user trip count, per-trip member count, and per-trip card count are each capped (mirroring the existing `MAX_CARDS_PER_USER` pattern), so one account cannot accumulate unbounded shared state.

## Capabilities

### New Capabilities
- `trips`: A shared, account-scoped container that gathers invited members and frozen bingo-card snapshots under a title and optional date range, with cooperative or competitive card assignment, admin-managed membership, and a per-user listing of ongoing trips.

### Modified Capabilities
- `backend-api`: The single-table membership model and the one shared authorization routine are extended to cover a second resource type (trips) and a second role (`member`, alongside the card `owner` role) — exactly the "shared resources can be added without restructuring" case the existing requirement anticipates. A new requirement bounds trip resource usage, paralleling the existing saved-card bound.

## Impact

- **Backend** (`backend/src/`): a new `routes/trips.ts` (trip CRUD, members, invites, trip cards), new `lib/tripPayload.ts` + a render-only `TripCardSnapshot` validator (a strict subset of `cardPayload.ts`), new trip key helpers in `lib/keys.ts`, a `requireTripRole` + `TripRole` addition to `auth.ts`, and route registration in `router.ts`. New entity types live as new key prefixes in the existing single DynamoDB table — **no new tables, no new GSIs**.
- **Frontend** (`frontend/src/`): new account-gated pages (`/trips`, `/trips/new`, `/trips/:tripId`) and an invite-redemption route (`/invite/:token`) that survives the OAuth callback; new API client modules in `src/lib/`; a "Trips" entry point in the app navigation shown only to signed-in users. The signed-out editor and the frozen card renderer are untouched.
- **Infra** (`infra/`): new API Gateway HTTP API routes for every `/api/trips/*` endpoint. No new compute, storage, or identity resources; invite tokens and trip cards are plain items in the existing table.
- **Contract tests**: the saved-card shape is untouched, so the two existing contract tests are unchanged. The new `TripCardSnapshot` type is mirrored across both packages with its own co-located tests, consistent with the repo's convention.
- **No backend dependencies added.** AWS SDK v3, esbuild, and the existing DynamoDB single-table model are sufficient.
- **Out of scope**: live multiplayer gameplay (marking squares, cross-member progress, winner detection), live (non-snapshot) card references, transferring or relinquishing admin, and any real-time delivery mechanism. Gameplay is intended as the *next* change; this change's data model deliberately leaves a stable seam for it (per-card snapshots carry a stable `tripCardId` that future per-member progress keys off).
