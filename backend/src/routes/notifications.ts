import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { badRequest, json, unauthorized, type JsonResponse } from "../http.ts";
import { fetchDisplayNames } from "../lib/displayNames.ts";
import {
  NOTIF_SK_PREFIX,
  notificationPrefsKey,
  notificationReadKey,
  sortIdFromNotificationSk,
  userPartition,
} from "../lib/keys.ts";
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
// nothing else.

/** One page of the bell or the feed. Bounded reads are the spec; TTL is not relied on. */
export const NOTIFICATION_PAGE_LIMIT = 20;

interface ReadMarkerItem {
  readUpTo: string;
  updatedAt: string;
}

interface PreferencesItem extends NotificationPreferences {
  createdAt?: string;
  updatedAt?: string;
}

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

/**
 * A bounded, most-recent-first page of a prefixed range in one partition. The
 * `<isoTs>#<rand>` sort keys make a descending query chronological for free;
 * the Limit — not TTL, whose deletion can lag by days — is what keeps the
 * response small.
 */
export async function queryLatestByPrefix(
  deps: Deps,
  pk: string,
  prefix: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const result = await deps.ddb.send(
    new QueryCommand({
      TableName: deps.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": pk, ":sk": prefix },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  return (result.Items ?? []) as Record<string, unknown>[];
}

/** Reads the caller's read-up-to marker, if any. */
async function readUpTo(deps: Deps, userId: string): Promise<string | null> {
  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: notificationReadKey(userId) }),
  );
  const item = result.Item as ReadMarkerItem | undefined;
  return item?.readUpTo ?? null;
}

/**
 * The caller's unread count, exact up to the page limit. Unread items are the
 * newest ones, so a descending bounded page always contains all of them — the
 * count saturates rather than under-reporting when unread exceeds the limit.
 * Shared with the trip progress poll, so an open trip page refreshes the bell
 * on the interval it already runs.
 */
export async function unreadNotificationCount(deps: Deps, userId: string): Promise<number> {
  const [readAt, items] = await Promise.all([
    readUpTo(deps, userId),
    queryLatestByPrefix(deps, userPartition(userId), NOTIF_SK_PREFIX, NOTIFICATION_PAGE_LIMIT),
  ]);
  if (readAt === null) return items.length;
  return items.filter((item) => {
    const sortId = sortIdFromNotificationSk(String(item.SK));
    return sortId !== null && sortId > readAt;
  }).length;
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
    readUpTo(deps, userId),
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
 */
export async function markNotificationsRead(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const now = deps.now();

  await deps.ddb.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: { ...notificationReadKey(userId), readUpTo: now, updatedAt: now },
    }),
  );

  return json(200, { readUpTo: now, unreadCount: 0 });
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
