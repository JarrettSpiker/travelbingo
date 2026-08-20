import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiClient } from "@/lib/apiClient";
import { getTripProgress, markTripCardSlot, unmarkTripCardSlot } from "@/lib/tripApi";
import type { TripCard, TripCardProgress } from "@/lib/tripTypes";

// Keeping a trip's marks fresh while someone is looking at it.
//
// Polling rather than a socket: the median gap between two marks in a real trip
// is minutes, and a WebSocket API would mean a new API, a connection table, a
// second authorization path for the connect handler, and a fan-out publisher —
// all to shave seconds off a turn-based game. See the change's design.md.
//
// The state, the merge, and the scheduler below are plain functions with no DOM
// and no React in them, because the test suite has neither (see
// dev/gallery/coverage.test.ts). The hook at the bottom is the thin wiring.

/** Every card's marks, keyed by trip card id. */
export type ProgressMap = ReadonlyMap<string, ReadonlySet<number>>;

/** How often a visible page asks for the trip's progress. */
export const POLL_INTERVAL_MS = 10_000;

export function seedProgress(cards: readonly Pick<TripCard, "tripCardId" | "markedSlots">[]): ProgressMap {
  // `markedSlots` is required by the response contract, but this runs during
  // render — so a card without it would be a blank page rather than a caught
  // error. That is reachable in a deploy window where the bundle is live before
  // the API is, and "no marks" is the right reading of an absent field anyway.
  return new Map(cards.map((card) => [card.tripCardId, new Set(card.markedSlots ?? [])]));
}

export function markedSlotsFor(progress: ProgressMap, tripCardId: string): ReadonlySet<number> {
  return progress.get(tripCardId) ?? EMPTY;
}

/** Shared so a card with no marks does not allocate a set on every render. */
const EMPTY: ReadonlySet<number> = new Set<number>();

export function isMarked(progress: ProgressMap, tripCardId: string, slotIndex: number): boolean {
  return progress.get(tripCardId)?.has(slotIndex) ?? false;
}

/** Applies one square's new state, returning a new map. */
export function withSlot(
  progress: ProgressMap,
  tripCardId: string,
  slotIndex: number,
  marked: boolean,
): ProgressMap {
  const next = new Map(progress);
  const slots = new Set(progress.get(tripCardId) ?? []);
  if (marked) slots.add(slotIndex);
  else slots.delete(slotIndex);
  next.set(tripCardId, slots);
  return next;
}

/** Replaces one card's marks outright, from a server response. */
export function withCard(progress: ProgressMap, card: TripCardProgress): ProgressMap {
  const next = new Map(progress);
  next.set(card.tripCardId, new Set(card.markedSlots));
  return next;
}

/** Identifies one in-flight toggle. Per *square*, not per card — see `pending`. */
export function pendingKey(tripCardId: string, slotIndex: number): string {
  return `${tripCardId}:${slotIndex}`;
}

/** The card ids with at least one toggle in flight. */
export function pendingCardIds(pending: ReadonlySet<string>): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const key of pending) {
    const at = key.lastIndexOf(":");
    if (at > 0) ids.add(key.slice(0, at));
  }
  return ids;
}

/**
 * Folds a poll response into the current state.
 *
 * The server is authoritative, so a polled card replaces what we hold — except
 * for cards with a mark still in flight. Without that exclusion a poll that
 * *started* before a local mark landed would arrive after it and revert the
 * square under the player's finger, which reads as the app losing the tap.
 * Those cards reconcile on the toggle's own response instead.
 *
 * Cards absent from the response have been removed from the trip; they are
 * dropped rather than kept, so a stale card cannot linger with marks on it.
 */
export function mergeProgress(
  progress: ProgressMap,
  incoming: readonly TripCardProgress[],
  pendingCardIds: ReadonlySet<string> = EMPTY_IDS,
): ProgressMap {
  const next = new Map<string, ReadonlySet<number>>();
  for (const card of incoming) {
    const held = progress.get(card.tripCardId);
    next.set(
      card.tripCardId,
      pendingCardIds.has(card.tripCardId) && held ? held : new Set(card.markedSlots),
    );
  }
  return next;
}

const EMPTY_IDS: ReadonlySet<string> = new Set<string>();

export interface ProgressPollerDeps {
  intervalMs: number;
  /** Whether the page carrying the trip is currently on screen. */
  isVisible: () => boolean;
  schedule: (fn: () => void, ms: number) => number;
  cancel: (handle: number) => void;
  poll: () => Promise<void>;
}

export interface ProgressPoller {
  /** Call when visibility changes: starts polling again, or stops. */
  refresh: () => void;
  /** Idempotent; after this nothing is scheduled and nothing will be. */
  stop: () => void;
}

/**
 * Schedules the poll, and only while the page is visible — a tab left open in
 * the background must not keep asking indefinitely.
 *
 * Every side effect is injected so this is exercisable with fake timers and no
 * DOM, which is the only way the pause/resume behaviour gets covered at all.
 */
export function createProgressPoller(deps: ProgressPollerDeps): ProgressPoller {
  let handle: number | undefined;
  let stopped = false;
  let inFlight = false;

  function clear() {
    if (handle !== undefined) {
      deps.cancel(handle);
      handle = undefined;
    }
  }

  function arm() {
    clear();
    if (stopped || !deps.isVisible()) return;
    handle = deps.schedule(tick, deps.intervalMs);
  }

  function tick() {
    handle = undefined;
    if (stopped) return;
    // A poll slower than the interval must not stack up behind itself.
    if (!inFlight) {
      inFlight = true;
      void deps.poll().finally(() => {
        inFlight = false;
      });
    }
    arm();
  }

  arm();

  return {
    refresh: arm,
    stop() {
      stopped = true;
      clear();
    },
  };
}

