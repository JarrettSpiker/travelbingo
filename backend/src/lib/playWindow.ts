// Whether a trip is currently open for play.
//
// Trip dates are plain calendar dates (`YYYY-MM-DD`, validated in
// tripPayload.ts) with no time zone, which is the right storage choice: "the
// trip runs the 3rd to the 10th" is a fact about a calendar, not about an
// instant. Marking, however, happens at an instant, so the two have to be
// reconciled — here, once, rather than at each call site.
//
// Hand-mirrored to frontend/src/lib/playWindow.ts, which uses it only to
// disable controls and explain why. This copy is the authority: the server
// rejects an out-of-window mark regardless of what any client believes, and
// nothing in the request contributes to the decision.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far either side of the stated dates the window extends.
 *
 * Real offsets span UTC−12 to UTC+14, so without this a traveller in New
 * Zealand could not mark on the morning of their own first day, and one in
 * Hawaii would lose the evening of their last. Erring the other way costs
 * nothing: the window is a courtesy that keeps a finished trip from
 * accumulating new marks, not a security boundary.
 */
export const PLAY_WINDOW_MARGIN_MS = DAY_MS;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * UTC midnight at the start of a `YYYY-MM-DD` date, or null if the value is not
 * one. Built with `Date.UTC` rather than `new Date(string)` deliberately: the
 * bare-date form parses as UTC but the datetime form does not, and a helper that
 * works only for the input it happens to be given is the kind of thing that goes
 * wrong later. The round-trip check rejects a well-formed but non-existent date
 * (2026-02-30), which `Date.UTC` would otherwise roll over.
 */
function utcStartOfDay(date: string): number | null {
  const match = DATE.exec(date);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const rolled = new Date(ms);
  if (rolled.getUTCFullYear() !== year || rolled.getUTCMonth() !== month - 1 || rolled.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

export interface PlayWindowDates {
  startDate?: string;
  endDate?: string;
}

/**
 * The instants the window opens and closes, as epoch milliseconds. An absent
 * bound is ±Infinity, so a trip with no dates is always open, a trip with only a
 * start date never closes, and one with only an end date was always open.
 *
 * An unparseable stored date is treated as an absent bound rather than a closed
 * window. Dates are validated on write, so this can only be reached by data that
 * predates or bypassed that validation, and refusing play for it would strand a
 * trip with no way for its administrator to see why.
 */
export function playWindowBounds(trip: PlayWindowDates): { opensAt: number; closesAt: number } {
  const start = trip.startDate ? utcStartOfDay(trip.startDate) : null;
  const end = trip.endDate ? utcStartOfDay(trip.endDate) : null;

  return {
    opensAt: start === null ? -Infinity : start - PLAY_WINDOW_MARGIN_MS,
    // The end date's own day runs to 23:59:59.999Z; the margin is added to that.
    closesAt: end === null ? Infinity : end + DAY_MS - 1 + PLAY_WINDOW_MARGIN_MS,
  };
}

/** True when `now` falls inside the trip's play window (inclusive at both ends). */
export function isWithinPlayWindow(trip: PlayWindowDates, now: Date): boolean {
  const at = now.getTime();
  if (Number.isNaN(at)) return false;

  const { opensAt, closesAt } = playWindowBounds(trip);
  return at >= opensAt && at <= closesAt;
}
