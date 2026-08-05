import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { OWNER_ONLY, requireCardRole } from "../auth.ts";
import type { Deps } from "../context.ts";
import { json, noContent, notFound, unauthorized, type JsonResponse } from "../http.ts";
import type { CardPayload } from "../lib/cardPayload.ts";
import {
  cardMetaKey,
  cardPartition,
  cardSharePointerKey,
  SHARE_SK_PREFIX,
  shareKey,
  tokenFromSharePointerSk,
} from "../lib/keys.ts";
import { putShareWithUniqueToken } from "../lib/shareToken.ts";
import type { RouteRequest } from "../request.ts";

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

interface ShareItem {
  cardId: string;
  ownerId: string;
  snapshot: CardPayload;
  createdAt: string;
}

/**
 * Mints a share link holding a frozen copy of the card as it is right now.
 *
 * The snapshot is stored rather than referenced on purpose: the recipient
 * receives a copy, so later edits by the owner must not reach through the link,
 * and deleting the card must not turn an existing link into a dangling read.
 */
export async function createShare(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: cardMetaKey(cardId) }),
  );
  const meta = result.Item as (CardPayload & { ownerId: string }) | undefined;
  if (!meta) throw notFound();

  const createdAt = deps.now();
  const snapshot: CardPayload = {
    slots: meta.slots,
    entries: meta.entries,
    title: meta.title,
    hasFreeSpace: meta.hasFreeSpace,
    freeSpaceText: meta.freeSpaceText,
    colorScheme: meta.colorScheme,
    fontScheme: meta.fontScheme,
    emojiScheme: meta.emojiScheme,
  };

  const token = await putShareWithUniqueToken(deps, () => ({
    cardId,
    ownerId: userId,
    snapshot,
    createdAt,
  }));

  // Owner-facing pointer, written after the share itself. If this write failed,
  // the share would exist but not be listable — the safe direction, since the
  // reverse would list a link that resolves to nothing.
  await deps.ddb.send(
    new PutCommand({
      TableName: deps.tableName,
      Item: { ...cardSharePointerKey(cardId, token), createdAt },
    }),
  );

  return json(201, { token, createdAt });
}

export async function listShares(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  const result = await deps.ddb.send(
    new QueryCommand({
      TableName: deps.tableName,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :sk)",
      ExpressionAttributeValues: { ":pk": cardPartition(cardId), ":sk": SHARE_SK_PREFIX },
    }),
  );

  const shares = (result.Items ?? [])
    .map((item) => {
      const token = tokenFromSharePointerSk(String(item.SK));
      return token === null ? null : { token, createdAt: item.createdAt };
    })
    .filter((share) => share !== null);

  return json(200, { shares });
}

/**
 * Revokes a link. This stops the link resolving from now on; it cannot retract
 * a copy a recipient has already taken. The share dialog says so in as many
 * words — see design.md.
 */
export async function revokeShare(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const cardId = request.params.cardId ?? "";
  const token = request.params.token ?? "";
  await requireCardRole(deps, userId, cardId, OWNER_ONLY);

  // Read the share first, so a token belonging to a different card cannot be
  // revoked by an owner who happens to own some other card.
  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: shareKey(token) }),
  );
  const share = result.Item as ShareItem | undefined;
  if (!share || share.cardId !== cardId) throw notFound();

  await deps.ddb.send(new DeleteCommand({ TableName: deps.tableName, Key: shareKey(token) }));
  await deps.ddb.send(
    new DeleteCommand({ TableName: deps.tableName, Key: cardSharePointerKey(cardId, token) }),
  );

  return noContent();
}

/**
 * The one route reachable without an account. It is explicitly designated
 * public in the API's route configuration rather than by relaxing
 * authentication broadly.
 *
 * A revoked token and a token that never existed return the identical 404 — the
 * recipient of a revoked link learns nothing about whether it was ever real.
 */
export async function resolveShare(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const token = request.params.token ?? "";

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: shareKey(token) }),
  );
  const share = result.Item as ShareItem | undefined;
  if (!share) throw notFound();

  // Deliberately no ownerId and no cardId: the recipient gets the card, not a
  // handle on the owner's account or on the original card's identity.
  return json(200, { card: share.snapshot, createdAt: share.createdAt });
}
