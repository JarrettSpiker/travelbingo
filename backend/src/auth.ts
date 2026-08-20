import { GetCommand } from "@aws-sdk/lib-dynamodb";
import type { Deps } from "./context.ts";
import { forbidden, notFound, unauthorized } from "./http.ts";
import { membershipKey, tripCardKey, tripMembershipKey, tripMetaKey } from "./lib/keys.ts";
import type { WinCondition } from "./lib/winCondition.ts";

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

/**
 * The minimum of a trip's META that entitlement to play depends on. Kept here
 * rather than imported from routes/trips.ts so authorization does not depend on
 * a route module; the two shapes are structurally compatible.
 */
interface PlayableTripMeta {
  mode: "cooperative" | "competitive";
  /** Absent on trips created before win conditions existed — read as a line. */
  winCondition?: WinCondition;
  /** The trip's title, for notification fan-out; absent only on corrupt items. */
  title?: string;
  startDate?: string;
  endDate?: string;
}

/** What a trip card's item carries that entitlement to play depends on. */
interface PlayableTripCard {
  snapshot: unknown;
  ownerId: string;
  assignedMemberId?: string;
  markedSlots?: Set<number>;
  progressUpdatedAt?: string;
}

export interface TripCardPlayer {
  membership: TripMembership;
  trip: PlayableTripMeta;
  card: PlayableTripCard;
}

/**
 * The play authorization check, a third sibling of {@link requireCardRole} and
 * {@link requireTripRole}. Every modification of a trip card's marks goes
 * through it; no route writes its own.
 *
 * Trip membership is required first, inheriting that routine's non-leak rule
 * unchanged. On top of it:
 *
 *   cooperative                  every member plays every card
 *   competitive, assigned        only the assignee
 *   competitive, unassigned      nobody
 *
 * **The administrator is deliberately not privileged.** An admin assigns,
 * reassigns, and removes cards, but marking is playing, and playing someone
 * else's card is not an administrative act. Granting it would also make the
 * competitive rule untestable in practice, since the admin is a member of every
 * trip they run.
 *
 * A trip card that does not exist is a 404, matching the sibling rule that
 * absence and inaccessibility are indistinguishable: a member already knows the
 * trip exists, but must not be able to probe which tripCardIds are real. A
 * member who is not this card's player is a 403, which reveals only that the
 * card exists in a trip they are already in.
 *
 * Returns the trip meta and the card item so the caller does not re-read them —
 * three point reads, and the count is pinned by a test.
 */
export async function requireTripCardPlayer(
  deps: Deps,
  userId: string,
  tripId: string,
  tripCardId: string,
): Promise<TripCardPlayer> {
  const membership = await requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER);

  const [metaResult, cardResult] = await Promise.all([
    deps.ddb.send(new GetCommand({ TableName: deps.tableName, Key: tripMetaKey(tripId) })),
    deps.ddb.send(new GetCommand({ TableName: deps.tableName, Key: tripCardKey(tripId, tripCardId) })),
  ]);

  const trip = metaResult.Item as PlayableTripMeta | undefined;
  const card = cardResult.Item as PlayableTripCard | undefined;
  if (!trip || !card) {
    throw notFound();
  }

  // Default-deny, deliberately written as "only cooperative is permissive"
  // rather than "competitive is restrictive". The two are equivalent for the
  // two modes that exist, and differ for every value that should not: a mode
  // that is missing, corrupt, or added later closes the card instead of opening
  // it to the whole trip. Payload validation already bars those, but this is the
  // one module where a fail-open default is least acceptable.
  if (trip.mode !== "cooperative" && card.assignedMemberId !== userId) {
    throw forbidden();
  }

  return { membership, trip, card };
}
