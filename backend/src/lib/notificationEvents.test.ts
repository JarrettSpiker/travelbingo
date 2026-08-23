import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, type NotificationPreferences } from "./notificationPayload.ts";
import { newSortId, recipientsFor, shouldEmitOneAway } from "./notificationEvents.ts";

const MARKED_EVENT = { type: "progress_marked", tripId: "trip-1" } as const;
const ONE_AWAY_EVENT = { type: "one_away", tripId: "trip-1" } as const;

const prefs = (overrides: Partial<NotificationPreferences>): NotificationPreferences => ({
  ...DEFAULT_PREFERENCES,
  ...overrides,
  types: { ...DEFAULT_PREFERENCES.types, ...(overrides.types ?? {}) },
});

describe("shouldEmitOneAway", () => {
  it("fires on the transition into one-away", () => {
    expect(shouldEmitOneAway(3, 1)).toBe(true);
    expect(shouldEmitOneAway(2, 1)).toBe(true);
    expect(shouldEmitOneAway(Infinity, 1)).toBe(true);
  });

  it("does not fire while staying one away, moving away, or winning", () => {
    expect(shouldEmitOneAway(1, 1)).toBe(false);
    expect(shouldEmitOneAway(1, 2)).toBe(false);
    expect(shouldEmitOneAway(2, 0)).toBe(false);
    expect(shouldEmitOneAway(5, 3)).toBe(false);
  });
});

describe("recipientsFor", () => {
  const members = ["user-a", "user-b", "user-c", "user-d"];

  it("excludes the actor and applies the per-type default", () => {
    // Defaults: marks off, near-misses on. No stored preferences at all.
    const recipients = recipientsFor(MARKED_EVENT, members, "user-a", new Map());
    expect(recipients).toEqual([]);

    const oneAway = recipientsFor(ONE_AWAY_EVENT, members, "user-a", new Map());
    expect(oneAway).toEqual(["user-b", "user-c", "user-d"]);
  });

  it("applies a member's stored opt-in for marks", () => {
    const byUser = new Map([
      ["user-b", prefs({ types: { progress_marked: true, one_away: true, victory: true } })],
    ]);
    expect(recipientsFor(MARKED_EVENT, members, "user-a", byUser)).toEqual(["user-b"]);
  });

  it("applies a member's stored opt-out for a type that is on by default", () => {
    const byUser = new Map([
      ["user-c", prefs({ types: { progress_marked: false, one_away: false, victory: true } })],
    ]);
    expect(recipientsFor(ONE_AWAY_EVENT, members, "user-a", byUser)).toEqual(["user-b", "user-d"]);
  });

  it("applies a mute for this trip without touching other members", () => {
    const byUser = new Map([["user-b", prefs({ mutedTripIds: ["trip-1"] })]]);
    expect(recipientsFor(ONE_AWAY_EVENT, members, "user-a", byUser)).toEqual(["user-c", "user-d"]);
  });

  it("a mute on another trip does not apply", () => {
    const byUser = new Map([["user-b", prefs({ mutedTripIds: ["trip-9"] })]]);
    expect(recipientsFor(ONE_AWAY_EVENT, members, "user-a", byUser)).toEqual(["user-b", "user-c", "user-d"]);
  });

  it("falls back to defaults for a member with no stored preferences", () => {
    const byUser = new Map([
      ["user-b", prefs({ types: { progress_marked: false, one_away: false, victory: false } })],
    ]);
    // user-c and user-d have no entry: defaults keep them in for one_away.
    expect(recipientsFor(ONE_AWAY_EVENT, members, "user-a", byUser)).toEqual(["user-c", "user-d"]);
  });

  it("returns nothing when the actor is the only member", () => {
    expect(recipientsFor(ONE_AWAY_EVENT, ["user-a"], "user-a", new Map())).toEqual([]);
    expect(recipientsFor(ONE_AWAY_EVENT, [], "user-a", new Map())).toEqual([]);
  });
});

describe("newSortId", () => {
  it("joins the timestamp and a random tail with the ordering-preserving shape", () => {
    expect(newSortId("2026-08-02T00:00:00.000Z", () => "abc123")).toBe("2026-08-02T00:00:00.000Z#abc123");
  });

  it("sorts most-recent-first lexicographically", () => {
    const earlier = newSortId("2026-08-01T00:00:00.000Z", () => "zzz");
    const later = newSortId("2026-08-02T00:00:00.000Z", () => "aaa");
    expect(later > earlier).toBe(true);
  });
});
