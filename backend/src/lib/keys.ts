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

export interface TableKey {
  PK: string;
  SK: string;
}

export const CARD_SK_PREFIX = "CARD#";
export const MEMBER_SK_PREFIX = "MEMBER#";
export const SHARE_SK_PREFIX = "SHARE#";

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
