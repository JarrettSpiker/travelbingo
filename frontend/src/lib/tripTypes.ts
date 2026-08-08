import type { ColorScheme } from "./colorScheme";
import type { EmojiScheme } from "./emojiScheme";
import type { FontScheme } from "./fontScheme";

// Hand-mirrored from backend/src/lib/tripPayload.ts and the route response
// shapes, following the repo's cross-package convention (the saved-card shape
// is mirrored the same way; the snapshot is its own type, not the saved-card
// shape). Keep these in sync with the backend when the wire shape changes.

export type TripMode = "cooperative" | "competitive";

export type TripRole = "admin" | "member";

/**
 * A frozen, render-only snapshot of a card, exactly the fields the renderer
 * needs. Mirrors `TripCardSnapshot` in backend/src/lib/tripPayload.ts. It is a
 * strict subset of a saved card — no editable entry pool.
 */
export interface TripCardSnapshot {
  slots: (string | null)[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
}

/** A row in the "my trips" listing. */
export interface TripSummary {
  tripId: string;
  title: string;
  role: TripRole;
  startDate?: string;
  endDate?: string;
  updatedAt: string;
}

export interface TripMember {
  userId: string;
  role: TripRole;
  createdAt: string;
}

export interface Invite {
  token: string;
  createdAt: string;
}

/** A frozen card snapshot within a trip. */
export interface TripCard {
  tripCardId: string;
  snapshot: TripCardSnapshot;
  ownerId: string;
  createdAt: string;
  /** Present only in competitive trips, and only when the admin has assigned it. */
  assignedMemberId?: string;
}

/** The full trip, as returned by GET /api/trips/{tripId}. */
export interface TripDetail {
  tripId: string;
  title: string;
  mode: TripMode;
  createdAt: string;
  updatedAt: string;
  role: TripRole;
  startDate?: string;
  endDate?: string;
  members: TripMember[];
  cards: TripCard[];
  /** Outstanding invites — returned only when the caller is the administrator. */
  invites?: Invite[];
}

/** Shape sent on create. */
export interface TripInput {
  title: string;
  mode: TripMode;
  startDate?: string;
  endDate?: string;
}

/** Shape sent on edit (the mode is fixed at creation). */
export interface TripUpdate {
  title: string;
  startDate?: string;
  endDate?: string;
}
