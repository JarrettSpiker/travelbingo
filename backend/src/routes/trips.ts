import {
  BatchGetCommand,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { OWNER_ONLY, requireCardRole, ADMIN_ONLY, ADMIN_OR_MEMBER, requireTripRole } from "../auth.ts";
import type { Deps } from "../context.ts";
import { badRequest, json, noContent, notFound, unauthorized, type JsonResponse } from "../http.ts";
import type { CardPayload } from "../lib/cardPayload.ts";
import { deleteKeys } from "../lib/batch.ts";
import {
  cardMetaKey,
  INVITE_SK_PREFIX,
  inviteKey,
  MEMBER_SK_PREFIX,
  profileKey,
  tokenFromInvitePointerSk,
  tripCardKey,
  tripIdFromMembershipSk,
  tripInvitePointerKey,
  tripMemberKey,
  tripMembershipKey,
  tripMetaKey,
  tripPartition,
  TRIP_SK_PREFIX,
  TRIPCARD_SK_PREFIX,
  userPartition,
} from "../lib/keys.ts";
import { parseOptionalEmail, parseTripCardSnapshot, parseTripInput, parseTripUpdate, type TripCardSnapshot } from "../lib/tripPayload.ts";
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
  startDate?: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

async function getTripMeta(deps: Deps, tripId: string): Promise<TripMeta | undefined> {
  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: tripMetaKey(tripId) }),
  );
  return result.Item as TripMeta | undefined;
}

/**
 * Fetches the display name for each given user id in one BatchGet. Profiles are
 * written lazily, so an absent item (no name set) maps to null rather than
 * missing the user. Used to surface member names in a trip without storing them
 * on the membership (which would drift on rename).
 */
async function fetchDisplayNames(deps: Deps, userIds: string[]): Promise<Map<string, string | null>> {
  const names = new Map<string, string | null>();
  if (userIds.length === 0) return names;

  const result = await deps.ddb.send(
    new BatchGetCommand({
      RequestItems: { [deps.tableName]: { Keys: userIds.map((uid) => profileKey(uid)) } },
    }),
  );

  for (const item of (result.Responses?.[deps.tableName] ?? []) as { PK: string; displayName?: string }[]) {
    // PK is USER#<sub>; recover the id it was fetched by.
    const sub = String(item.PK).startsWith("USER#") ? String(item.PK).slice("USER#".length) : null;
    if (sub !== null) names.set(sub, item.displayName ?? null);
  }
  return names;
}

/** Pages a (PK, begins_with(SK)) query to completion. */
async function queryByPrefix(
  deps: Deps,
  pk: string,
  prefix: string | null,
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

function tripCardResponse(item: Record<string, unknown>) {
  const tripCardId = String(item.SK).slice(TRIPCARD_SK_PREFIX.length);
  const response: Record<string, unknown> = {
    tripCardId,
    snapshot: item.snapshot,
    ownerId: item.ownerId,
    createdAt: item.createdAt,
  };
  if (item.assignedMemberId !== undefined) {
    response.assignedMemberId = item.assignedMemberId;
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

  return json(201, { tripId, title: input.title, mode: input.mode, updatedAt: timestamp });
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
 */
function buildFieldUpdate(input: { title: string; startDate?: string; endDate?: string }, timestamp: string) {
  const names: Record<string, string> = { "#title": "title", "#updatedAt": "updatedAt" };
  const values: Record<string, unknown> = { ":title": input.title, ":updatedAt": timestamp };
  const setParts = ["#title = :title", "#updatedAt = :updatedAt"];
  const removeParts: string[] = [];

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
  const update = buildFieldUpdate(input, timestamp);

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
        { Update: { TableName: deps.tableName, Key: tripMetaKey(tripId), ...update } },
        ...memberRows.map((row) => {
          const memberUserId = String(row.SK).slice(MEMBER_SK_PREFIX.length);
          return {
            Update: { TableName: deps.tableName, Key: tripMembershipKey(memberUserId, tripId), ...update },
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
