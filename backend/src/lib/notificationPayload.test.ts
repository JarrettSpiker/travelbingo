import { describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import {
  DEFAULT_PREFERENCES,
  NOTIFICATION_EVENT_TYPES,
  parseNotificationPreferences,
} from "./notificationPayload.ts";

function rejects(input: unknown): number {
  try {
    parseNotificationPreferences(input);
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("parseNotificationPreferences", () => {
  it("accepts a well-formed preferences payload", () => {
    const parsed = parseNotificationPreferences({
      types: { progress_marked: true, one_away: false, victory: true },
      mutedTripIds: ["trip-1"],
    });
    expect(parsed.types).toEqual({ progress_marked: true, one_away: false, victory: true });
    expect(parsed.mutedTripIds).toEqual(["trip-1"]);
  });

  it("rejects a missing event type rather than defaulting it", () => {
    expect(
      rejects({ types: { progress_marked: true, one_away: true }, mutedTripIds: [] }),
    ).toBe(400);
  });

  it("rejects a non-boolean type value", () => {
    expect(
      rejects({ types: { progress_marked: "yes", one_away: true, victory: true }, mutedTripIds: [] }),
    ).toBe(400);
  });

  it("rejects a mute list that is not an array of non-empty strings", () => {
    const types = { progress_marked: true, one_away: true, victory: true };
    expect(rejects({ types, mutedTripIds: "trip-1" })).toBe(400);
    expect(rejects({ types, mutedTripIds: [42] })).toBe(400);
    expect(rejects({ types, mutedTripIds: [""] })).toBe(400);
  });

  it("bounds the mute list to the per-user trip cap", () => {
    const types = { progress_marked: true, one_away: true, victory: true };
    expect(rejects({ types, mutedTripIds: Array.from({ length: 51 }, (_, i) => `trip-${i}`) })).toBe(400);
    expect(
      parseNotificationPreferences({ types, mutedTripIds: Array.from({ length: 50 }, (_, i) => `trip-${i}`) })
        .mutedTripIds,
    ).toHaveLength(50);
  });

  it("rejects a non-object payload", () => {
    expect(rejects(null)).toBe(400);
    expect(rejects("prefs")).toBe(400);
    expect(rejects([])).toBe(400);
  });
});

describe("defaults", () => {
  it("notifies on wins and near-misses but not on individual marks", () => {
    expect(DEFAULT_PREFERENCES.types).toEqual({
      progress_marked: false,
      one_away: true,
      victory: true,
    });
  });

  it("covers exactly the three event types", () => {
    expect(NOTIFICATION_EVENT_TYPES).toEqual(["progress_marked", "one_away", "victory"]);
  });
});
