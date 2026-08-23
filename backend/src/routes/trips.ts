import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import {
  OWNER_ONLY,
  requireCardRole,
  ADMIN_ONLY,
  ADMIN_OR_MEMBER,
  requireTripCardPlayer,
  requireTripRole,
} from "../auth.ts";
import type { Deps } from "../context.ts";
import { badRequest, json, noContent, notFound, unauthorized, type JsonResponse } from "../http.ts";
import type { CardPayload } from "../lib/cardPayload.ts";
import { deleteKeys, putItems } from "../lib/batch.ts";
import { fetchDisplayNames } from "../lib/displayNames.ts";
import {
  cardMetaKey,
  EVENT_SK_PREFIX,
  INVITE_SK_PREFIX,
  inviteKey,
  MEMBER_SK_PREFIX,
  notificationPrefsKey,
  tokenFromInvitePointerSk,
  tripCardKey,
  tripEventKey,
  tripIdFromMembershipSk,
  tripInvitePointerKey,
  tripMemberKey,
  tripMembershipKey,
  tripMetaKey,
  tripPartition,
  TRIP_SK_PREFIX,
  TRIPCARD_SK_PREFIX,
  userNotificationKey,
  userPartition,
} from "../lib/keys.ts";
import { preferencesFromItem, type NotificationEventType } from "../lib/notificationPayload.ts";
import { newSortId, recipientsFor, shouldEmitOneAway } from "../lib/notificationEvents.ts";
import {
  isMarkablePosition,
  parseOptionalEmail,
  parseSlotIndex,
  parseTripCardSnapshot,
  parseTripInput,
  parseTripUpdate,
  type TripCardSnapshot,
} from "../lib/tripPayload.ts";
import { CELLS_PER_CARD, DEFAULT_WIN_CONDITION, hasWon, squaresFromWin, type WinCondition } from "../lib/winCondition.ts";
import { isWithinPlayWindow } from "../lib/playWindow.ts";
import {
  NOTIFICATION_PAGE_LIMIT,
  queryLatestByPrefix,
  unreadNotificationCount,
} from "../lib/notificationQueries.ts";
import { putWithUniqueToken } from "../lib/shareToken.ts";
import type { RouteRequest } from "../request.ts";

/** Bounds what one account can accumulate, mirroring MAX_CARDS_PER_USER. */
export const MAX_TRIPS_PER_USER = 50;
/** Bounds a single trip's membership. */
export const MAX_MEMBERS_PER_TRIP = 50;
/** Bounds a single trip's card count. */
export const MAX_TRIP_CARDS_PER_TRIP = 50;
/** Bounds a single trip's outstanding invite links. */
export const MAX_INVITES_PER_TRIP = 50;

const ID_BYTES = 16;

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

function newId(deps: Deps): string {
  return deps.randomBytes(ID_BYTES).toString("base64url");
}

/** True when a DynamoDB write was cancelled by a failed condition. */
function isConditionFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "ConditionalCheckFailedException" || error.name === "TransactionCanceledException")
  );
}

/** The optional date fields, spread only when present (mirrors the card style). */
function dateFields(startDate: string | undefined, endDate: string | undefined) {
  return {
    ...(startDate ? { startDate } : {}),
    ...(endDate ? { endDate } : {}),
  };
}

/** The denormalized listing fields shared by the membership row and the META. */
function denormFields(title: string, startDate: string | undefined, endDate: string | undefined, updatedAt: string) {
  return { title, updatedAt, ...dateFields(startDate, endDate) };
}

interface TripMeta {
  ownerId: string;
  title: string;
  mode: "cooperative" | "competitive";
  /** Absent on trips created before win conditions existed — read as a line. */
  winCondition?: WinCondition;
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

/** Schema-on-read: an item with no `winCondition` attribute is a `"line"` trip. */
function winConditionOf(meta: { winCondition?: WinCondition }): WinCondition {
  return meta.winCondition ?? DEFAULT_WIN_CONDITION;
}

async function getTripMeta(deps: Deps, tripId: string): Promise<TripMeta | undefined> {
  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripMetaKey(tripId) }),
  );
  return result.Item as TripMeta | undefined;
}

/**
 * Pages a (PK, begins_with(SK)) query to completion. `projection` narrows the
 * attributes returned; it is given as `[expression, names]` because every
 * attribute worth projecting here collides with a DynamoDB reserved word or
 * would if it were renamed later.
 */
async function queryByPrefix(
  deps: Deps,
  pk: string,
  prefix: string | null,
  projection?: { expression: string; names: Record<string, string> },
): Promise<Record<string, unknown>[]> {
  const items: Record<string, unknown>[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const result = await deps.ddb.send(
      new QueryCommand({
        TableName: deps.tableName,
        ...(prefix
          ? {
              KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
              ExpressionAttributeValues: { ":pk": pk, ":sk": prefix },
            }
          : {
              KeyConditionExpression: "PK = :pk",
              ExpressionAttributeValues: { ":pk": pk },
            }),
        ...(projection
          ? {
              ProjectionExpression: projection.expression,
              ExpressionAttributeNames: projection.names,
            }
          : {}),
        ExclusiveStartKey: startKey,
      }),
    );

    items.push(...(result.Items ?? []));
    startKey = result.LastEvaluatedKey;
  } while (startKey);

  return items;
}

