## 1. Backend storage and pure logic

- [ ] 1.1 Add key helpers to `backend/src/lib/keys.ts`: `tripEventKey(tripId, sortId)`, `userNotificationKey(userId, sortId)`, `notificationPrefsKey(userId)`, plus `EVENT_SK_PREFIX`, `NOTIF_SK_PREFIX`, and `sortIdFromNotificationSk`. Extend the table-layout comment at the top of the file with the three new shapes.
- [ ] 1.2 Create `backend/src/lib/notificationPayload.ts`: `NotificationEventType = "progress_marked" | "one_away" | "victory"`, the `NotificationPreferences` shape (`types` record plus `mutedTripIds`), `DEFAULT_PREFERENCES` (`one_away` and `victory` on, `progress_marked` **off**), and `parseNotificationPreferences` — reject-never-correct, in the shape of `backend/src/lib/profilePayload.ts`, with a bound on `mutedTripIds` matching `MAX_TRIPS_PER_USER`. Co-locate `notificationPayload.test.ts`.
- [ ] 1.3 Create `backend/src/lib/notificationEvents.ts`, pure and with no DynamoDB: `shouldEmitOneAway(distanceBefore, distanceAfter)` implementing the edge trigger (emit only when `distanceBefore > 1 && distanceAfter === 1`); `recipientsFor(event, memberIds, actorId, prefsByUser)` returning the members to write notification items for, excluding the actor, non-members, mutes, and unsubscribed types; and `newSortId(now, random)` producing the `<isoTs>#<rand>` sort suffix. Co-locate `notificationEvents.test.ts` covering the edge trigger in both directions, actor exclusion, mute, per-type opt-out, a member with no stored preferences falling back to the defaults, and an empty recipient set.

## 2. Backend emission

- [ ] 2.1 In `backend/src/routes/trips.ts`, compute `squaresFromWin` **before** applying the mark (the handler already holds the trip card item) and again after, so `shouldEmitOneAway` has both distances with no extra read.
- [ ] 2.2 Emit events at the end of `markTripCardSlot`, after the mark and any win record are durably written: one `EVENT#` item in the trip partition per event, and `NOTIF#` items for the recipients from `recipientsFor`, written through the existing batch helper in `backend/src/lib/batch.ts`. Read the member roster from the `MEMBER#` items and the recipients' preferences with a single `BatchGetCommand`, mirroring `fetchDisplayNames` (`routes/trips.ts:101`). Set `expiresAt` on every written item for the retention window.
- [ ] 2.3 Wrap emission so that a failure is logged and swallowed: the mark and any recorded win must stand, and the caller must not see an error for a notification that could not be written. Log without the event's card text.
- [ ] 2.4 Confirm `unmarkTripCardSlot` emits nothing, and that a mark completing the win condition emits `victory` and **not** `one_away`.
- [ ] 2.5 Extend `deleteTrip`'s cascade in `backend/src/routes/trips.ts` to include the trip's `EVENT#` items — they are in the trip partition the cascade already pages. Per-user `NOTIF#` items are deliberately left to expire rather than chased across up to fifty user partitions.

## 3. Backend notification routes

