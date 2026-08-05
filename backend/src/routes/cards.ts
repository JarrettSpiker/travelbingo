import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { OWNER_ONLY, requireCardRole } from "../auth.ts";
import type { Deps } from "../context.ts";
import { badRequest, json, noContent, notFound, unauthorized, type JsonResponse } from "../http.ts";
import { parseCardPayload, parseThumbnail, parseTitle, PAYLOAD_VERSION, type CardPayload } from "../lib/cardPayload.ts";
import {
  CARD_SK_PREFIX,
  cardIdFromMembershipSk,
  cardMemberKey,
  cardMetaKey,
  cardPartition,
  membershipKey,
  shareKey,
  tokenFromSharePointerSk,
  userPartition,
} from "../lib/keys.ts";
import { thumbnailKeyFor } from "../lib/thumbnailStore.ts";
import { deleteKeys } from "../lib/batch.ts";
import type { RouteRequest } from "../request.ts";

/** Bounds what one account can accumulate. Abuse, not usage, is the cost risk. */
export const MAX_CARDS_PER_USER = 200;

const ID_BYTES = 16;

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

function newId(deps: Deps): string {
  return deps.randomBytes(ID_BYTES).toString("base64url");
}

/**
 * The thumbnail rides as a sibling `thumbnail` field on the save body. It is
 * extracted and validated separately from the card payload: parseCardPayload
 * ignores unknown fields, so the two validations are independent, and an
 * invalid thumbnail is dropped (not stored) while the card still saves.
 */
function readThumbnail(body: unknown): Buffer | null {
  if (typeof body !== "object" || body === null) return null;
  return parseThumbnail((body as Record<string, unknown>).thumbnail);
}

interface CardMeta extends CardPayload {
  ownerId: string;
  payloadVersion: number;
  createdAt: string;
  updatedAt: string;
  /** Present iff a thumbnail object was written for this card. */
  thumbnailKey?: string;
}

function toCardPayload(meta: CardMeta): CardPayload {
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

async function listMemberships(deps: Deps, userId: string) {
  const result = await deps.ddb.send(
    new QueryCommand({
      TableName: deps.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": userPartition(userId), ":sk": CARD_SK_PREFIX },
    }),
  );
  return result.Items ?? [];
}

/**
 * A single Query, with no per-card lookup. This is why `title` (and
 * `thumbnailKey`) is denormalized onto the membership item — the alternative is
 * an N+1 BatchGetItem on the hottest read path.
 *
 * The Query is scoped to the caller's own partition, so every item returned is a
 * card the user is a member of: the presigned thumbnail URL for each is issued
 * only against memberships the caller holds, which is the same authorization the
 * shared `requireCardRole` routine enforces on the single-resource paths.
 */
export async function listCards(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const items = await listMemberships(deps, userId);

  const cards = await Promise.all(
    items.map(async (item) => {
      const cardId = cardIdFromMembershipSk(String(item.SK));
      if (cardId === null) return null;

      const entry: Record<string, unknown> = {
        cardId,
        title: String(item.title ?? ""),
        role: item.role,
        updatedAt: item.updatedAt,
      };

      // Presign only for cards that actually have a thumbnail object. Signing is
      // local (SigV4), so N presigns add no network round-trips to the one Query.
      if (typeof item.thumbnailKey === "string" && item.thumbnailKey !== "") {
        entry.thumbnailKey = item.thumbnailKey;
        entry.thumbnailUrl = await deps.thumbnailStore.presignGet(item.thumbnailKey);
      }

      return entry;
    }),
  );

  return json(200, { cards: cards.filter((card) => card !== null) });
}

export async function createCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const payload = parseCardPayload(request.body);
  const thumbnailBytes = readThumbnail(request.body);

  // Counted rather than tracked on the profile item: a counter would need its
  // own transaction to stay consistent with the memberships, and at a cap of
  // 200 the query is one page.
  const existing = await listMemberships(deps, userId);
  if (existing.length >= MAX_CARDS_PER_USER) {
    throw badRequest(`a user may store at most ${MAX_CARDS_PER_USER} cards`);
  }

  const cardId = newId(deps);
  const timestamp = deps.now();
  const thumbnailKey = thumbnailBytes ? thumbnailKeyFor(cardId) : undefined;

  // Fail-together: write the thumbnail before the record so an S3 failure leaves
  // no card claiming a thumbnail it does not have. An orphaned object from a
  // subsequent DDB failure is reaped by the thumbnail bucket's lifecycle rule.
  if (thumbnailBytes && thumbnailKey) {
    await deps.thumbnailStore.put(thumbnailKey, thumbnailBytes);
  }

  const meta: CardMeta = {
    ...payload,
    ownerId: userId,
    payloadVersion: PAYLOAD_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...(thumbnailKey ? { thumbnailKey } : {}),
  };

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: deps.tableName,
            Item: { ...cardMetaKey(cardId), ...meta },
            ConditionExpression: "attribute_not_exists(PK)",
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            Item: {
              ...membershipKey(userId, cardId),
              role: "owner",
              title: payload.title,
              updatedAt: timestamp,
              ...(thumbnailKey ? { thumbnailKey } : {}),
            },
          },
        },
        {
          Put: {
            TableName: deps.tableName,
            // Mirror of the membership, hanging off the card, so a delete can
            // cascade without scanning for members.
            Item: { ...cardMemberKey(cardId, userId), role: "owner", createdAt: timestamp },
          },
        },
      ],
    }),
  );

  return json(201, { cardId, title: payload.title, updatedAt: timestamp });
}