function projectSnapshot(meta: CardPayload): TripCardSnapshot {
  return {
    slots: meta.slots,
    title: meta.title,
    hasFreeSpace: meta.hasFreeSpace,
    freeSpaceText: meta.freeSpaceText,
    colorScheme: meta.colorScheme,
    fontScheme: meta.fontScheme,
    emojiScheme: meta.emojiScheme,
  };
}

/**
 * The wire shape of a card's marks: always a sorted JSON array, never a set.
 *
 * A DynamoDB set cannot be empty, so unmarking the last square removes the
 * attribute entirely — an absent `markedSlots` and an empty set are the same
 * state, "nothing marked". Normalizing here means no reader ever has to know
 * that, and the sort makes the response stable to compare.
 */
function markedSlotsResponse(value: unknown): number[] {
  const values = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return values.filter((slot): slot is number => typeof slot === "number").sort((a, b) => a - b);
}

function tripCardResponse(item: Record<string, unknown>) {
  const tripCardId = String(item.SK).slice(TRIPCARD_SK_PREFIX.length);
  const response: Record<string, unknown> = {
    tripCardId,
    snapshot: item.snapshot,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
    markedSlots: markedSlotsResponse(item.markedSlots),
  };
  if (item.assignedMemberId !== undefined) {
    response.assignedMemberId = item.assignedMemberId;
  }
  if (item.progressUpdatedAt !== undefined) {
    response.progressUpdatedAt = item.progressUpdatedAt;
  }
  // A recorded win is returned as stored, never re-evaluated — it is a fact
  // about the past, not a value derived from the current marks.
  if (item.wonAt !== undefined) {
    response.wonAt = item.wonAt;
    response.winnerId = item.winnerId;
  }
  return response;
}

// --- Trip lifecycle --------------------------------------------------------

/**
 * A single Query, with no per-trip lookup. The title (and optional dates) are
 * denormalized onto the membership row for exactly this reason — mirroring the
 * card listing.
 */
export async function listTrips(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const items = await queryByPrefix(deps, userPartition(userId), TRIP_SK_PREFIX);

  const trips = items
    .map((item) => {
      const tripId = tripIdFromMembershipSk(String(item.SK));
      if (tripId === null) return null;
      return {
        tripId,
        title: String(item.title ?? ""),
        role: item.role,
        ...(item.startDate ? { startDate: item.startDate } : {}),
        ...(item.endDate ? { endDate: item.endDate } : {}),
        updatedAt: item.updatedAt,
      };
    })
    .filter((trip) => trip !== null);

  return json(200, { trips });
}

export async function createTrip(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const input = parseTripInput(request.body);
  // The caller's display email, self-reported (the access JWT carries no email
  // claim). Display only — identity still comes solely from the verified `sub`.
  const memberEmail = parseOptionalEmail((request.body as Record<string, unknown> | null)?.email);

  const existing = await queryByPrefix(deps, userPartition(userId), TRIP_SK_PREFIX);
  if (existing.length >= MAX_TRIPS_PER_USER) {
    throw badRequest(`a user may be a member of at most ${MAX_TRIPS_PER_USER} trips`);
  }

  const tripId = newId(deps);
  const timestamp = deps.now();

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...tripMetaKey(tripId),
              ownerId: userId,
              title: input.title,
              mode: input.mode,
              winCondition: input.winCondition,
              createdAt: timestamp,
              updatedAt: timestamp,
              ...dateFields(input.startDate, input.endDate),
            },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...tripMembershipKey(userId, tripId),
              role: "admin",
              ...denormFields(input.title, input.startDate, input.endDate, timestamp),
            },
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            // Mirror of the membership, hanging off the trip, for cascade deletes
            // and member reads. Carries the member's email as a display fallback
            // for trip-mates (captured from the verified JWT, never trusted from
            // the request body).
            Item: {
              ...tripMemberKey(tripId, userId),
              role: "admin",
              email: memberEmail,
              createdAt: timestamp,
            },
          },
        },
      ],
    }),
  );

  return json(201, {
    tripId,
    title: input.title,
    mode: input.mode,
    winCondition: input.winCondition,
    updatedAt: timestamp,
  });
}

/**
 * Returns the trip to any member. The whole trip is gathered by paging its own
 * partition once; read authorization is trip-level, so every card is returned
 * to every member regardless of competitive assignment.
 */
