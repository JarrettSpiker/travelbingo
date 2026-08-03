import { GetCommand, QueryCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { OWNER_ONLY, requireCardRole } from "../auth.ts";
import type { Deps } from "../context.ts";
import { badRequest, json, noContent, notFound, unauthorized, type JsonResponse } from "../http.ts";
import { parseCardPayload, parseTitle, PAYLOAD_VERSION, type CardPayload } from "../lib/cardPayload.ts";
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

interface CardMeta extends CardPayload {
  ownerId: string;
  payloadVersion: number;
  createdAt: string;
  updatedAt: string;
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
 * A single Query, with no per-card lookup. This is why `title` is denormalized
 * onto the membership item — the alternative is an N+1 BatchGetItem on the
 * hottest read path.
 */
export async function listCards(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const items = await listMemberships(deps, userId);

  const cards = items
    .map((item) => {
      const cardId = cardIdFromMembershipSk(String(item.SK));
      return cardId === null
        ? null
        : { cardId, title: String(item.title ?? ""), role: item.role, updatedAt: item.updatedAt };
    })
    .filter((card) => card !== null);

  return json(200, { cards });
}

export async function createCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const payload = parseCardPayload(request.body);

  // Counted rather than tracked on the profile item: a counter would need its
  // own transaction to stay consistent with the memberships, and at a cap of
  // 200 the query is one page.
  const existing = await listMemberships(deps, userId);
  if (existing.length >= MAX_CARDS_PER_USER) {
    throw badRequest(`a user may store at most ${MAX_CARDS_PER_USER} cards`);
  }

  const cardId = newId(deps);
  const timestamp = deps.now();

  const meta: CardMeta = {
    ...payload,
    ownerId: userId,
    payloadVersion: PAYLOAD_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
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
 * Replaces a card's contents. The membership's denormalized title is updated in
 * the same transaction, so the two can never drift.
 */
export async function replaceCard(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const payload = parseCardPayload(request.body);
  const timestamp = deps.now();

  await deps.ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: deps.tableName,
            Key: cardMetaKey(cardId),
            UpdateExpression:
              "SET #slots = :slots, #title = :title, #hasFreeSpace = :hasFreeSpace, #freeSpaceText = :freeSpaceText, #colorScheme = :colorScheme, #fontScheme = :fontScheme, #emojiScheme = :emojiScheme, #payloadVersion = :payloadVersion, #updatedAt = :updatedAt",
            ExpressionAttributeNames: {
              "#slots": "slots",
              "#title": "title",
              "#hasFreeSpace": "hasFreeSpace",
              "#freeSpaceText": "freeSpaceText",
              "#colorScheme": "colorScheme",
              "#fontScheme": "fontScheme",
              "#emojiScheme": "emojiScheme",
              "#payloadVersion": "payloadVersion",
              "#updatedAt": "updatedAt",
            },
            ExpressionAttributeValues: {
              ":slots": payload.slots,
              ":title": payload.title,
              ":hasFreeSpace": payload.hasFreeSpace,
              ":freeSpaceText": payload.freeSpaceText,
              ":colorScheme": payload.colorScheme,
              ":fontScheme": payload.fontScheme,
              ":emojiScheme": payload.emojiScheme,
              ":payloadVersion": PAYLOAD_VERSION,
              ":updatedAt": timestamp,
            },
          },
        },
        {
          Update: {
            TableName: deps.tableName,
            Key: membershipKey(userId, cardId),
            UpdateExpression: "SET #title = :title, #updatedAt = :updatedAt",
            ExpressionAttributeNames: { "#title": "title", "#updatedAt": "updatedAt" },
            ExpressionAttributeValues: { ":title": payload.title, ":updatedAt": timestamp },
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

  const result = await deps.ddb.send(
    new QueryCommand({
      TableName: deps.tableName,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": cardPartition(cardId) },
    }),
  );

  const keys: { PK: string; SK: string }[] = [];

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

  await deleteKeys(deps, keys);

  return noContent();
}