export async function getCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: cardMetaKey(cardId) }),
  );

  const meta = result.Item as CardMeta | undefined;
  if (!meta) throw notFound();

  return json(200, { cardId, card: toCardPayload(meta), updatedAt: meta.updatedAt });
}

/**
 * Replaces a card's contents. The membership's denormalized title (and
 * thumbnail key) is updated in the same transaction, so the two can never drift.
 */
export async function replaceCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const payload = parseCardPayload(request.body);
  const thumbnailBytes = readThumbnail(request.body);
  const timestamp = deps.now();

  // Fail-together with the card write (see createCard). A re-save without a
  // thumbnail is the client generation-failure path: it leaves the existing
  // thumbnail in place rather than clearing it.
  if (thumbnailBytes) {
    await deps.thumbnailStore.put(thumbnailKeyFor(cardId), thumbnailBytes);
  }

  // The thumbnail key is SET only when a fresh thumbnail was written this save;
  // when no thumbnail is supplied the existing key is left untouched.
  const metaNames: Record<string, string> = {
    "#slots": "slots",
    "#title": "title",
    "#hasFreeSpace": "hasFreeSpace",
    "#freeSpaceText": "freeSpaceText",
    "#colorScheme": "colorScheme",
    "#fontScheme": "fontScheme",
    "#emojiScheme": "emojiScheme",
    "#payloadVersion": "payloadVersion",
    "#updatedAt": "updatedAt",
  };
  const metaValues: Record<string, unknown> = {
    ":slots": payload.slots,
    ":title": payload.title,
    ":hasFreeSpace": payload.hasFreeSpace,
    ":freeSpaceText": payload.freeSpaceText,
    ":colorScheme": payload.colorScheme,
    ":fontScheme": payload.fontScheme,
    ":emojiScheme": payload.emojiScheme,
    ":payloadVersion": PAYLOAD_VERSION,
    ":updatedAt": timestamp,
  };
  const membershipNames: Record<string, string> = { "#title": "title", "#updatedAt": "updatedAt" };
  const membershipValues: Record<string, unknown> = { ":title": payload.title, ":updatedAt": timestamp };

  if (thumbnailBytes) {
    metaNames["#thumbnailKey"] = "thumbnailKey";
    metaValues[":thumbnailKey"] = thumbnailKeyFor(cardId);
    membershipNames["#thumbnailKey"] = "thumbnailKey";
    membershipValues[":thumbnailKey"] = thumbnailKeyFor(cardId);
  }
  const thumbnailSet = thumbnailBytes ? ", #thumbnailKey = :thumbnailKey" : "";

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: deps.tableName,
            Key: cardMetaKey(cardId),
            UpdateExpression: `SET #slots = :slots, #title = :title, #hasFreeSpace = :hasFreeSpace, #freeSpaceText = :freeSpaceText, #colorScheme = :colorScheme, #fontScheme = :fontScheme, #emojiScheme = :emojiScheme, #payloadVersion = :payloadVersion, #updatedAt = :updatedAt${thumbnailSet}`,
            ExpressionAttributeNames: metaNames,
            ExpressionAttributeValues: metaValues,
          },
        },
        {
          Update: {
            TableName: deps.tableName,
            Key: membershipKey(userId, cardId),
            UpdateExpression: `SET #title = :title, #updatedAt = :updatedAt${thumbnailSet}`,
            ExpressionAttributeNames: membershipNames,
            ExpressionAttributeValues: membershipValues,
          },
        },
      ],
    }),
  );

  return json(200, { cardId, title: payload.title, updatedAt: timestamp });
}