export async function getTrip(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const membership = await requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER);

  const items = await queryByPrefix(deps, tripPartition(tripId), null);

  const members: Record<string, unknown>[] = [];
  const cards: Record<string, unknown>[] = [];
  const invites: Record<string, unknown>[] = [];
  let meta: Record<string, unknown> | undefined;

  for (const item of items) {
    const sk = String(item.SK);
    if (sk === "META") {
      meta = item;
    } else if (sk.startsWith(MEMBER_SK_PREFIX)) {
      members.push({
        userId: sk.slice(MEMBER_SK_PREFIX.length),
        role: item.role,
        email: item.email ?? null,
        createdAt: item.createdAt,
      });
    } else if (sk.startsWith(TRIPCARD_SK_PREFIX)) {
      cards.push(tripCardResponse(item));
    } else if (sk.startsWith(INVITE_SK_PREFIX)) {
      const token = tokenFromInvitePointerSk(sk);
      if (token !== null) invites.push({ token, createdAt: item.createdAt });
    }
  }

  if (!meta) throw notFound();

  // Resolve each member's display name from their profile (one BatchGet, since
  // the membership rows carry only the user id). A profile is written lazily, so
  // a member who never set a name has none; null falls through to the client.
  const memberNames = await fetchDisplayNames(
    deps,
    members.map((m) => String(m.userId)),
  );
  for (const member of members) {
    member.displayName = memberNames.get(String(member.userId)) ?? null;
  }

  const response: Record<string, unknown> = {
    tripId,
    title: meta.title,
    mode: meta.mode,
    winCondition: winConditionOf(meta),
    createdAt: meta.createdAt,
    updatedAt: meta.updatedAt,
    role: membership.role,
    ...(meta.startDate ? { startDate: meta.startDate } : {}),
    ...(meta.endDate ? { endDate: meta.endDate } : {}),
    members,
    cards,
    // Only the administrator sees outstanding invites.
    ...(membership.role === "admin" ? { invites } : {}),
  };

  return json(200, response);
}

/**
 * Builds a SET/REMOVE update for the title and dates, used for both the META and
 * every member's listing row. Absent dates are REMOVEd (clearing them); present
 * dates are SET. The play mode is fixed at creation and is not editable.
 *
 * `winCondition` is META-only — the denormalized listing rows do not carry it
 * (the trips list does not render it), so it is passed separately and only the
 * META's update includes it.
 */
function buildFieldUpdate(
  input: { title: string; startDate?: string; endDate?: string },
  timestamp: string,
  winCondition?: WinCondition,
) {
  const names: Record<string, string> = { "#title": "title", "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":title": input.title, ":updatedAt": timestamp };
  const setParts = ["#title = :title", "#updatedAt = :updatedAt"];
  const removeParts: string[] = [];

  if (winCondition !== undefined) {
    names["#winCondition"] = "winCondition";
    values[":winCondition"] = winCondition;
    setParts.push("#winCondition = :winCondition");
  }

  if (input.startDate !== undefined) {
    names["#startDate"] = "startDate";
    values[":startDate"] = input.startDate;
    setParts.push("#startDate = :startDate");
  } else {
    names["#startDate"] = "startDate";
    removeParts.push("#startDate");
  }

  if (input.endDate !== undefined) {
    names["#endDate"] = "endDate";
    values[":endDate"] = input.endDate;
    setParts.push("#endDate = :endDate");
  } else {
    names["#endDate"] = "endDate";
    removeParts.push("#endDate");
  }

  const setClause = `SET ${setParts.join(", ")}`;
  const removeClause = removeParts.length ? ` REMOVE ${removeParts.join(", ")}` : "";
  return {
    UpdateExpression: setClause + removeClause,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
  };
}

export async function updateTrip(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const input = parseTripUpdate(request.body);
  const timestamp = deps.now();
  const metaUpdate = buildFieldUpdate(input, timestamp, input.winCondition);
  const memberUpdate = buildFieldUpdate(input, timestamp);

  // Update the META and every member's denormalized listing row in a single
  // transaction. The title and dates are duplicated onto each membership row so
  // a user's trip list is a single query; doing them atomically means a
  // transient failure can't leave some members' listing rows showing the old
  // title/dates while the META shows the new. (≤ 1 META + 50 member rows = 51
  // actions, under DynamoDB's 100-action TransactWriteItems limit.)
  const memberRows = await queryByPrefix(deps, tripPartition(tripId), MEMBER_SK_PREFIX);

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Update: { TableName: deps.tableName, Key: tripMetaKey(tripId), ...metaUpdate } },
        ...memberRows.map((row) => {
          const memberUserId = String(row.SK).slice(MEMBER_SK_PREFIX.length);
          return {
            Update: { TableName: deps.tableName, Key: tripMembershipKey(memberUserId, tripId), ...memberUpdate },
          };
        }),
      ],
    }),
  );

  return json(200, { tripId, title: input.title, updatedAt: timestamp });
}

