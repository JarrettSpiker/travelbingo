import { QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { json, tooManyRequests, unauthorized, type JsonResponse } from "../http.ts";
import { parseFeedbackPayload } from "../lib/feedbackPayload.ts";
import { FEEDBACK_SK_PREFIX, feedbackKey, userFeedbackPointerKey, userPartition } from "../lib/keys.ts";
import { newSortId } from "../lib/notificationEvents.ts";
import type { RouteRequest } from "../request.ts";

/**
 * Bounds what one account can accumulate. Abuse, not usage, is the cost risk —
 * the same reasoning as MAX_CARDS_PER_USER, and the same enforcement shape: a
 * bounded query over the caller's own partition rather than a counter that
 * would need its own transaction to stay honest.
 *
 * Nobody with something to say hits ten in a day.
 */
export const MAX_FEEDBACK_PER_WINDOW = 10;
export const FEEDBACK_WINDOW_HOURS = 24;

/**
 * How long a submission survives. Long enough that reading the channel
 * infrequently does not lose reports — the failure mode this guards against is
 * a maintainer who checks twice a year, not one who checks weekly.
 */
export const FEEDBACK_RETENTION_DAYS = 180;

/** The error code the client keys on to say "you have sent a lot today". */
export const FEEDBACK_CAP_CODE = "feedback_cap_reached";

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

/** The UTC date a timestamp falls on, as the `YYYY-MM-DD` partition suffix. */
export function datePartitionFor(isoTimestamp: string): string {
  return isoTimestamp.slice(0, 10);
}

/**
 * Counts the caller's submissions inside the window.
 *
 * The pointer items sort by ISO timestamp, so the window is a key-condition
 * range rather than a filter — meaning the read is bounded by what is inside
 * the window, not by how much the account has ever sent. Reading a Limit of one
 * more than the cap is enough to decide, and stops an account that somehow
 * accumulated thousands from making this query expensive.
 */
async function countRecent(deps: Deps, userId: string, now: string): Promise<number> {
  const windowStart = new Date(Date.parse(now) - FEEDBACK_WINDOW_HOURS * 3_600_000).toISOString();

  const result = await deps.ddb.send(
    new QueryCommand({
      TableName: deps.tableName,
      KeyConditionExpression: "PK = :pk AND SK BETWEEN :from AND :to",
      ExpressionAttributeValues: {
        ":pk": userPartition(userId),
        ":from": `${FEEDBACK_SK_PREFIX}${windowStart}`,
        // `￿` sorts above any timestamp, so this bounds the range at "now"
        // without needing to know the random suffix.
        ":to": `${FEEDBACK_SK_PREFIX}${now}￿`,
      },
      Select: "COUNT",
      Limit: MAX_FEEDBACK_PER_WINDOW + 1,
    }),
  );

  return result.Count ?? 0;
}

export async function createFeedback(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const payload = parseFeedbackPayload(request.body);

  const now = deps.now();

  const recent = await countRecent(deps, userId, now);
  if (recent >= MAX_FEEDBACK_PER_WINDOW) {
    throw tooManyRequests(
      FEEDBACK_CAP_CODE,
      `at most ${MAX_FEEDBACK_PER_WINDOW} submissions per ${FEEDBACK_WINDOW_HOURS} hours`,
    );
  }

  const sortId = newSortId(now, () => deps.randomBytes(8).toString("base64url"));
  const expiresAt = Math.floor((Date.parse(now) + FEEDBACK_RETENTION_DAYS * 86_400_000) / 1000);

  // The submission and its cap pointer are written together or not at all: a
  // submission with no pointer would be invisible to the cap, and a pointer
  // with no submission would consume a slot for nothing.
  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...feedbackKey(datePartitionFor(now), sortId),
              message: payload.message,
              ...(payload.contact ? { contact: payload.contact } : {}),
              context: payload.context,
              submitterId: userId,
              createdAt: now,
              expiresAt,
            },
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            // Carries no message text: the cap check must never read what
            // anyone wrote.
            Item: {
              ...userFeedbackPointerKey(userId, sortId),
              createdAt: now,
              expiresAt,
            },
          },
        },
      ],
    }),
  );

  // Deliberately returns nothing about the stored record. There is no read path
  // for a submitter, so an id would be a handle to something they can never
  // fetch.
  return json(201, { ok: true });
}
