import { badRequest } from "../http.ts";

// The caller's notification preferences: which play-event kinds notify them,
// and which trips are muted. Validated here in the shape of profilePayload.ts
// — reject, never correct — and mirrored by hand into
// frontend/src/lib/notificationTypes.ts.

export type NotificationEventType = "progress_marked" | "one_away" | "victory";

/** The allowlist of event types, in feed order of frequency (noisiest first). */
export const NOTIFICATION_EVENT_TYPES: readonly NotificationEventType[] = [
  "progress_marked",
  "one_away",
  "victory",
];

export interface NotificationPreferences {
  /** Whether each event kind produces a notification for this user. */
  types: Record<NotificationEventType, boolean>;
  /** Trips that never notify this user, regardless of type. */
  mutedTripIds: string[];
}

/**
 * Mirrors MAX_TRIPS_PER_USER in routes/trips.ts: a user can be a member of at
 * most that many trips, so a mute list cannot meaningfully exceed it. Restated
 * here (with a comment) rather than imported, so a lib module never depends on
 * a route module — the same proportionate safeguard MAX_DISPLAY_NAME_LENGTH
 * uses for the profile.
 */
export const MAX_MUTED_TRIPS = 50;

/**
 * Bounds one mute-list entry. Trip ids are 16-byte base64url (~22 chars), so
 * this is generous headroom while keeping a hand-crafted payload from parking
 * megabyte strings in its own preferences item.
 */
export const MAX_MUTED_TRIP_ID_LENGTH = 64;

/**
 * Applied when the user has never saved preferences: wins and near-misses are
 * worth interrupting someone for; an individual mark is not — in a five-member
 * trip it fires dozens of times an hour, and defaulting it on would make the
 * bell useless within an hour of the first trip.
 */
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  types: { progress_marked: false, one_away: true, victory: true },
  mutedTripIds: [],
};

/**
 * Parses a preferences submission. Rejects rather than corrects: every event
 * type must be stated as a boolean (a missing one is not defaulted to either
 * side), and the mute list must be an array of bounded, non-empty, distinct
 * strings within the bound. Throws HttpError(400) on any violation; never
 * partially applies.
 */
export function parseNotificationPreferences(input: unknown): NotificationPreferences {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw badRequest("preferences must be an object");
  }
  const raw = input as Record<string, unknown>;

  const typesRaw = raw.types;
  if (typeof typesRaw !== "object" || typesRaw === null || Array.isArray(typesRaw)) {
    throw badRequest("types must be an object");
  }
  const types = {} as Record<NotificationEventType, boolean>;
  for (const type of NOTIFICATION_EVENT_TYPES) {
    const value = (typesRaw as Record<string, unknown>)[type];
    if (typeof value !== "boolean") {
      throw badRequest(`types.${type} must be a boolean`);
    }
    types[type] = value;
  }

  if (!Array.isArray(raw.mutedTripIds)) {
    throw badRequest("mutedTripIds must be an array");
  }
  if (raw.mutedTripIds.length > MAX_MUTED_TRIPS) {
    throw badRequest(`mutedTripIds must contain at most ${MAX_MUTED_TRIPS} entries`);
  }
  const seen = new Set<string>();
  const mutedTripIds = raw.mutedTripIds.map((id, index) => {
    if (typeof id !== "string" || id === "") {
      throw badRequest(`mutedTripIds[${index}] must be a non-empty string`);
    }
    if (id.length > MAX_MUTED_TRIP_ID_LENGTH) {
      throw badRequest(`mutedTripIds[${index}] must be at most ${MAX_MUTED_TRIP_ID_LENGTH} characters`);
    }
    // Duplicates are rejected rather than collapsed: a stored list with a
    // duplicate would make a client's "did anything change?" size comparison
    // lie, and rejecting keeps every stored list canonical.
    if (seen.has(id)) {
      throw badRequest(`mutedTripIds[${index}] is a duplicate`);
    }
    seen.add(id);
    return id;
  });

  return { types, mutedTripIds };
}

/**
 * Normalizes a stored preferences item for fan-out reads. Stored items are
 * trusted (they were written by parseNotificationPreferences), so this only
 * fills defaults for absent fields rather than re-validating — an absent item
 * means "never saved", which is the defaults.
 */
export function preferencesFromItem(item: unknown): NotificationPreferences {
  if (typeof item !== "object" || item === null) return DEFAULT_PREFERENCES;
  const raw = item as { types?: Partial<Record<NotificationEventType, unknown>>; mutedTripIds?: unknown };
  return {
    types: {
      progress_marked:
        typeof raw.types?.progress_marked === "boolean"
          ? raw.types.progress_marked
          : DEFAULT_PREFERENCES.types.progress_marked,
      one_away:
        typeof raw.types?.one_away === "boolean" ? raw.types.one_away : DEFAULT_PREFERENCES.types.one_away,
      victory:
        typeof raw.types?.victory === "boolean" ? raw.types.victory : DEFAULT_PREFERENCES.types.victory,
    },
    mutedTripIds: Array.isArray(raw.mutedTripIds)
      ? raw.mutedTripIds.filter((id): id is string => typeof id === "string")
      : [],
  };
}