/**
 * Deletes a trip and everything attached to it: its metadata, every membership
 * (both the user-facing listing row and the cascade mirror), every trip card,
 * and every outstanding invite (pointer + redemption record). Mirrors
 * {@link deleteCard}'s paged cascade.
 */
export async function deleteTrip(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const keys: { PK: string; SK: string }[] = [];
  const inviteTokens: string[] = [];
  const memberUserIds: string[] = [];

  const items = await queryByPrefix(deps, tripPartition(tripId), null);
  for (const item of items) {
    const sk = String(item.SK);
    keys.push({ PK: String(item.PK), SK: sk });

    if (sk.startsWith(MEMBER_SK_PREFIX)) {
      memberUserIds.push(sk.slice(MEMBER_SK_PREFIX.length));
    }
    const token = tokenFromInvitePointerSk(sk);
    if (token !== null) inviteTokens.push(token);
  }

  // Cross-partition cleanup: each member's listing row and each invite record.
  for (const memberUserId of memberUserIds) {
    keys.push(tripMembershipKey(memberUserId, tripId));
  }
  for (const token of inviteTokens) {
    keys.push(inviteKey(token));
  }

  await deleteKeys(deps, keys);

  return noContent();
}

// --- Members and invites ---------------------------------------------------

/** Clears `assignedMemberId` from any trip cards assigned to a removed member. */
async function clearAssignedCards(deps: Deps, tripId: string, memberUserId: string): Promise<void> {
  const cards = await queryByPrefix(deps, tripPartition(tripId), TRIPCARD_SK_PREFIX);
  for (const card of cards) {
    if (card.assignedMemberId === memberUserId) {
      const tripCardId = String(card.SK).slice(TRIPCARD_SK_PREFIX.length);
      await deps.ddb.send(
        new UpdateCommand({
          TableName: deps.tableName,
          Key: tripCardKey(tripId, tripCardId),
          UpdateExpression: "REMOVE #a",
          ExpressionAttributeNames: { "#a": "assignedMemberId" },
        }),
      );
    }
  }
}

/**
 * Removes a member. Their added cards remain (the spec); their assignments are
 * cleared back to the unassigned pool. Refuses to remove an administrator if
 * doing so would leave the trip without one — and does so atomically, so two
 * concurrent removals cannot each observe a second admin and strand the trip.
 */
export async function removeMember(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const targetUserId = request.params.userId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  // Confirm the target holds a current membership; 404 (not 403) otherwise.
  const target = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripMembershipKey(targetUserId, tripId) }),
  );
  if (!target.Item) throw notFound();

  const targetIsAdmin = target.Item.role === "admin";

  // Find a *specific* other administrator before removing an admin, so the
  // delete can be conditioned on that admin still existing. If there is none,
  // refuse up front — before any mutation.
  let survivingAdminId: string | null = null;
  if (targetIsAdmin) {
    const memberRows = await queryByPrefix(deps, tripPartition(tripId), MEMBER_SK_PREFIX);
    const otherAdmin = memberRows.find(
      (row) => row.role === "admin" && String(row.SK).slice(MEMBER_SK_PREFIX.length) !== targetUserId,
    );
    if (!otherAdmin) {
      throw badRequest("cannot remove the only administrator");
    }
    survivingAdminId = String(otherAdmin.SK).slice(MEMBER_SK_PREFIX.length);
  }

  // Clear this member's card assignments BEFORE the deletes: a removed member
  // with a lingering assignment is a worse outcome than a still-present member
  // whose assignment was cleared (the admin can reassign). If the delete below
  // is refused by the atomic guard, the member simply remains unassigned.
  await clearAssignedCards(deps, tripId, targetUserId);

  // Delete the membership and its mirror together, conditioned on the surviving
  // admin's mirror still existing when an admin is being removed. If a
  // concurrent removal deleted that admin first, the whole transaction cancels
  // and the trip cannot be left with zero administrators.
  try {
    await deps.ddb.send(
      new TransactWriteCommand({
        TransactItems: [
          { Delete: { TableName: deps.tableName, Key: tripMembershipKey(targetUserId, tripId) } },
          { Delete: { TableName: deps.tableName, Key: tripMemberKey(tripId, targetUserId) } },
          ...(survivingAdminId
            ? [
                {
                  ConditionCheck: {
                    TableName: deps.tableName,
                    Key: tripMemberKey(tripId, survivingAdminId),
                    ConditionExpression: "attribute_exists(PK)",
                  },
                },
              ]
            : []),
        ],
      }),
    );
  } catch (error) {
    // The surviving admin was removed concurrently: refuse rather than strand.
    if (targetIsAdmin && isConditionFailure(error)) {
      throw badRequest("cannot remove the only administrator");
    }
    throw error;
  }

  return noContent();
}

