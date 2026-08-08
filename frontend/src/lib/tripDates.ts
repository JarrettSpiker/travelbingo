/**
 * Date formatting for trips.
 *
 * The trip API returns two kinds of date and they cannot share a parse: the
 * date-only `YYYY-MM-DD` fields a user types (`startDate`, `endDate`), and full
 * ISO timestamps that carry their own zone (`createdAt`, `updatedAt`). Getting
 * this wrong is invisible in UTC and off by a day everywhere west of it, so it
 * lives here with a test rather than as a helper per page.
 */

/**
 * Formats a date-only `YYYY-MM-DD` value.
 *
 * The appended `T00:00:00` is the whole point: `new Date("2026-08-01")` is
 * parsed as *UTC* midnight per the spec, which renders as 31 July for any
 * viewer west of Greenwich. A bare time makes it local midnight, so every
 * viewer sees the date that was actually typed.
 */
export function formatTripDate(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, options);
}

/**
 * Formats a full ISO timestamp. These carry an offset, so they are parsed as
 * given — unlike {@link formatTripDate}.
 */
export function formatTripTimestamp(iso: string, options: Intl.DateTimeFormatOptions): string {
  return new Date(iso).toLocaleDateString(undefined, options);
}

/**
 * A trip's date range — "Aug 1 – Aug 9", or "Aug 1 – …" when only one end is
 * set. Null when the trip has no dates at all, so callers can drop the row.
 */
export function formatTripRange(
  startDate: string | undefined,
  endDate: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string | null {
  if (!startDate && !endDate) return null;
  const fmt = (iso?: string) => (iso ? formatTripDate(iso, options) : "…");
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}
