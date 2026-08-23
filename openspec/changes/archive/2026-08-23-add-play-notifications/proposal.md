## Why

With `add-card-progress` and `add-win-conditions` in place, a trip is playable and winnable — but only if you happen to be looking. Marks appear on a page that has to be open, and a win is a badge that sits quietly on a card until somebody scrolls past it. The social half of the feature is entirely missing: the moment where your phone tells you that Priya is one square from taking the trip, and you put down your coffee and start looking harder out of the window. A game whose events nobody learns about is a solitaire game played in the same room as other people.

The three things worth interrupting someone for are not equally interesting, and pretending they are is how notification features become things people turn off. A victory is worth telling everyone about, every time. A near-miss is the most exciting event in bingo and is rare enough to be safe to announce. An individual square being marked is neither — in a five-member trip it can fire dozens of times an hour, and mailing it to everyone would be indistinguishable from an attack. So the same event stream feeds two very different surfaces: a per-trip activity feed that shows everything to whoever cares to look, and a personal notification list that is deliberately quiet by default.

This change builds the whole event pipeline and the in-app half of delivery. Email is deliberately a separate change, because it drags in a mail service, domain signing records, a production support request, and an unsubscribe surface — a different shape of risk that should not be reviewed in the same breath as a badge on a bell icon.

## What Changes

- **Play emits events.** Recording a mark, a card becoming one square from the trip's target, and a card being won each produce an event carrying the trip, the card, the member responsible, and the time. Nothing else in the application emits events, and the shape is deliberately small.
- **A near-miss fires once, on the way in.** The one-square-away event is emitted on the transition into that state — not on every subsequent mark while the card sits there, and not again if the card leaves and re-enters the state through the same square being unmarked and remarked. Without that, a player idly toggling a square would page the whole trip.
- **Every trip gets an activity feed.** A bounded, most-recent-first list of what has happened in that trip, visible to every member, readable whether or not that member subscribes to anything. This is the "show me everything" surface, and it is pull, not push.
- **Every user gets a notification list.** A bell in the application header with an unread count, listing events from their trips that they have opted into. A notification names who did what, in which trip, and links to it.
- **Notifications are quiet by default.** Wins and near-misses are on; individual marks are off. A member can turn marks on if they want the play-by-play, and can mute a specific trip without affecting the others — the loud trip is usually one trip, not the whole account.
- **Notifications expire.** They are kept for a bounded period and then removed automatically, so a heavy user's list cannot grow without limit. The existing table's expiry mechanism, enabled but so far unused, becomes its first real consumer.
- **A member is never notified about their own action**, and a member who has left a trip stops receiving its events immediately.
- **Unchanged:** who may mark and when; what a win is and how it is recorded; the trip roles, invites, and card assignment; the card renderer, which gains nothing; the saved-card shape and both contract tests; and the signed-out experience, which still makes zero API requests and has no bell.

## Capabilities

### New Capabilities
- `notifications`: The events play produces, the per-trip activity feed and the per-user notification list they feed, the preferences that decide which of them reach a member, and the retention that keeps the list bounded.

### Modified Capabilities
- `user-settings`: A signed-in user's self-scoped settings grow beyond a display name to include notification preferences, read and written under the same identity-scoping rules.

## Impact

- **Backend** (`backend/src/`): a new `routes/notifications.ts` (list, mark-read, preferences); a new `lib/notificationEvents.ts` (event construction and the fan-out recipient rule); event emission folded into the existing mark handler in `routes/trips.ts`; new `EVENT#` and `NOTIF#` key helpers plus a `NOTIFPREFS` item in `lib/keys.ts`; route registration in `router.ts`. Fan-out reuses the existing batch writer in `lib/batch.ts`. New key prefixes in the existing single table — no new table, no new GSI, no migration.
- **Frontend** (`frontend/src/`): a notification bell and dropdown in `components/SiteHeader.tsx`; a preferences section on `pages/SettingsPage.tsx`; a per-trip activity feed on `pages/TripDetailPage.tsx`; a `lib/notificationApi.ts` client and `lib/notificationTypes.ts`. The unread count rides on the progress poll `add-card-progress` already established rather than adding a second timer.
- **Infra** (`infra/`): new API Gateway HTTP API route keys, all authenticated. The DynamoDB table's time-to-live attribute is already enabled — this change is its first consumer, so no Terraform change to the table itself.
- **CI/CD** (`.github/workflows/`): unchanged.
- **Contract tests**: unchanged. Nothing here touches the saved-card shape or `TripCardSnapshot`.
- **No dependencies added** in either package.
- **Out of scope**: email delivery of any kind, and everything it implies — a mail service, domain signing, bounce handling, and unsubscribe links (`add-email-notifications`); browser push notifications and service workers; real-time delivery, since the bell polls on the existing interval; digests or batching of events into a summary; an audit trail of unmarking, which is not interesting enough to notify anyone about; and notifications for anything outside play, such as an invite being redeemed or a member being removed.

**Depends on** `add-card-progress` for the marks and `add-win-conditions` for the win record and the distance-to-target that makes a near-miss statable.
