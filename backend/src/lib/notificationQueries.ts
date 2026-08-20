import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { NOTIF_SK_PREFIX, notificationReadKey, sortIdFromNotificationSk, userPartition } from "./keys.ts";

// Query helpers shared by the notification routes and the trip routes (the
// progress poll carries the unread count). Lives in lib/ rather than in
// routes/notifications.ts so no route module ever depends on another — the
// same rule that put fetchDisplayNames in lib/displayNames.ts.

/** One page of the bell or the feed. Bounded reads are the spec; TTL is not relied on. */
export const NOTIFICATION_PAGE_LIMIT = 20;

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
export async function notificationReadUpTo(deps: Deps, userId: string): Promise<string | null> {
  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: notificationReadKey(userId) }),
  );
  const item = result.Item as { readUpTo?: string } | undefined;
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
    notificationReadUpTo(deps, userId),
    queryLatestByPrefix(deps, userPartition(userId), NOTIF_SK_PREFIX, NOTIFICATION_PAGE_LIMIT),
  ]);
  if (readAt === null) return items.length;
  return items.filter((item) => {
    const sortId = sortIdFromNotificationSk(String(item.SK));
    return sortId !== null && sortId > readAt;
  }).length;
}
