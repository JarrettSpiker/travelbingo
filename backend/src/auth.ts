import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "./context.ts";
import { forbidden, notFound, unauthorized } from "./http.ts";
import { membershipKey } from "./lib/keys.ts";

/**
 * Roles a membership can carry. Only "owner" is issued today; the parameter
 * exists so that adding an editor or viewer role is a change here and in the
 * `allowed` argument at each call site, not a rewrite of the authorization
 * model. See design.md.
 */
export type Role = "owner";

export const OWNER_ONLY: readonly Role[] = ["owner"];

export interface Membership {
  role: Role;
  title: string;
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
