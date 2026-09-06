// The only module that knows the table's key format. Everything else asks for
// a key by name, so a layout change is contained here.
//
// Single table, PK/SK, no GSIs:
//
//   CARD#<cardId>   META            ownerId, title, slots[], ...
//   USER#<sub>      CARD#<cardId>   role, title, updatedAt   <- title denormalized
//   CARD#<cardId>   MEMBER#<sub>    role, createdAt
//   CARD#<cardId>   SHARE#<token>   createdAt                <- owner-facing pointer
//   SHARE#<token>   META            cardId, ownerId, snapshot{}, createdAt
//   USER#<sub>      PROFILE         displayName, createdAt, updatedAt
//
//   TRIP#<tripId>   META            ownerId, title, mode, startDate?, endDate?, createdAt, updatedAt
//   USER#<sub>      TRIP#<tripId>   role(admin|member), title, startDate?, endDate?, updatedAt   <- "my trips" listing row
//   TRIP#<tripId>   MEMBER#<sub>    role, createdAt                              <- cascade-delete mirror
//   TRIP#<tripId>   TRIPCARD#<id>   snapshot{}, ownerId, assignedMemberId?, createdAt,   <- render-only snapshot
//                                   markedSlots?: Set<Number>, progressUpdatedAt?  <- play progress
//   TRIP#<tripId>   INVITE#<token>  createdAt                                    <- admin-facing pointer (list/revoke)
//   INVITE#<token>  META            tripId, title, createdAt, revokedAt?        <- redemption record
//
//   TRIP#<tripId>   EVENT#<ts>#<r>  type, actorId, tripCardId, detail{}, createdAt, expiresAt  <- activity feed, TTL-bound
//   USER#<sub>      NOTIF#<ts>#<r>  type, tripId, tripTitle, actorId, tripCardId, createdAt,
//                                   expiresAt                                          <- per-user bell, TTL-bound
//   USER#<sub>      NOTIFREAD       readUpTo, updatedAt                          <- read marker (one item, not one per row)
//   USER#<sub>      NOTIFPREFS      types{progress_marked,one_away,victory}, mutedTripIds[], createdAt, updatedAt
//
//   FEEDBACK#<date> <ts>#<r>        message, contact?, context{}, submitterId, createdAt,
//                                   expiresAt                                    <- the submission, TTL-bound
//   USER#<sub>      FEEDBACK#<ts>#<r>  createdAt, expiresAt                       <- cap pointer, carries no text

export interface TableKey {
  PK: string;
  SK: string;
}

export const CARD_SK_PREFIX = "CARD#";
export const MEMBER_SK_PREFIX = "MEMBER#";
export const SHARE_SK_PREFIX = "SHARE#";
export const TRIP_SK_PREFIX = "TRIP#";
export const TRIPCARD_SK_PREFIX = "TRIPCARD#";
export const INVITE_SK_PREFIX = "INVITE#";
export const EVENT_SK_PREFIX = "EVENT#";
export const NOTIF_SK_PREFIX = "NOTIF#";
export const FEEDBACK_SK_PREFIX = "FEEDBACK#";

export function cardMetaKey(cardId: string): TableKey {
  return { PK: `CARD#${cardId}`, SK: "META" };
}

/**
 * A user's membership of a card. This is the authorization record and the
 * "my cards" listing row at once — which is why `title` is denormalized onto
 * it, so listing is a single Query with no per-card lookup.
 */
export function membershipKey(userId: string, cardId: string): TableKey {
  return { PK: `USER#${userId}`, SK: `${CARD_SK_PREFIX}${cardId}` };
}

/** The mirror of a membership, hanging off the card, for cascade deletes. */
export function cardMemberKey(cardId: string, userId: string): TableKey {
  return { PK: `CARD#${cardId}`, SK: `${MEMBER_SK_PREFIX}${userId}` };
}

/** Owner-facing pointer, so a card's share links can be listed and revoked. */
export function cardSharePointerKey(cardId: string, token: string): TableKey {
  return { PK: `CARD#${cardId}`, SK: `${SHARE_SK_PREFIX}${token}` };
}

/** The share itself, holding the frozen snapshot. Resolved without an account. */
export function shareKey(token: string): TableKey {
  return { PK: `SHARE#${token}`, SK: "META" };
}

export function profileKey(userId: string): TableKey {
  return { PK: `USER#${userId}`, SK: "PROFILE" };
}

export function userPartition(userId: string): string {
  return `USER#${userId}`;
}

export function cardPartition(cardId: string): string {
  return `CARD#${cardId}`;
}

/** Recovers the card id from a membership item's sort key. */
export function cardIdFromMembershipSk(sk: string): string | null {
  return sk.startsWith(CARD_SK_PREFIX) ? sk.slice(CARD_SK_PREFIX.length) : null;
}

/** Recovers the token from a share pointer's sort key. */
export function tokenFromSharePointerSk(sk: string): string | null {
  return sk.startsWith(SHARE_SK_PREFIX) ? sk.slice(SHARE_SK_PREFIX.length) : null;
}

// --- Trips -----------------------------------------------------------------

export function tripMetaKey(tripId: string): TableKey {
  return { PK: `TRIP#${tripId}`, SK: "META" };
}

