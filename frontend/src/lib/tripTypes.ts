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
  /** Display name resolved from the member's profile; null when none is set. */
  displayName: string | null;
  /**
   * The member's email (captured from their verified JWT at join). Display
   * fallback so trip-mates can identify someone who hasn't set a display name.
   */
  email: string | null;
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
  /**
   * Grid positions currently marked, ascending. Always an array on the wire: the
   * server stores these as a set, which cannot be empty, so it normalizes the
   * absent case to `[]` rather than leaving readers to know that.
   */
  markedSlots: number[];
  /** Absent until the card's marks have been touched at least once. */
  progressUpdatedAt?: string;
}

/**
 * One card's progress, as returned by `GET /api/trips/{tripId}/progress`. This
 * is the polled shape: deliberately just the marks, with no snapshot, so a page
 * left open does not re-download every card every few seconds.
 */
export interface TripCardProgress {
  tripCardId: string;
  markedSlots: number[];
  progressUpdatedAt?: string;
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
