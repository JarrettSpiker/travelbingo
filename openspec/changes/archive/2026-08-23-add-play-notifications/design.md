## Context

`add-card-progress` put `markedSlots` and `progressUpdatedAt` on the `TRIP#<tripId>` / `TRIPCARD#<id>` item and added a polling `GET /api/trips/{tripId}/progress`. `add-win-conditions` added `winCondition` to the trip `META`, `wonAt`/`winnerId` to the trip-card item, and a pure `winCondition.ts` in both packages exposing `squaresFromWin`. This change is the first consumer of that last function, and the first thing in the repo that writes on behalf of users other than the caller.

The precedents it follows:

- `backend/src/lib/keys.ts` is the only module that knows the key format; new entity types are new key prefixes in the existing table, which `infra/dynamodb.tf` explicitly anticipates ("new entity types are new key prefixes and cost no Terraform/IAM change").
- `infra/dynamodb.tf` already enables a time-to-live attribute, `expiresAt`, and comments that it is unused. This change is its first consumer.
- `backend/src/lib/batch.ts` (`deleteKeys`) is the existing paged batch helper used by the cascade deletes in `routes/cards.ts` and `routes/trips.ts`.
- `backend/src/routes/profile.ts` and the `USER#<sub>` / `PROFILE` item are the pattern for a self-scoped, identity-derived settings resource, with `backend/src/lib/profilePayload.ts` as its reject-never-correct validator.
- `backend/src/routes/trips.ts:101` (`fetchDisplayNames`) resolves member display names lazily with one `BatchGetCommand` so renames never drift — notifications must do the same rather than denormalizing a name onto every event.
- `MAX_MEMBERS_PER_TRIP = 50` and the other caps in `routes/trips.ts` bound the fan-out.

See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals**
- Emit a small, closed set of play events on the write path that already exists, without adding a read to it.
- Give a trip an activity feed that every member can read, independent of anyone's preferences.
- Give a user a notification list that is quiet by default and that they control per event type and per trip.
- Bound the fan-out cost and bound the stored volume, using mechanisms already in the table.
- Leave a clean seam for `add-email-notifications` to hang delivery off, without building any of it.

**Non-Goals**
- Email, browser push, or any delivery outside the application. `add-email-notifications` and beyond.
- Real-time delivery. The bell refreshes on the polling interval `add-card-progress` established.
- Digesting or summarizing events. Each event is one row.
- Notifying about anything other than play — invites, removals, and card additions stay silent.
- An audit trail. The feed is bounded and expiring; it is not a record of who did what forever.
- Any change to the card renderer, the saved-card shape, or the two contract tests.

## Decisions

### Decision: Three event types, and a near-miss that is edge-triggered

| Type | Emitted when |
|---|---|
| `progress_marked` | A member marks a square (never on unmark) |
| `one_away` | A card **transitions into** being one square from the trip's target |
| `victory` | A win is recorded — the same moment `add-win-conditions` writes `wonAt` |

Unmarking emits nothing at all. It is not interesting, and announcing it would make undoing a misclick a social act.

`one_away` is the one that needs care. It fires on the *transition*, computed from `squaresFromWin` before and after the mark: emit only when the distance was greater than one before and is exactly one after. Without that edge trigger, every subsequent mark on a card that is sitting one away would re-announce it, and a player toggling a square back and forth would page the entire trip repeatedly. The pre-mark distance is computable without an extra read, because the handler already holds the trip card item it is about to update.

A card that is unmarked back out of the one-away state and then re-enters it does emit again. That is a real (if unlikely) re-announcement, and the alternative — a sticky "already announced" flag per card — adds a stored attribute and a reset rule to suppress an event that requires a member to deliberately toggle a square twice. Not worth it.

`victory` is emitted only where the win is *recorded*, so it inherits the `attribute_not_exists(wonAt)` guard from `add-win-conditions` and cannot fire twice for the same card.

**Alternative considered:** a generic `progress_changed` event with a payload the client interprets. Rejected — the recipient rule differs per type (marks are off by default, wins are on), so the type has to be a first-class field the fan-out can filter on.

### Decision: Two records per event, because the feed and the bell are different problems

A single event produces one **trip activity item** and zero or more **per-user notification items**:

```
TRIP#<tripId>   EVENT#<isoTs>#<rand>   type, actorId, tripCardId, detail{}, createdAt, expiresAt
USER#<sub>      NOTIF#<isoTs>#<rand>   type, tripId, tripTitle, actorId, tripCardId,
                                       createdAt, expiresAt
USER#<sub>      NOTIFREAD              readUpTo, updatedAt
```

(Read state is one read-up-to marker item per user rather than a `readAt` per notification — "mark all read" is then a single small write, and unread is any sort id greater than the marker.)