export async function renameCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const body = request.body;
  if (typeof body !== "object" || body === null) throw badRequest("body must be an object");
  const title = parseTitle((body as Record<string, unknown>).title);
  const timestamp = deps.now();

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: deps.tableName,
            Key: cardMetaKey(cardId),
            UpdateExpression: "SET #title = :title, #updatedAt = :updatedAt",
            ExpressionAttributeNames: { "#title": "title", "#updatedAt": "updatedAt" },
            ExpressionAttributeValues: { ":title": title, ":updatedAt": timestamp },
          },
        },
        {
          Update: {
            TableName: deps.tableName,
            Key: membershipKey(userId, cardId),
            UpdateExpression: "SET #title = :title, #updatedAt = :updatedAt",
            ExpressionAttributeNames: { "#title": "title", "#updatedAt": "updatedAt" },
            ExpressionAttributeValues: { ":title": title, ":updatedAt": timestamp },
          },
        },
      ],
    }),
  );

  return json(200, { cardId, title, updatedAt: timestamp });
}

/**
 * Deletes a card and everything hanging off it: its metadata, every
 * membership, and every share link. A share left behind would keep serving a
 * snapshot of a card its owner believes they deleted.
 */
export async function deleteCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  // Collect every item in the card's partition, paging until DynamoDB stops
  // returning a LastEvaluatedKey. A single Query returns at most 1 MB; without
  // the loop, share pointers past the last page would survive the delete and
  // keep serving snapshots of a card its owner believes they deleted.
  const keys: { PK: string; SK: string }[] = [];
  let startKey: Record<string, unknown> | undefined;

  do {
    const result = await deps.ddb.send(
      new QueryCommand({
        TableName: deps.tableName,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": cardPartition(cardId) },
        ExclusiveStartKey: startKey,
      }),
    );

    for (const item of result.Items ?? []) {
      const sk = String(item.SK);
      keys.push({ PK: String(item.PK), SK: sk });

      // Items in other partitions that this card owns, and that the query above
      // therefore cannot see.
      const token = tokenFromSharePointerSk(sk);
      if (token !== null) keys.push(shareKey(token));

      if (sk.startsWith("MEMBER#")) {
        keys.push(membershipKey(sk.slice("MEMBER#".length), cardId));
      }
    }

    startKey = result.LastEvaluatedKey;
  } while (startKey);

  await deleteKeys(deps, keys);

  // The thumbnail object lives in S3, outside the card's DynamoDB partition, so
  // the cascade above cannot reach it. The key is derived from the cardId, so no
  // lookup is needed. Delete is idempotent; a transient failure is swallowed so
  // it never blocks a card deletion the user has already confirmed.
  try {
    await deps.thumbnailStore.delete(thumbnailKeyFor(cardId));
  } catch {
    // A stranded object is reaped by the thumbnail bucket's lifecycle rule.
  }

  return noContent();
}