/** Mints a revocable invite link, reusing the share-link token pattern. */
export async function createInvite(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const meta = await getTripMeta(deps, tripId);
  if (!meta) throw notFound();

  // Bound the outstanding invite links, the same way addTripCard bounds cards —
  // a counted check before the write. Caps redemptions too, since each
  // redeemable invite yields at most one member (MAX_MEMBERS_PER_TRIP).
  const outstanding = await queryByPrefix(deps, tripPartition(tripId), INVITE_SK_PREFIX);
  if (outstanding.length >= MAX_INVITES_PER_TRIP) {
    throw badRequest(`a trip may have at most ${MAX_INVITES_PER_TRIP} outstanding invites`);
  }

  const createdAt = deps.now();
  const token = await putWithUniqueToken(deps, inviteKey, () => ({
    tripId,
    title: meta!.title,
    createdAt,
  }));

  // Admin-facing pointer, written after the invite record. If this failed the
  // invite would exist but not be listable — the safe direction, matching
  // share links.
  await deps.ddb.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: { ...tripInvitePointerKey(tripId, token), createdAt },
    }),
  );

  return json(201, { token, createdAt });
}

export async function listInvites(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const items = await queryByPrefix(deps, tripPartition(tripId), INVITE_SK_PREFIX);
  const invites = items
    .map((item) => {
      const token = tokenFromInvitePointerSk(String(item.SK));
      return token === null ? null : { token, createdAt: item.createdAt };
    })
    .filter((invite) => invite !== null);

  return json(200, { invites });
}

export async function revokeInvite(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const token = request.params.token ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  // The pointer lives under the trip's partition, so reading it confirms the
  // invite belongs to this trip before deleting the cross-partition record.
  const pointer = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripInvitePointerKey(tripId, token) }),
  );
  if (!pointer.Item) throw notFound();

  await deps.ddb.send(new DeleteCommand({ TableName: deps.tableName, Key: inviteKey(token) }));
  await deps.ddb.send(new DeleteCommand({ TableName: deps.tableName, Key: tripInvitePointerKey(tripId, token) }));

  return noContent();
}

/**
 * The one public trip route (marked `public: true` in the router). Returns only
 * the trip title for a valid, unrevoked token — enough for the invite landing
 * page to show "You're invited to <title>" before sign-in. A revoked, unknown,
 * or trip-deleted token all return the identical 404, revealing nothing.
 */
export async function resolveInvite(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const token = request.params.token ?? "";

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: inviteKey(token) }),
  );
  const invite = result.Item as { title: string; createdAt: string } | undefined;
  if (!invite) throw notFound();

  return json(200, { title: invite.title, createdAt: invite.createdAt });
}

/**
 * Joins the caller to the trip behind an invite. Idempotent: redeeming as a
 * current member is a no-op. Enforces the per-trip member cap.
 */
export async function redeemInvite(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const token = request.params.token ?? "";
  // Self-reported display email for the new membership (display only).
  const memberEmail = parseOptionalEmail((request.body as Record<string, unknown> | null)?.email);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: inviteKey(token) }),
  );
  const invite = result.Item as { tripId: string } | undefined;
  if (!invite) throw notFound();

  const tripId = invite.tripId;

  // Fetch the live META so a late redeemer's listing row reflects the current
  // title and dates rather than the invite-time snapshot.
  const meta = await getTripMeta(deps, tripId);
  if (!meta) throw notFound();

  // Idempotent: a current member redeeming again changes nothing.
  const existing = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripMembershipKey(userId, tripId) }),
  );
  if (existing.Item) {
    return json(200, { tripId, role: existing.Item.role });
  }

  const members = await queryByPrefix(deps, tripPartition(tripId), MEMBER_SK_PREFIX);
  if (members.length >= MAX_MEMBERS_PER_TRIP) {
    throw badRequest(`a trip may have at most ${MAX_MEMBERS_PER_TRIP} members`);
  }

  const timestamp = deps.now();
  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...tripMembershipKey(userId, tripId),
              role: "member",
              ...denormFields(meta.title, meta.startDate, meta.endDate, timestamp),
            },
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...tripMemberKey(tripId, userId),
              role: "member",
              email: memberEmail,
              createdAt: timestamp,
            },
          },
        },
      ],
    }),
  );

  return json(201, { tripId, role: "member" });
}

// --- Trip cards ------------------------------------------------------------

/**
 * Adds a frozen, render-only snapshot of one of the caller's cards to the trip.
 * Only a card owner may snapshot it; the snapshot is fully decoupled from the
 * original (editing or deleting the card never reaches this item).
 */
