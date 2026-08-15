import { describe, expect, it } from "vitest";
import {
  isWithinPlayWindow,
  playWindowBounds,
  playWindowState,
  PLAY_WINDOW_MARGIN_MS,
} from "./playWindow";

// The same table of cases as backend/src/lib/playWindow.test.ts. The two
// modules are hand-mirrored, so the tests are too: a divergence in either shows
// up as a failure here rather than as a mark the server silently refuses.

const at = (iso: string) => new Date(iso);

describe("isWithinPlayWindow", () => {
  it("is always open when the trip carries no dates", () => {
    expect(isWithinPlayWindow({}, at("1999-01-01T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow({}, at("2099-12-31T23:59:59.999Z"))).toBe(true);
  });

  it("has no closing bound when only a start date is set", () => {
    const trip = { startDate: "2026-08-10" };
    expect(isWithinPlayWindow(trip, at("2026-08-10T12:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2030-01-01T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-01T00:00:00.000Z"))).toBe(false);
  });

  it("has no opening bound when only an end date is set", () => {
    const trip = { endDate: "2026-08-10" };
    expect(isWithinPlayWindow(trip, at("1999-01-01T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-10T12:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-20T00:00:00.000Z"))).toBe(false);
  });

  it("is open across both bounds when a range is set", () => {
    const trip = { startDate: "2026-08-10", endDate: "2026-08-20" };
    expect(isWithinPlayWindow(trip, at("2026-08-10T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-15T09:30:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-20T23:59:59.999Z"))).toBe(true);
  });

  it("closes exactly one millisecond either side of the window", () => {
    const trip = { startDate: "2026-08-10", endDate: "2026-08-20" };
    const { opensAt, closesAt } = playWindowBounds(trip);

    expect(isWithinPlayWindow(trip, new Date(opensAt))).toBe(true);
    expect(isWithinPlayWindow(trip, new Date(opensAt - 1))).toBe(false);
    expect(isWithinPlayWindow(trip, new Date(closesAt))).toBe(true);
    expect(isWithinPlayWindow(trip, new Date(closesAt + 1))).toBe(false);
  });

  it("admits the first day for a player at UTC+14 and the last for one at UTC−12", () => {
    const trip = { startDate: "2026-08-10", endDate: "2026-08-20" };
    expect(isWithinPlayWindow(trip, at("2026-08-09T18:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-21T08:00:00.000Z"))).toBe(true);
  });

  it("gives a one-day trip roughly 72 hours of wall clock", () => {
    const trip = { startDate: "2026-08-10", endDate: "2026-08-10" };
    const { opensAt, closesAt } = playWindowBounds(trip);

    expect(closesAt - opensAt).toBe(3 * 24 * 60 * 60 * 1000 - 1);
    expect(isWithinPlayWindow(trip, at("2026-08-09T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-11T23:59:59.999Z"))).toBe(true);
    expect(isWithinPlayWindow(trip, at("2026-08-08T23:59:59.999Z"))).toBe(false);
    expect(isWithinPlayWindow(trip, at("2026-08-12T00:00:00.000Z"))).toBe(false);
  });

  it("treats a date it cannot parse as an absent bound rather than a closed window", () => {
    expect(isWithinPlayWindow({ startDate: "not-a-date" }, at("2026-08-10T00:00:00.000Z"))).toBe(true);
    expect(isWithinPlayWindow({ endDate: "2026-02-30" }, at("2030-01-01T00:00:00.000Z"))).toBe(true);
  });

  it("refuses an unusable clock rather than treating it as inside the window", () => {
    expect(isWithinPlayWindow({ startDate: "2026-08-10" }, new Date(Number.NaN))).toBe(false);
  });

  it("measures the margin in whole days either side", () => {
    const { opensAt, closesAt } = playWindowBounds({ startDate: "2026-08-10", endDate: "2026-08-10" });
    expect(Date.UTC(2026, 7, 10) - opensAt).toBe(PLAY_WINDOW_MARGIN_MS);
    expect(closesAt - (Date.UTC(2026, 7, 11) - 1)).toBe(PLAY_WINDOW_MARGIN_MS);
  });
});

describe("playWindowState", () => {
  const trip = { startDate: "2026-08-10", endDate: "2026-08-20" };

  it("says which side of the window a closed trip is on", () => {
    // "This trip hasn't started yet" and "this trip has ended" are different
    // explanations; the interface has to be able to tell them apart.
    expect(playWindowState(trip, at("2026-08-01T00:00:00.000Z"))).toBe("before");
    expect(playWindowState(trip, at("2026-09-01T00:00:00.000Z"))).toBe("after");
  });

  it("is null while the trip is open, and for a trip with no dates", () => {
    expect(playWindowState(trip, at("2026-08-15T00:00:00.000Z"))).toBeNull();
    expect(playWindowState({}, at("2026-08-15T00:00:00.000Z"))).toBeNull();
  });

  it("agrees with isWithinPlayWindow at every boundary", () => {
    const { opensAt, closesAt } = playWindowBounds(trip);
    for (const ms of [opensAt - 1, opensAt, closesAt, closesAt + 1]) {
      const now = new Date(ms);
      expect(playWindowState(trip, now) === null).toBe(isWithinPlayWindow(trip, now));
    }
  });
});
