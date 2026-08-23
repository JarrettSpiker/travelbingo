import {
  DEFAULT_PREFERENCES,
  type NotificationEventType,
  type NotificationPreferences,
} from "./notificationPayload.ts";

// Pure event logic for play notifications: the near-miss edge trigger, the
// fan-out recipient rule, and the sort-id scheme. No DynamoDB, no HTTP —
// everything here is decidable from its arguments, which is what keeps the
// emission path in routes/trips.ts thin and this module unit-testable.
// Mirrored by hand into frontend/src/lib/notificationTypes.ts where the
// client needs the same vocabulary.

/**
 * Whether a mark announces "one square away". Edge-triggered: the event fires
 * only on the transition into the state — the distance was greater than one
 * before the mark and is exactly one after. Without that, every further mark
 * on a card sitting one away would re-announce it, and a player toggling a
 * square would page the whole trip. `Infinity` (unreachable) counts as
 * "greater than one", and a distance of 0 (won) never triggers.
 */
export function shouldEmitOneAway(distanceBefore: number, distanceAfter: number): boolean {
  return distanceBefore > 1 && distanceAfter === 1;
}

/**
 * The members to write notification items for: current members of the trip
 * the event occurred in, minus the actor (a member is never notified of their
 * own action), minus anyone who has muted this trip, minus anyone who has
 * opted out of this event kind. A member with no stored preferences falls
 * back to the defaults. Membership is decided by the caller from the trip's
 * live roster, so only ids in `memberIds` can ever be returned.
 */
export function recipientsFor(
  event: { type: NotificationEventType; tripId: string },
  memberIds: readonly string[],
  actorId: string,
  prefsByUser: ReadonlyMap<string, NotificationPreferences | undefined>,
): string[] {
  return memberIds.filter((memberId) => {
    if (memberId === actorId) return false;
    const prefs = prefsByUser.get(memberId) ?? DEFAULT_PREFERENCES;
    if (prefs.mutedTripIds.includes(event.tripId)) return false;
    return prefs.types[event.type];
  });
}

/**
 * The `<isoTs>#<rand>` sort suffix shared by EVENT# and NOTIF# keys: ISO
 * timestamps sort lexicographically, so a descending range query is
 * most-recent-first with no GSI, and the random tail keeps two events in the
 * same millisecond from colliding on the same sort key.
 */
export function newSortId(now: string, random: () => string): string {
  return `${now}#${random()}`;
}