export async function addTripCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER);

  const body = request.body;
  if (typeof body !== "object" || body === null) throw badRequest("body must be an object");
  const cardId = (body as Record<string, unknown>).cardId;
  if (typeof cardId !== "string" || cardId === "") throw badRequest("cardId must be a string");

  // Only a card owner can add it; a non-owner gets the same 404 as a
  // non-existent card, so foreign card ids do not leak.
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: cardMetaKey(cardId) }),
  );
  const meta = result.Item as CardPayload | undefined;
  if (!meta) throw notFound();

  // Defense-in-depth: validate the projected render-only subset before storing.
  const snapshot = parseTripCardSnapshot(projectSnapshot(meta));

  const cards = await queryByPrefix(deps, tripPartition(tripId), TRIPCARD_SK_PREFIX);
  if (cards.length >= MAX_TRIP_CARDS_PER_TRIP) {
    throw badRequest(`a trip may hold at most ${MAX_TRIP_CARDS_PER_TRIP} cards`);
  }

  const tripCardId = newId(deps);
  const timestamp = deps.now();
  await deps.ddb.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: {
        ...tripCardKey(tripId, tripCardId),
        snapshot,
        ownerId: userId,
        createdAt: timestamp,
      },
      ConditionExpression: "attribute_not_exists(PK)",
    }),
  );

  return json(201, { tripCardId, createdAt: timestamp });
}

export async function removeTripCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const tripCardId = request.params.tripCardId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const existing = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripCardKey(tripId, tripCardId) }),
  );
  if (!existing.Item) throw notFound();

  await deps.ddb.send(new DeleteCommand({ TableName: deps.tableName, Key: tripCardKey(tripId, tripCardId) }));

  return noContent();
}

/**
 * Assigns (or reassigns) a trip card to a member. Competitive trips only; in
 * cooperative trips assignment does not apply. Rejects a target who is not a
 * current member.
 */
export async function assignTripCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const tripCardId = request.params.tripCardId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_ONLY);

  const body = request.body;
  if (typeof body !== "object" || body === null) throw badRequest("body must be an object");
  const assignedMemberId = (body as Record<string, unknown>).assignedMemberId;
  if (typeof assignedMemberId !== "string" || assignedMemberId === "") {
    throw badRequest("assignedMemberId must be a string");
  }

  const meta = await getTripMeta(deps, tripId);
  if (!meta) throw notFound();
  if (meta.mode !== "competitive") {
    throw badRequest("assignment is only available in competitive trips");
  }

  const target = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripMembershipKey(assignedMemberId, tripId) }),
  );
  if (!target.Item) throw badRequest("assignee must be a member of the trip");

  const cardItem = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripCardKey(tripId, tripCardId) }),
  );
  if (!cardItem.Item) throw notFound();

  await deps.ddb.send(
    new UpdateCommand({
      TableName: deps.tableName,
      Key: tripCardKey(tripId, tripCardId),
      UpdateExpression: "SET #a = :a",
      ExpressionAttributeNames: { "#a": "assignedMemberId" },
      ExpressionAttributeValues: { ":a": assignedMemberId },
    }),
  );

  return json(200, { tripCardId, assignedMemberId });
}

// --- Play progress ---------------------------------------------------------

/** How long events and notifications are retained before TTL removes them. */
const NOTIFICATION_RETENTION_DAYS = 90;

/**
 * One play event to record: a feed item in the trip's partition plus, for each
 * eligible recipient, a notification item in their own.
 */
interface PlayEvent {
  type: NotificationEventType;
  tripCardId: string;
  detail: Record<string, unknown>;
}

/**
 * Writes an event to the trip's activity feed and fans notifications out to
 * the members entitled to them, per the design in add-play-notifications:
 *
 *  - one EVENT# item per event, always, regardless of anyone's preferences —
 *    the feed is the "show everything" surface and must not have holes;
 *  - zero or more NOTIF# items, filtered at write time by the recipients'
 *    own preferences (never the actor's — the actor is excluded outright).
 *
 * Membership comes from the trip's live MEMBER# roster, so a removed member
 * simply stops being a recipient. The bound is per event: 1 EVENT# + up to
 * MAX_MEMBERS_PER_TRIP - 1 NOTIF# writes. A single mark can emit two events
 * (a winning or near-missing mark still emits its progress_marked), so the
 * per-request worst case is ~100 items — four BatchWriteItem calls — and the
 * common case, with progress_marked off by default, is one feed item and none.
 */
