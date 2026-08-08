import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "./context.ts";
import { forbidden, notFound, unauthorized } from "./http.ts";
import { membershipKey, tripMembershipKey } from "./lib/keys.ts";

/**
 * Roles a membership can carry. Only "owner" is issued today; the parameter
 * exists so that adding an editor or viewer role is a change here and in the
 * `allowed` argument at each call site, not a rewrite of the authorization
 * model. See design.md.
 */
export type Role = "owner";

export const OWNER_ONLY: readonly Role[] = ["owner"];

/**
 * Trip membership roles. The creator is the trip's administrator for its
 * lifetime; invited members carry the "member" role. A sibling of {@link Role}
 * rather than a generalization, so the frozen card path is left untouched.
 */
export type TripRole = "admin" | "member";

export const ADMIN_ONLY: readonly TripRole[] = ["admin"];
export const ADMIN_OR_MEMBER: readonly TripRole[] = ["admin", "member"];

export interface Membership {
  role: Role;
  title: string;
  updatedAt: string;
}

/**
 * A trip membership, carrying the denormalized listing fields alongside the
 * role. The title (and optional dates) live here so a user's trips can be listed
 * with a single query, mirroring the card membership row.
 */
export interface TripMembership {
  role: TripRole;
  title: string;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
}

/**
 * The caller's identity, and the only place it is ever established.
 *
 * It comes solely from the `sub` claim of the JWT that API Gateway's authorizer
 * already verified — signature, issuer, audience, and expiry — before this
 * function ran. A user id in a body, path, query string, or unverified header
 * is ignored everywhere in this codebase.
 */
export function getUserId(claims: Record<string, unknown> | undefined): string {
  const sub = claims?.sub;
  if (typeof sub !== "string" || sub === "") {
    throw unauthorized();
  }
  return sub;
}

/**
 * The single authorization check. Every read and write of a card goes through
 * it; no route writes its own.
 *
 * A missing membership returns 404, not 403. Returning 403 for "this card
 * exists but is not yours" would confirm that another user's card id is real,
 * so absence of a membership is reported identically to absence of the card.
 * 403 is reserved for the case where the caller *does* hold a membership whose
 * role is insufficient — which reveals nothing they did not already know.
 */
export async function requireCardRole(
  deps: Deps,
  userId: string,
  cardId: string,
  allowed: readonly Role[],
): Promise<Membership> {
  const result = await deps.ddb.send(
    new GetCommand({
      TableName: deps.tableName,
      Key: membershipKey(userId, cardId),
    }),
  );

  const item = result.Item as Membership | undefined;
  if (!item) {
    throw notFound();
  }

  if (!allowed.includes(item.role)) {
    throw forbidden();
  }

  return item;
}

/**
 * The trip authorization check, a sibling of {@link requireCardRole}. Every
 * read and write of a trip, its members, its cards, and its invites goes through
 * it; no route writes its own.
 *
 * The same 404-on-missing-membership non-leak rule applies: absence of a
 * membership is reported identically to absence of the trip, so trip ids
 * belonging to other users do not leak. 403 is reserved for a held membership
 * whose role is insufficient. The caller's role comes only from the membership
 * item — never from the request body, path, query, or headers.
 */
export async function requireTripRole(
  deps: Deps,
  userId: string,
  tripId: string,
  allowed: readonly TripRole[],
): Promise<TripMembership> {
  const result = await deps.ddb.send(
    new GetCommand({
      TableName: deps.tableName,
      Key: tripMembershipKey(userId, tripId),
    }),
  );

  const item = result.Item as TripMembership | undefined;
  if (!item) {
    throw notFound();
  }

  if (!allowed.includes(item.role)) {
    throw forbidden();
  }

  return item;
}
