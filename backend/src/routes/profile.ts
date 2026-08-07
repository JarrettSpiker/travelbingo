import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "../context.ts";
import { badRequest, json, unauthorized, type JsonResponse } from "../http.ts";
import { profileKey } from "../lib/keys.ts";
import { parseDisplayName } from "../lib/profilePayload.ts";
import type { RouteRequest } from "../request.ts";

interface ProfileItem {
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProfileBody {
  displayName: string | null;
  updatedAt: string | null;
}

function requireUser(request: RouteRequest): string {
  if (!request.userId) throw unauthorized();
  return request.userId;
}

function toProfile(item: ProfileItem | undefined): ProfileBody {
  if (!item) return { displayName: null, updatedAt: null };
  return { displayName: item.displayName ?? null, updatedAt: item.updatedAt ?? null };
}

/**
 * Reads the caller's own profile. The key is built solely from the verified
 * identity, so a user can only ever read USER#<own-sub>/PROFILE — there is no
 * membership to check and no second user involved. Returns 200 with a null
 * display name when no item exists yet, never 404: the profile is implied by
 * the account, and its absence just means "no display name set."
 */
export async function getProfile(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);

  const result = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: profileKey(userId) }),
  );
  const item = result.Item as ProfileItem | undefined;

  return json(200, toProfile(item));
}

/**
 * Upserts the caller's own profile. Validates the display name (reject rather
 * than correct), then writes the whole document: createdAt is set on the first
 * write and preserved on update; updatedAt is always refreshed. Returns the new
 * profile so the client updates its cached state from the server's view rather
 * than echoing the request.
 */
export async function updateProfile(deps: Deps, request: RouteRequest): Promise<JsonResponse> {
  const userId = requireUser(request);
  const key = profileKey(userId);

  const body = request.body;
  if (typeof body !== "object" || body === null) throw badRequest("body must be an object");
  const displayName = parseDisplayName((body as Record<string, unknown>).displayName);

  // Preserve createdAt across updates; the profile is written lazily on the
  // first PUT, so its absence means this is the first write.
  const existing = await deps.ddb.send(
    new GetCommand({ TableName: deps.tableName, Key: key }),
  );
  const prev = existing.Item as ProfileItem | undefined;
  const now = deps.now();
  const item: ProfileItem = {
    displayName,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };

  await deps.ddb.send(
    new PutCommand({ TableName: deps.tableName, Item: { ...key, ...item } }),
  );

  return json(200, toProfile(item));
}