async function emitPlayEvents(
  deps: Deps,
  params: { tripId: string; tripTitle: string; actorId: string; events: PlayEvent[] },
): Promise<void> {
  const { tripId, tripTitle, actorId, events } = params;
  if (events.length === 0) return;

  const memberRows = await queryByPrefix(deps, tripPartition(tripId), MEMBER_SK_PREFIX);
  const memberIds = memberRows.map((row) => String(row.SK).slice(MEMBER_SK_PREFIX.length));

  // One batched read of every member's preferences; an absent item is the
  // defaults, resolved inside recipientsFor.
  const prefsResult = await deps.ddb.send(
    new BatchGetCommand({
      RequestItems: {
        [deps.tableName]: { Keys: memberIds.map((id) => notificationPrefsKey(id)) },
      },
    }),
  );
  const prefsByUser = new Map<string, ReturnType<typeof preferencesFromItem>>();
  for (const item of (prefsResult.Responses?.[deps.tableName] ?? []) as { PK: string }[]) {
    const id = String(item.PK).startsWith("USER#") ? String(item.PK).slice("USER#".length) : null;
    if (id !== null) prefsByUser.set(id, preferencesFromItem(item));
  }

  const now = deps.now();
  const expiresAt = Math.floor((Date.parse(now) + NOTIFICATION_RETENTION_DAYS * 86_400_000) / 1000);
  const nextSortId = () => newSortId(now, () => deps.randomBytes(8).toString("base64url"));

  const items: (ReturnType<typeof tripEventKey> & Record<string, unknown>)[] = [];
  for (const event of events) {
    items.push({
      ...tripEventKey(tripId, nextSortId()),
      type: event.type,
      actorId,
      tripCardId: event.tripCardId,
      detail: event.detail,
      createdAt: now,
      expiresAt,
    });

    for (const recipientId of recipientsFor({ type: event.type, tripId }, memberIds, actorId, prefsByUser)) {
      items.push({
        ...userNotificationKey(recipientId, nextSortId()),
        type: event.type,
        tripId,
        tripTitle,
        actorId,
        tripCardId: event.tripCardId,
        createdAt: now,
        expiresAt,
      });
    }
  }

  await putItems(deps, items);
}

/**
 * Marks or unmarks one square, as a single atomic set operation.
 *
 * `ADD`/`DELETE` on a number set is commutative and idempotent, which is what
 * makes cooperative play safe: two members marking two different squares in the
 * same second cannot lose each other's write, with no read-modify-write cycle,
 * no version attribute, and no conditional-update retry loop. Marking an
 * already-marked square is a no-op rather than an error, and so is unmarking one
 * that was never marked.
 *
 * The three refusals, in order: not your card to play (via
 * {@link requireTripCardPlayer}), not a real square, and not during the trip.
 */