- [ ] 3.1 Create `backend/src/routes/notifications.ts`: `listNotifications` (caller's partition, `begins_with(SK, "NOTIF#")`, `ScanIndexForward: false`, `Limit`-bounded, returning entries plus an unread count), `markNotificationsRead` (one write recording a read-up-to timestamp rather than one write per row), `getNotificationPreferences` (defaults when the item is absent), and `updateNotificationPreferences`. Every one scoped solely to the verified `sub` via `requireUser`.
- [ ] 3.2 Create `backend/src/routes/tripActivity.ts` or add `getTripActivity` to `routes/trips.ts`: `requireTripRole(…, ADMIN_OR_MEMBER)`, one `begins_with(SK, "EVENT#")` Query on the trip partition, `ScanIndexForward: false`, `Limit`-bounded. It must return the feed regardless of the caller's preferences or mutes.
- [ ] 3.3 Resolve actor display names lazily at read time with the existing `fetchDisplayNames` batch helper rather than denormalizing a name onto any event or notification, so a rename never leaves stale names behind.
- [ ] 3.4 Include the unread count on the `GET /api/trips/{tripId}/progress` response from `add-card-progress`, so an open trip page refreshes the bell on the existing poll rather than running a second timer.
- [ ] 3.5 Co-locate `backend/src/routes/notifications.test.ts` and extend `backend/src/routes/trips.test.ts`: the actor receives no notification while other members do; defaults notify on win and near-miss but not on a mark; enabling marks changes that; a muted trip is silent while another trip is not; a removed member receives nothing further; a newly joined member receives only subsequent events; the feed is visible to a muted member; a non-member's feed request is a 404, not a 403; the edge trigger fires once across a run of marks; deleting a trip removes its `EVENT#` items; a fan-out failure leaves the mark recorded and the response successful.
- [ ] 3.6 Register the routes in `backend/src/router.ts`: `GET /api/me/notifications`, `POST /api/me/notifications/read`, `GET /api/me/notification-preferences`, `PUT /api/me/notification-preferences`, `GET /api/trips/{tripId}/activity`. All authenticated, none `public`.
- [ ] 3.7 Run `npm run lint && npm test && npm run build` in `backend/`; all must pass.

## 4. Infra

- [ ] 4.1 Add the five route keys to `infra/apigateway.tf`, all carrying the Cognito authorizer. **No change to `infra/dynamodb.tf`** — the `expiresAt` time-to-live attribute is already enabled there and this change is simply its first consumer.
- [ ] 4.2 `terraform plan` against dev shows API Gateway route additions only.

## 5. Frontend

- [ ] 5.1 Create `frontend/src/lib/notificationTypes.ts` hand-mirroring the backend shapes, and `frontend/src/lib/notificationApi.ts` over the existing `apiClient`, with a co-located test using the injected-`fetch` pattern from `tripApi.test.ts`.
- [ ] 5.2 Add a notification bell with an unread badge and a dropdown list to `frontend/src/components/SiteHeader.tsx`, shown only when signed in. Fetch the count on mount and after any action that could change it; consume the count returned by the trip progress poll when a trip page is open. Do **not** add a second background timer.
- [ ] 5.3 Render a notification that points at a trip the user can no longer open as no longer available rather than as an error.
- [ ] 5.4 Add a notification-preferences section to `frontend/src/pages/SettingsPage.tsx`: a toggle per event type and a mute list over the user's trips, showing the defaults in effect for a user who has never saved.
- [ ] 5.5 Add a bounded, most-recent-first activity feed to `frontend/src/pages/TripDetailPage.tsx`, visible to every member including one who has muted the trip.
- [ ] 5.6 Add gallery entries in `frontend/src/dev/gallery/registry.tsx` for the bell (zero, some, and many unread), the dropdown (empty, populated, containing an unavailable trip), the preferences section, and the activity feed (empty and populated).

## 6. Verification

- [ ] 6.1 `npm run lint && npm test && npm run build` pass in **both** `frontend/` and `backend/`.
- [ ] 6.2 Visual QA via `npm run capture -- /settings`, `/trips/:tripId`, and any route showing the header, in light and dark at 390px and 1440px, with unread notifications present.
- [ ] 6.3 Confirm `npm run capture -- /` reports zero `/api/` requests signed out and renders no bell.
- [ ] 6.4 Confirm the card renderer is untouched: `cardGrid.guard.test.ts` passes unchanged and `CardGrid.tsx`/`App.css` carry no diff from this change.
- [ ] 6.5 Multi-member verification in dev with `scripts/dev-user.sh`: member A marks squares and member B sees no notifications under the defaults; B enables marks and then does; A reaches one square away and B is notified exactly once across several further marks; A wins and B is notified; A receives nothing about their own actions but sees them all in the trip's activity feed; B mutes the trip and the feed still shows everything while the bell goes quiet; the admin removes B and a subsequent event produces nothing for them, while B's earlier notification resolves as unavailable.
- [ ] 6.6 Confirm the saved-card contract tests are unchanged.
