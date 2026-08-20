import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { badRequest, json, unauthorized, type JsonResponse } from "../http.ts";
import { fetchDisplayNames } from "../lib/displayNames.ts";
import { NOTIF_SK_PREFIX, notificationPrefsKey, notificationReadKey, sortIdFromNotificationSk, userPartition } from "../lib/keys.ts";
import {
  NOTIFICATION_PAGE_LIMIT,
  notificationReadUpTo,
  queryLatestByPrefix,
  unreadNotificationCount,
} from "../lib/notificationQueries.ts";
import {
  parseNotificationPreferences,
  preferencesFromItem,
  type NotificationPreferences,
} from "../lib/notificationPayload.ts";
import type { RouteRequest } from "../request.ts";

// The bell: a per-user notification list, its read marker, and the preferences
// that decide which events reach it at fan-out time. Every handler is scoped
// solely to the caller's verified `sub` — there is no user id in any path,
// body, or query to ignore, because the key is built from the credential and
// nothing else. The shared query helpers live in lib/notificationQueries.ts.

interface PreferencesItem extends NotificationPreferences {
  createdAt?: string;
  updatedAt?: string;
}

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

/**
 * The caller's notification list, most-recent-first, with the unread count.
 * Actor names are resolved at read time (never denormalized) so a rename never
 * leaves a stale name behind. Trip titles are the values stored at emission —
 * historical labels, not live reads of fifty trips.
 */
export async function listNotifications(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);

  const [items, readAt] = await Promise.all([
    queryLatestByPrefix(deps, userPartition(userId), NOTIF_SK_PREFIX, NOTIFICATION_PAGE_LIMIT),
    notificationReadUpTo(deps, userId),
  ]);

  const actorNames = await fetchDisplayNames(
    deps,
    [...new Set(items.map((item) => String(item.actorId)))],
  );

  const notifications = items.map((item) => {
    const sortId = sortIdFromNotificationSk(String(item.SK));
    return {
      type: item.type,
      tripId: item.tripId,
      tripTitle: item.tripTitle,
      actorId: item.actorId,
      actorName: actorNames.get(String(item.actorId)) ?? null,
      tripCardId: item.tripCardId,
      createdAt: item.createdAt,
      read: sortId === null || readAt === null ? false : sortId <= readAt,
    };
  });

  const unreadCount = notifications.filter((entry) => !entry.read).length;

  return json(200, { notifications, unreadCount });
}

/**
 * Marks everything the caller currently holds as read, as one small write of a
 * read-up-to timestamp rather than one write per row. Notifications arriving
 * after this moment carry a newer sort id and read as unread again.
 *
 * The write is skipped when the stored marker is already at or past `now` — a
 * second device with a slightly behind clock must not move read state
 * backwards. A notification created in the same millisecond sorts after the
 * bare timestamp (its sort id carries a `#rand` suffix) and correctly stays
 * unread, so the response re-derives the count rather than asserting zero.
 */
export async function markNotificationsRead(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const now = deps.now();

  const existing = await notificationReadUpTo(deps, userId);
  if (existing === null || existing < now) {
    await deps.ddb.send(
      new PutCommand({
        TableName: deps.tableName,
        Item: { ...notificationReadKey(userId), readUpTo: now, updatedAt: now },
      }),
    );
  }

  const unreadCount = await unreadNotificationCount(deps, userId);

  return json(200, { readUpTo: now, unreadCount });
}

/** The caller's preferences; the defaults when never saved. */
export async function getNotificationPreferences(
  deps: Deps,
  request: RouteRequest,
): Promise<JsonResponse> {
  const userId = requireUser(request);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: notificationPrefsKey(userId) }),
  );
  const item = result.Item as PreferencesItem | undefined;

  return json(200, {
    ...preferencesFromItem(item),
    updatedAt: item?.updatedAt ?? null,
  });
}

/**
 * Upserts the caller's preferences. Validated by a reject-never-correct parser:
 * an invalid submission is refused whole, leaving the stored preferences
 * untouched. createdAt is preserved across writes; updatedAt always refreshes.
 */
export async function updateNotificationPreferences(
  deps: Deps,
  request: RouteRequest,
): Promise<JsonResponse> {
  const userId = requireUser(request);
  const key = notificationPrefsKey(userId);

  const body = request.body;
  if (typeof body !== "object" || body === null) throw badRequest("body must be an object");
  const preferences = parseNotificationPreferences(body);

  const existing = await deps.ddb.send(new GetCommand({ TableName: deps.tableName, Key: key }));
  const prev = existing.Item as PreferencesItem | undefined;
  const now = deps.now();

  const item = {
    ...key,
    ...preferences,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };

  await deps.ddb.send(new PutCommand({ TableName: deps.tableName, Item: item }));

  return json(200, { ...preferences, updatedAt: now });
}