They answer different questions. The feed is "what has happened in this trip", scoped to one partition, read by anyone who opens the trip, and independent of preferences — a member who has muted a trip can still scroll its history. The bell is "what should I be told about", scoped to one user, spanning all their trips, and filtered by preferences at write time.

Deriving the bell from the feeds instead would mean querying up to `MAX_TRIPS_PER_USER = 50` partitions on every bell render. Deriving the feed from the notifications would mean it disappears for anyone who muted the trip. Two writes at emission time is much cheaper than either, and the write path is a human-speed action.

The `<isoTs>#<rand>` sort key gives most-recent-first ordering from a `ScanIndexForward: false` query with no GSI, and the random suffix keeps two events in the same millisecond from colliding. `tripTitle` is denormalized onto the notification because the bell must render without reading fifty trips; `actorId` is **not** resolved to a name at write time, because `fetchDisplayNames` already exists precisely so a rename never leaves stale names behind.

**Alternative considered:** one item, in the trip partition, with per-user read state stored elsewhere. Rejected — read state per user per event is the same fan-out with worse ergonomics.

### Decision: Fan-out is filtered at write time and bounded by the member cap

On emission the handler reads the trip's `MEMBER#` roster (already in the partition it is working in), removes the actor — **a member is never notified of their own action** — loads each remaining member's preferences, and writes notification items only for those subscribed to that type in that trip. Writes go through the existing `backend/src/lib/batch.ts` batch writer.

The worst case is bounded per *event* by `MAX_MEMBERS_PER_TRIP = 50`: 1 feed item + up to 49 notification items, which is two `BatchWriteItem` calls. A single mark can emit two events (a winning or near-missing mark still emits its `progress_marked`), so the per-request worst case is ~100 items across four calls. In practice it is far smaller, because `progress_marked` — the only high-frequency type — is off by default, so the common case for a mark is zero notification writes and one feed item.

Preferences are read with a single `BatchGetCommand` across the recipients' `NOTIFPREFS` keys, mirroring how `fetchDisplayNames` batches profile reads. A member with no preferences item gets the defaults.

**Fan-out failure is contained.** Emission happens after the mark has been durably written and never fails the mark: a member's square must land even if the notification write fails. Failures are logged and the request succeeds. This is the right trade for a game and the wrong one for anything transactional, which is why it is stated here rather than assumed.

**Alternative considered:** filtering at read time instead, writing to everyone. Rejected — it makes muting retroactive in the wrong direction (turning marks *off* would hide things you were already told about) and multiplies stored volume by the fraction of users who want the noisy type, which is most of them not wanting it.

### Decision: Preferences are their own item, not fields on the profile

```
USER#<sub>   NOTIFPREFS   types{ progress_marked: bool, one_away: bool, victory: bool },
                          mutedTripIds[], createdAt, updatedAt
```

Defaults, applied when the item is absent: `one_away` and `victory` on, `progress_marked` **off**. A five-member trip generates a `progress_marked` event every time anyone spots anything; defaulting it on would make the bell useless within an hour, and the first thing every user did would be to switch the feature off entirely rather than switch one type off.

It is a sibling of `USER#<sub>` / `PROFILE` rather than fields on it because the profile is a small, user-facing, contract-shaped thing that other features read for display, and because `add-email-notifications` will add channel state (a verified address, a delivery-disabled flag) that has no business on a display-name record.

`mutedTripIds` is a per-trip override rather than a per-trip preference item: the loud trip is normally one trip out of a handful, the list is bounded by `MAX_TRIPS_PER_USER = 50`, and a mute is a single small array element rather than a whole item to create and cascade-delete.

Endpoints: `GET /api/me/notification-preferences` and `PUT /api/me/notification-preferences`, scoped solely to the caller's verified `sub`, validated by a reject-never-correct parser in the shape of `backend/src/lib/profilePayload.ts`.

### Decision: Notifications and feed items expire, using the table's existing TTL

Both item types carry `expiresAt`, set at write time to roughly 90 days out. `infra/dynamodb.tf` already enables the TTL attribute and notes it is unused; this is its first consumer, so there is no Terraform change to the table.

Expiry is what makes the volume argument work. A user's `NOTIF#` items and a trip's `EVENT#` items both accumulate under a single partition key, and without expiry an active user's bell query would page through an ever-growing history to find the last twenty rows. It also matches what the data is: a feed of what is happening, not an audit log. Nothing in the application reads an event older than the feed shows, so nothing breaks when one disappears.

Reads are additionally bounded — the bell and the feed both use a `Limit` — because TTL deletion is asynchronous and can lag by days.

### Decision: A member who leaves a trip stops receiving its events immediately

Membership is checked at fan-out time from the trip's live `MEMBER#` roster, so a removed member is simply not a recipient of anything emitted afterwards. Notifications they already received stay in their list until they expire, which is correct — they were true when sent — but the links resolve to the existing trips 404, since `requireTripRole` is unchanged. The bell renders such an entry as no longer available rather than erroring.