async function setTripCardSlot(
  deps: Deps,
  request: RouteRequest,
  marked: boolean,
): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  const tripCardId = request.params.tripCardId ?? "";
  const slotIndex = parseSlotIndex(request.params.slotIndex);

  const { trip, card } = await requireTripCardPlayer(deps, userId, tripId, tripCardId);

  const snapshot = card.snapshot as TripCardSnapshot | undefined;
  if (!snapshot || !isMarkablePosition(snapshot, slotIndex)) {
    throw badRequest("that position is not a square on this card");
  }

  // The server's own clock, never anything the request carries or implies.
  if (!isWithinPlayWindow(trip, new Date(deps.now()))) {
    throw badRequest("this trip is outside the dates it can be played");
  }

  // The distances the near-miss edge trigger needs, computable from the card
  // item the authorization check already holds — no extra read. A blank square
  // is not markable, so it keeps a line through it from ever completing.
  const condition = winConditionOf(trip);
  const markable = new Set(
    Array.from({ length: CELLS_PER_CARD }, (_, index) => index).filter((index) =>
      isMarkablePosition(snapshot, index),
    ),
  );
  const markedBefore = new Set(markedSlotsResponse(card.markedSlots));
  const distanceBefore = squaresFromWin(markedBefore, markable, condition);

  const timestamp = deps.now();
  let result;
  try {
    result = await deps.ddb.send(
      new UpdateCommand({
        TableName: deps.tableName,
        Key: tripCardKey(tripId, tripCardId),
        UpdateExpression: `SET #progressUpdatedAt = :now ${marked ? "ADD" : "DELETE"} #markedSlots :slot`,
        ExpressionAttributeNames: {
          "#markedSlots": "markedSlots",
          "#progressUpdatedAt": "progressUpdatedAt",
        },
        ExpressionAttributeValues: { ":slot": new Set([slotIndex]), ":now": timestamp },
        // UpdateItem is an *upsert*. Without this the card can be removed
        // between requireTripCardPlayer's read and this write, and the write
        // then recreates the row carrying marks but no snapshot — a trip card
        // that renders as a crash for every member and that no UI can delete.
        ConditionExpression: "attribute_exists(PK)",
        ReturnValues: "ALL_NEW",
      }),
    );
  } catch (error) {
    // The card stopped existing under us. That is the same answer the
    // authorization check would have given a moment earlier.
    if (isConditionFailure(error)) throw notFound();
    throw error;
  }

  // A win is evaluated on the mark path only — adding a square is the only
  // operation that can move a card to its target, and unmarking must never
  // create or destroy one. The set update above returned the card's whole mark
  // set, so this evaluates fresh state without another read.
  let wonNow = false;
  const markedAfter = new Set(markedSlotsResponse(result.Attributes?.markedSlots));
  if (marked && hasWon(markedAfter, condition)) {
    // The member entitled to the win: the assignee in a competitive trip, the
    // member who placed the completing mark in a cooperative one.
    const winnerId = trip.mode === "competitive" ? String(card.assignedMemberId) : userId;
    try {
      await deps.ddb.send(
        new UpdateCommand({
          TableName: deps.tableName,
          Key: tripCardKey(tripId, tripCardId),
          UpdateExpression: "SET #wonAt = :wonAt, #winnerId = :winnerId",
          ExpressionAttributeNames: { "#wonAt": "wonAt", "#winnerId": "winnerId" },
          ExpressionAttributeValues: { ":wonAt": timestamp, ":winnerId": winnerId },
          // The first achievement sticks: a concurrent completing mark loses
          // the race, which is the correct outcome — someone else's record is
          // already there — not an error.
          ConditionExpression: "attribute_not_exists(wonAt)",
        }),
      );
      wonNow = true;
    } catch (error) {
      if (!isConditionFailure(error)) throw error;
    }
  }

  // Emission: marks only, and only when the mark actually changed the set — a
  // re-tap of an already-marked square is a no-op above and must not produce an
  // event either. Runs after the mark and any win record are durable, and a
  // failure here is logged and swallowed: the member's square landing matters
  // more than the announcement of it. Logged without card text.
  if (marked && !markedBefore.has(slotIndex)) {
    const distanceAfter = squaresFromWin(markedAfter, markable, condition);
    const events: PlayEvent[] = [];
    // A winning mark is a victory, never a near-miss — the else keeps the
    // exclusion structural rather than relying on the distances to agree.
    if (wonNow) {
      events.push({ type: "victory", tripCardId, detail: {} });
    } else if (shouldEmitOneAway(distanceBefore, distanceAfter)) {
      events.push({ type: "one_away", tripCardId, detail: {} });
    }
    events.push({ type: "progress_marked", tripCardId, detail: { slotIndex } });

    try {
      await emitPlayEvents(deps, {
        tripId,
        tripTitle: trip.title ?? "",
        actorId: userId,
        events,
      });
    } catch (error) {
      console.error("play-event emission failed", {
        tripId,
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return json(200, {
    tripCardId,
    markedSlots: markedSlotsResponse(result.Attributes?.markedSlots),
    progressUpdatedAt: timestamp,
  });
}

export async function markTripCardSlot(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  return setTripCardSlot(deps, request, true);
}

export async function unmarkTripCardSlot(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  return setTripCardSlot(deps, request, false);
}

/**
 * The polled endpoint: only what changes. Read authorization is trip-level, so
 * every member sees every card's progress regardless of who may modify it.
 *
 * It deliberately projects away the snapshots — a poll must not carry the
 * payload `getTrip` carries — and stays readable outside the play window, since
 * the window bounds who may write, not who may look. The caller's unread
 * notification count rides along so an open trip page refreshes the bell on
 * the interval it is already running, rather than on a second timer.
 */
export async function getTripProgress(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER);

  const [items, unreadNotifications] = await Promise.all([
    queryByPrefix(deps, tripPartition(tripId), TRIPCARD_SK_PREFIX, {
      expression: "#SK, #markedSlots, #progressUpdatedAt, #wonAt, #winnerId",
      names: {
        "#SK": "SK",
        "#markedSlots": "markedSlots",
        "#progressUpdatedAt": "progressUpdatedAt",
        "#wonAt": "wonAt",
        "#winnerId": "winnerId",
      },
    }),
    unreadNotificationCount(deps, userId),
  ]);

  const cards = items.map((item) => ({
    tripCardId: String(item.SK).slice(TRIPCARD_SK_PREFIX.length),
    markedSlots: markedSlotsResponse(item.markedSlots),
    ...(item.progressUpdatedAt !== undefined ? { progressUpdatedAt: item.progressUpdatedAt } : {}),
    ...(item.wonAt !== undefined ? { wonAt: item.wonAt, winnerId: item.winnerId } : {}),
  }));

  return json(200, { cards, unreadNotifications });
}

/**
 * The trip's activity feed: a bounded, most-recent-first page of the play
 * events emitted in it. Visible to every member regardless of preferences —
 * including a member who has muted the trip — because the feed is the "show
 * everything" surface; the bell, not the feed, is what preferences govern.
 */
export async function getTripActivity(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const tripId = request.params.tripId ?? "";
  await requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER);

  const items = await queryLatestByPrefix(
    deps,
    tripPartition(tripId),
    EVENT_SK_PREFIX,
    NOTIFICATION_PAGE_LIMIT,
  );

  // Actor names resolve at read time so a rename never leaves a stale name on
  // an old event.
  const actorNames = await fetchDisplayNames(
    deps,
    [...new Set(items.map((item) => String(item.actorId)))],
  );

  const events = items.map((item) => ({
    type: item.type,
    actorId: item.actorId,
    actorName: actorNames.get(String(item.actorId)) ?? null,
    tripCardId: item.tripCardId,
    createdAt: item.createdAt,
  }));

  return json(200, { events });
}