/**
 * A user's membership of a trip. Doubles as the "my trips" listing row, which
 * is why `title` and the optional dates are denormalized onto it — mirroring the
 * card membership row, so listing a user's trips stays a single Query with no
 * per-trip lookup.
 */
export function tripMembershipKey(userId: string, tripId: string): TableKey {
  return { PK: `USER#${userId}`, SK: `${TRIP_SK_PREFIX}${tripId}` };
}

/** The mirror of a trip membership, hanging off the trip, for cascade deletes. */
export function tripMemberKey(tripId: string, userId: string): TableKey {
  return { PK: `TRIP#${tripId}`, SK: `${MEMBER_SK_PREFIX}${userId}` };
}

/**
 * A frozen, render-only card snapshot within a trip, and the anchor its play
 * progress hangs off. `markedSlots` is a DynamoDB number set, so marking and
 * unmarking are atomic ADD/DELETE operations on a single attribute rather than
 * a read-modify-write; a set cannot be empty, so unmarking the last square
 * removes the attribute and "absent" means "nothing marked".
 */
export function tripCardKey(tripId: string, tripCardId: string): TableKey {
  return { PK: `TRIP#${tripId}`, SK: `${TRIPCARD_SK_PREFIX}${tripCardId}` };
}

/** Admin-facing pointer, so a trip's invite links can be listed and revoked. */
export function tripInvitePointerKey(tripId: string, token: string): TableKey {
  return { PK: `TRIP#${tripId}`, SK: `${INVITE_SK_PREFIX}${token}` };
}

/** The invite itself, resolvable without an account to show the trip title. */
export function inviteKey(token: string): TableKey {
  return { PK: `INVITE#${token}`, SK: "META" };
}

export function tripPartition(tripId: string): string {
  return `TRIP#${tripId}`;
}

/** Recovers the trip id from a membership item's sort key. */
export function tripIdFromMembershipSk(sk: string): string | null {
  return sk.startsWith(TRIP_SK_PREFIX) ? sk.slice(TRIP_SK_PREFIX.length) : null;
}

/** Recovers the token from a trip invite pointer's sort key. */
export function tokenFromInvitePointerSk(sk: string): string | null {
  return sk.startsWith(INVITE_SK_PREFIX) ? sk.slice(INVITE_SK_PREFIX.length) : null;
}

// --- Play events and notifications ------------------------------------------

/**
 * A play event in the trip's own partition — the activity feed's row. The
 * `<isoTs>#<rand>` sort suffix gives most-recent-first ordering from a
 * descending query with no GSI, and the random tail keeps two events in the
 * same millisecond from colliding.
 */
export function tripEventKey(tripId: string, sortId: string): TableKey {
  return { PK: `TRIP#${tripId}`, SK: `${EVENT_SK_PREFIX}${sortId}` };
}

/**
 * A notification in a member's partition — the bell's row. Carries the trip
 * title denormalized (the bell must render without reading fifty trips) but
 * never an actor name, which is resolved at read time so renames don't drift.
 */
export function userNotificationKey(userId: string, sortId: string): TableKey {
  return { PK: `USER#${userId}`, SK: `${NOTIF_SK_PREFIX}${sortId}` };
}

/** The caller's notification preferences, sibling of PROFILE. */
export function notificationPrefsKey(userId: string): TableKey {
  return { PK: `USER#${userId}`, SK: "NOTIFPREFS" };
}

/**
 * The caller's read marker: a single read-up-to timestamp rather than a
 * per-notification read bit, so marking read is one small write.
 */
export function notificationReadKey(userId: string): TableKey {
  return { PK: `USER#${userId}`, SK: "NOTIFREAD" };
}

/** Recovers the `<ts>#<rand>` sort id from a notification item's sort key. */
export function sortIdFromNotificationSk(sk: string): string | null {
  return sk.startsWith(NOTIF_SK_PREFIX) ? sk.slice(NOTIF_SK_PREFIX.length) : null;
}

// --- Feedback ---------------------------------------------------------------

/**
 * A submission, partitioned by the UTC date it was made. The date is the
 * partition rather than the submitter because the read path wants "everything
 * recent" and there are no GSIs — a handful of date partitions is a bounded
 * query, where a submitter-partitioned layout would need a scan of the whole
 * table to answer the same question.
 *
 * The `<isoTs>#<rand>` sort suffix is the notification idiom, for the same two
 * reasons: descending order without a GSI, and no collision within a
 * millisecond.
 */
export function feedbackKey(date: string, sortId: string): TableKey {
  return { PK: `FEEDBACK#${date}`, SK: sortId };
}

/**
 * The submitter-facing pointer, written in the same transaction as the
 * submission. It exists only so the per-account cap is a query on one
 * partition, and so it deliberately carries no message text — the cap check
 * must never read what anyone wrote.
 *
 * Mirrors the card/share pointer pair rather than inventing a pattern.
 */
export function userFeedbackPointerKey(userId: string, sortId: string): TableKey {
  return { PK: `USER#${userId}`, SK: `${FEEDBACK_SK_PREFIX}${sortId}` };
}

/** The UTC date partition a timestamp belongs to, as `YYYY-MM-DD`. */
export function feedbackPartition(date: string): string {
  return `FEEDBACK#${date}`;
}
