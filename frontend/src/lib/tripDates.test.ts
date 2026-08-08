// A zone west of Greenwich, where a UTC-parsed date-only value lands on the
// previous day. In UTC the bug these tests cover is invisible, so pinning the
// zone is what makes them able to fail.
process.env.TZ = "America/New_York";

import { describe, expect, it } from "vitest";
import { formatTripDate, formatTripRange, formatTripTimestamp } from "./tripDates";

const MONTH_DAY: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
const WITH_YEAR: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/** The locale is the runner's, so expectations are built the same way. */
function localDate(year: number, monthIndex: number, day: number, options: Intl.DateTimeFormatOptions) {
  return new Date(year, monthIndex, day).toLocaleDateString(undefined, options);
}

describe("formatTripDate", () => {
  it("renders the calendar date that was typed, not one shifted by the viewer's zone", () => {
    expect(formatTripDate("2026-08-01", MONTH_DAY)).toBe(localDate(2026, 7, 1, MONTH_DAY));
  });

  it("does not shift across a month boundary", () => {
    expect(formatTripDate("2026-08-01", WITH_YEAR)).toBe(localDate(2026, 7, 1, WITH_YEAR));
  });

  it("does not shift across a year boundary", () => {
    expect(formatTripDate("2026-01-01", WITH_YEAR)).toBe(localDate(2026, 0, 1, WITH_YEAR));
  });
});

describe("formatTripTimestamp", () => {
  it("parses a full ISO timestamp as given", () => {
    // Midday UTC is the same calendar day in every zone this app cares about,
    // so this pins the parse without pinning the offset.
    expect(formatTripTimestamp("2026-08-01T12:00:00.000Z", WITH_YEAR)).toBe(
      localDate(2026, 7, 1, WITH_YEAR),
    );
  });
});

describe("formatTripRange", () => {
  it("joins both ends", () => {
    expect(formatTripRange("2026-08-01", "2026-08-09", MONTH_DAY)).toBe(
      `${localDate(2026, 7, 1, MONTH_DAY)} – ${localDate(2026, 7, 9, MONTH_DAY)}`,
    );
  });

  it("marks an open end with an ellipsis", () => {
    expect(formatTripRange("2026-08-01", undefined, MONTH_DAY)).toBe(
      `${localDate(2026, 7, 1, MONTH_DAY)} – …`,
    );
    expect(formatTripRange(undefined, "2026-08-09", MONTH_DAY)).toBe(
      `… – ${localDate(2026, 7, 9, MONTH_DAY)}`,
    );
  });

  it("is null when the trip has no dates, so the row can be dropped", () => {
    expect(formatTripRange(undefined, undefined, MONTH_DAY)).toBeNull();
  });

  it("agrees with the detail page's own formatting of the same value", () => {
    // The two pages render the same trip one click apart; a range on the list
    // must name the same days the detail page names.
    expect(formatTripRange("2026-08-01", "2026-08-09", WITH_YEAR)).toBe(
      `${formatTripDate("2026-08-01", WITH_YEAR)} – ${formatTripDate("2026-08-09", WITH_YEAR)}`,
    );
  });
});
