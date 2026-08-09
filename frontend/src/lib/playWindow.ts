// Hand-mirrored from backend/src/lib/playWindow.ts, following the repo's
// cross-package convention (see the header of tripTypes.ts). Keep the two in
// sync: the margin, the bounds, and the treatment of an absent or unparseable
// date are all part of the mirrored contract.
//
// **This copy is not the authority.** It exists only so the interface can
// disable a control and say why, rather than letting a member tap a square and
// watch it bounce back. The server re-decides every mark against its own clock,
// and a client whose clock is wrong gets a clear refusal rather than a mark that
// appears to take and then disappears on the next poll.

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far either side of the stated dates the window extends.
 *
 * Real offsets span UTC−12 to UTC+14, so without this a traveller in New
 * Zealand could not mark on the morning of their own first day, and one in
 * Hawaii would lose the evening of their last.
 */
export const PLAY_WINDOW_MARGIN_MS = DAY_MS;

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * UTC midnight at the start of a `YYYY-MM-DD` date, or null if the value is not
 * one. Built with `Date.UTC` rather than `new Date(string)` deliberately — note
 * that this is the opposite choice from `tripDates.ts`, which parses the same
 * strings as *local* midnight on purpose because it is formatting a date for a
 * human to read. Here the comparison has to match the server's, which is UTC.
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

/** Why a trip is not currently playable, or null when it is. */
export type PlayWindowState = "before" | "after" | null;

/**
 * The instants the window opens and closes, as epoch milliseconds. An absent
 * bound is ±Infinity, so a trip with no dates is always open.
 */
export function playWindowBounds(trip: PlayWindowDates): { opensAt: number; closesAt: number } {
  const start = trip.startDate ? utcStartOfDay(trip.startDate) : null;
  const end = trip.endDate ? utcStartOfDay(trip.endDate) : null;

  return {
    opensAt: start === null ? -Infinity : start - PLAY_WINDOW_MARGIN_MS,
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

/**
 * Which side of the window the trip is on, so the interface can say "this trip
 * hasn't started yet" rather than the useless "you can't do that".
 */
export function playWindowState(trip: PlayWindowDates, now: Date): PlayWindowState {
  const at = now.getTime();
  if (Number.isNaN(at)) return null;

  const { opensAt, closesAt } = playWindowBounds(trip);
  if (at < opensAt) return "before";
  if (at > closesAt) return "after";
  return null;
}