export interface TripProgress {
  progress: ProgressMap;
  /** Set when a mark was refused; cleared on the next successful toggle. */
  error: string | null;
  clearError: () => void;
  /**
   * Resolves false when the toggle was refused, so a caller can react to the
   * outcome (e.g. hold back a celebration) without watching the error state.
   */
  toggle: (tripCardId: string, slotIndex: number) => Promise<boolean>;
}

/**
 * Holds a trip's marks, refreshing them while the page is visible and applying
 * the viewer's own marks immediately.
 *
 * A local toggle is optimistic: the square flips at once and the request goes
 * out behind it, because waiting a round trip to see your own tap register is
 * the difference between a game and a form. If the server refuses — the trip
 * ended, the card was reassigned — the square reverts to its true state and the
 * caller is given a message to show, rather than being left with a mark that
 * only exists on their screen.
 *
 * `onUnreadCount`, when given, receives the unread-notification count the poll
 * response carries — the header's bell refreshes on this same interval rather
 * than on a timer of its own.
 */
export function useTripProgress(
  api: ApiClient,
  tripId: string,
  cards: readonly TripCard[] | undefined,
  /**
   * Whether a signed-in caller exists. Required, not optional: play is an
   * account-only feature and a signed-out visitor must issue no request at all.
   * The API client would refuse anyway — it throws locally with no token — but
   * that is a property of a callee, and this constraint is the page's to state.
   */
  isAuthenticated: boolean,
  onUnreadCount?: (count: number) => void,
): TripProgress {
  const [progress, setProgress] = useState<ProgressMap>(() => seedProgress(cards ?? []));
  const [error, setError] = useState<string | null>(null);

  // Which *squares* have a toggle in flight, so a poll cannot revert one. Keyed
  // per square rather than per card because two toggles on the same card
  // overlap: keyed per card, the first one to settle would clear the entry
  // while the second was still outstanding, reopening the hole this closes.
  // A ref rather than state — it is read inside callbacks and must not render.
  const pending = useRef(new Set<string>());

  // The current marks, mirrored for the callbacks. `toggle` has to know whether
  // a square is marked *now*, and reading that from a value captured when the
  // callback was built loses a rapid second activation (a double-click, or
  // Enter held down with key repeat): both would read the same prior state and
  // both would mark. Keeping the mirror lets `toggle` stay referentially stable.
  const progressRef = useRef<ProgressMap>(progress);
  progressRef.current = progress;

  // Re-seed when the trip is (re)loaded. `cards` is a fresh array on every load
  // even when nothing changed, so the effect keys on its *content* and reads the
  // array itself through a ref — otherwise every re-render of the page would
  // discard progress newer than the last full trip fetch.
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const seedKey = (cards ?? [])
    .map((card) => `${card.tripCardId}:${(card.markedSlots ?? []).join(",")}`)
    .join("|");

  useEffect(() => {
    const latest = cardsRef.current;
    if (latest) setProgress(seedProgress(latest));
  }, [seedKey]);

  // Read through a ref so the poller effect below does not depend on the
  // callback's identity — a fresh closure per render must not restart polling.
  const onUnreadCountRef = useRef(onUnreadCount);
  onUnreadCountRef.current = onUnreadCount;

  useEffect(() => {
    if (!tripId || !isAuthenticated) return;

    const poller = createProgressPoller({
      intervalMs: POLL_INTERVAL_MS,
      isVisible: () => document.visibilityState === "visible",
      schedule: (fn, ms) => window.setTimeout(fn, ms),
      cancel: (handle) => window.clearTimeout(handle),
      poll: async () => {
        try {
          const body = await getTripProgress(api, tripId);
          if (onUnreadCountRef.current) onUnreadCountRef.current(body.unreadNotifications ?? 0);
          setProgress((current) => mergeProgress(current, body.cards, pendingCardIds(pending.current)));
        } catch {
          // A failed poll is not worth telling anyone about: the next one is ten
          // seconds away, and the marks on screen are still the last known good
          // ones. A refused *mark* is a different matter, and is reported.
        }
      },
    });

    document.addEventListener("visibilitychange", poller.refresh);
    return () => {
      document.removeEventListener("visibilitychange", poller.refresh);
      poller.stop();
    };
  }, [api, tripId, isAuthenticated]);

  const toggle = useCallback(
    async (tripCardId: string, slotIndex: number) => {
      const wasMarked = isMarked(progressRef.current, tripCardId, slotIndex);
      const key = pendingKey(tripCardId, slotIndex);

      setError(null);
      setProgress((current) => withSlot(current, tripCardId, slotIndex, !wasMarked));
      pending.current.add(key);

      try {
        if (wasMarked) await unmarkTripCardSlot(api, tripId, tripCardId, slotIndex);
        else await markTripCardSlot(api, tripId, tripCardId, slotIndex);

        // Reconcile only the square this request was about. The response also
        // carries the card's whole mark set, but applying that would let a
        // response computed before a *second* toggle landed arrive afterwards
        // and undo it — the player would watch their own mark disappear until
        // the next poll healed it. Each request is authoritative about its own
        // square and nothing else.
        setProgress((current) => withSlot(current, tripCardId, slotIndex, !wasMarked));
        return true;
      } catch {
        // Revert to the square's true state rather than leaving a mark that
        // exists only here.
        setProgress((current) => withSlot(current, tripCardId, slotIndex, wasMarked));
        setError("That square could not be updated. It may not be yours to mark, or the trip's dates may have passed.");
        return false;
      } finally {
        pending.current.delete(key);
      }
    },
    [api, tripId],
  );

  return { progress, error, clearError: () => setError(null), toggle };
}
