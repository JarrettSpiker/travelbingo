// Hand-mirrored from backend/src/lib/notificationPayload.ts and the route
// response shapes, following the repo's cross-package convention (see
// tripTypes.ts). Keep these in sync with the backend when the wire shape
// changes.

export type NotificationEventType = "progress_marked" | "one_away" | "victory";

/** Plain-language verbs, shared by the bell dropdown and the activity feed. */
export const EVENT_VERBS: Readonly<Record<NotificationEventType, string>> = {
  progress_marked: "marked a square",
  one_away: "is one square from winning",
  victory: "won a card",
};

export interface NotificationPreferences {
  types: Record<NotificationEventType, boolean>;
  mutedTripIds: string[];
}

/**
 * Applied when the user has never saved preferences. Mirrors the backend's
 * DEFAULT_PREFERENCES: wins and near-misses are worth hearing about; individual
 * marks are not.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  types: { progress_marked: false, one_away: true, victory: true },
  mutedTripIds: [],
};

/** One bell entry, as returned by GET /api/me/notifications. */
export interface Notification {
  type: NotificationEventType;
  tripId: string;
  /** The title as it was when the event happened — a historical label. */
  tripTitle: string;
  actorId: string;
  /** Resolved at read time, so a rename never leaves a stale name. */
  actorName: string | null;
  tripCardId: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationList {
  notifications: Notification[];
  unreadCount: number;
}

/** The caller's preferences as returned by the preferences routes. */
export interface StoredNotificationPreferences extends NotificationPreferences {
  /** Null when the user has never saved — the defaults are in effect. */
  updatedAt: string | null;
}

/** One activity-feed entry, as returned by GET /api/trips/{tripId}/activity. */
export interface TripActivityEvent {
  type: NotificationEventType;
  actorId: string;
  actorName: string | null;
  tripCardId: string;
  createdAt: string;
}