Deleting a trip cascades its `EVENT#` items along with the rest of the partition through the existing `deleteKeys` path in `deleteTrip`; the per-user `NOTIF#` items live in other partitions and are deliberately left to expire rather than being chased across up to fifty user partitions inside a delete.

### Decision: The bell rides the existing poll; it does not add a timer

`add-card-progress` established a visibility-aware ~10s poll on the trip page. The unread count is returned alongside that response so an open trip refreshes the bell for free. Away from a trip page, the bell fetches its count on mount and after any action that could change it — the header is not a place to run a background timer, and a user not looking at a trip is not in a hurry.

Endpoints: `GET /api/me/notifications` (most-recent-first, `Limit`-bounded, with the unread count) and `POST /api/me/notifications/read` (mark all read up to a timestamp, which is one small write rather than one per row).

**Alternative considered:** a second independent poll for the bell. Rejected — two timers competing on the same page, and a background tab quietly requesting forever.

## Risks / Trade-offs

- **A mark's write path now does more work than the mark.** → Bounded: one roster read the handler already has, one batched preferences read, and up to two batch writes — and zero notification writes in the common case, since `progress_marked` is off by default. Emission runs after the mark is durable and never fails it.
- **Notification writes can fail silently.** → Deliberate, and stated in the spec: a member's square landing matters more than the announcement of it. Failures are logged, not surfaced to the actor, who did nothing wrong.
- **`one_away` can re-announce if a square is toggled off and back on.** → Accepted. Suppressing it needs a stored per-card flag and a reset rule, to prevent an event that requires deliberate double-toggling.
- **Concurrent cooperative marks can double-announce `one_away`.** → The pre-mark distance is read before the atomic set update, so a second member's mark landing in between can leave the stale before-distance claiming "further away than one", firing the edge trigger a second time. Same rarity and consequence class as the toggle re-announcement above (at most one extra notification), and fixing it would mean a conditional-update retry loop on a human-speed write path. Accepted.
- **Denormalized `tripTitle` on notifications goes stale when a trip is renamed.** → It is the label on a historical entry, and the link resolves to the current trip. Chasing renames across every recipient's notification history is a fan-out far larger than the one that created them. `actorId` is deliberately *not* denormalized, so names — the thing people actually notice — never go stale.
- **Expiry means the feed is not an audit log.** → By design, and the only thing that keeps the partitions bounded. Nothing reads an event older than the feed shows.
- **A muted trip still produces feed items nobody sees.** → One small write per event regardless of preferences. Making the feed conditional would mean the trip's history had holes depending on who was muted when.
- **This is the first code that writes on behalf of users other than the caller.** → Scoped tightly: the only thing written into another user's partition is a `NOTIF#` item, only for current members of a trip the caller is acting in, only for types they subscribed to. It cannot be steered by anything in the request body — the trip, the card, and the roster all come from stored state.

## Migration Plan

Additive and reversible. No data migration: `EVENT#`, `NOTIF#`, and `NOTIFPREFS` are new key prefixes, invisible to every existing code path, and an absent preferences item means the defaults.

1. Backend, storage and logic first: `lib/keys.ts` helpers (+ the layout comment) → `lib/notificationPayload.ts` (preferences validator, +tests) → `lib/notificationEvents.ts` (event construction, the edge-trigger rule, the recipient filter — all pure, +tests) → `routes/notifications.ts` (+tests) → emission wired into `markTripCardSlot` in `routes/trips.ts` (+tests) → `EVENT#` cascade in `deleteTrip` → route registration in `router.ts`.
2. Infra: new authenticated route keys in `infra/apigateway.tf`. No table change — the TTL attribute is already enabled.
3. Frontend: `lib/notificationTypes.ts` and `lib/notificationApi.ts` → bell and dropdown in `components/SiteHeader.tsx` → preferences on `pages/SettingsPage.tsx` → activity feed on `pages/TripDetailPage.tsx` → gallery entries.
4. Deploy to dev by merging to `main`. Verify fan-out with two identities from `scripts/dev-user.sh`.

Rollback is removing the routes, the bell, and the emission call. `EVENT#`, `NOTIF#`, and `NOTIFPREFS` items left behind are inert and expire on their own.

## Open Questions

- **Whether the retention period should be 90 days.** A number, changeable without a spec revision; it only needs to outlast a long trip.
- **Whether the feed should show unmarking after all.** Currently silent. If a group turns out to argue about squares being un-spotted, the event type exists to be added.
- **Whether `mutedTripIds` should invert into an allow-list for very active users.** Only worth revisiting if someone is in dozens of trips.
- **Whether a near-miss should name the square.** "One away — needs *a red convertible*" is more compelling than "one away", but it exposes a specific card's contents in a notification, which is a visibility question competitive trips may care about.
