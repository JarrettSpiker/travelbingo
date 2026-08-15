import { describe, expect, it, vi } from "vitest";
import {
  createProgressPoller,
  isMarked,
  markedSlotsFor,
  mergeProgress,
  pendingCardIds,
  pendingKey,
  seedProgress,
  withCard,
  withSlot,
  type ProgressMap,
} from "./useTripProgress";
import type { TripCard } from "@/lib/tripTypes";

/**
 * The hook's decisions, without a DOM.
 *
 * This suite has no DOM (see dev/gallery/coverage.test.ts), so the hook itself
 * cannot be rendered. Everything worth protecting was therefore written as a
 * plain function: how a poll response folds into what is on screen, what an
 * optimistic toggle does, and when the poller is allowed to be running. The
 * remainder of `useTripProgress` is wiring those three to `document` and
 * `window`.
 */

function card(tripCardId: string, markedSlots: number[]): Pick<TripCard, "tripCardId" | "markedSlots"> {
  return { tripCardId, markedSlots };
}

function asObject(progress: ProgressMap): Record<string, number[]> {
  return Object.fromEntries([...progress].map(([id, slots]) => [id, [...slots].sort((a, b) => a - b)]));
}

describe("progress state", () => {
  it("seeds from the cards the trip was loaded with", () => {
    const progress = seedProgress([card("a", [0, 6]), card("b", [])]);
    expect(asObject(progress)).toEqual({ a: [0, 6], b: [] });
  });

  it("reports an untouched card as having no marks without allocating per call", () => {
    const progress = seedProgress([]);
    expect(markedSlotsFor(progress, "missing").size).toBe(0);
    expect(markedSlotsFor(progress, "missing")).toBe(markedSlotsFor(progress, "other"));
  });

  it("marks and unmarks one square, leaving every other card alone", () => {
    const start = seedProgress([card("a", [0]), card("b", [3])]);

    const marked = withSlot(start, "a", 6, true);
    expect(asObject(marked)).toEqual({ a: [0, 6], b: [3] });

    const unmarked = withSlot(marked, "a", 0, false);
    expect(asObject(unmarked)).toEqual({ a: [6], b: [3] });

    // Immutable: the original is untouched, so React sees a new reference.
    expect(asObject(start)).toEqual({ a: [0], b: [3] });
    expect(isMarked(start, "a", 6)).toBe(false);
    expect(isMarked(marked, "a", 6)).toBe(true);
  });

  it("is idempotent in both directions, like the API it mirrors", () => {
    const start = seedProgress([card("a", [0])]);
    expect(asObject(withSlot(start, "a", 0, true))).toEqual({ a: [0] });
    expect(asObject(withSlot(start, "a", 9, false))).toEqual({ a: [0] });
  });

  it("can mark a square on a card it has never seen", () => {
    // A card added by another member arrives on the next poll, not before it.
    expect(asObject(withSlot(seedProgress([]), "new", 4, true))).toEqual({ new: [4] });
  });

  it("replaces a card outright from a toggle's own response", () => {
    const start = seedProgress([card("a", [0, 1])]);
    const next = withCard(start, { tripCardId: "a", markedSlots: [7] });
    expect(asObject(next)).toEqual({ a: [7] });
  });

  it("treats a card with no markedSlots as having none, rather than throwing", () => {
    // Reachable in a deploy window where the bundle is live before the API is.
    // seedProgress runs during render, so throwing here is a blank page.
    const cards = [{ tripCardId: "a" }] as unknown as Parameters<typeof seedProgress>[0];
    expect(asObject(seedProgress(cards))).toEqual({ a: [] });
  });
});

describe("in-flight toggle bookkeeping", () => {
  it("keys a pending toggle per square, not per card", () => {
    // Per card, the first of two overlapping toggles to settle would clear the
    // entry while the second was still outstanding, and the next poll would
    // revert the second square under the player's finger.
    expect(pendingKey("a", 3)).not.toBe(pendingKey("a", 4));
    expect(pendingKey("a", 3)).toBe(pendingKey("a", 3));
  });

  it("recovers the card ids a set of pending squares covers", () => {
    const pending = new Set([pendingKey("a", 3), pendingKey("a", 4), pendingKey("b", 0)]);
    expect([...pendingCardIds(pending)].sort()).toEqual(["a", "b"]);
  });

  it("keeps a card pending until its last outstanding square settles", () => {
    const pending = new Set([pendingKey("a", 3), pendingKey("a", 4)]);
    pending.delete(pendingKey("a", 3));
    expect([...pendingCardIds(pending)]).toEqual(["a"]);
    pending.delete(pendingKey("a", 4));
    expect([...pendingCardIds(pending)]).toEqual([]);
  });

  it("recovers the card id even when it contains a colon", () => {
    // Trip card ids are base64url, so this cannot happen today — but splitting
    // on the last separator rather than the first costs nothing and removes the
    // assumption entirely.
    expect([...pendingCardIds(new Set(["od:d", "od:d:7"].map((k) => k)))].sort()).toEqual(["od", "od:d"]);
  });
});

describe("mergeProgress", () => {
  it("takes the server's answer for every card", () => {
    const start = seedProgress([card("a", [0]), card("b", [1])]);
    const next = mergeProgress(start, [
      { tripCardId: "a", markedSlots: [0, 6] },
      { tripCardId: "b", markedSlots: [] },
    ]);
    expect(asObject(next)).toEqual({ a: [0, 6], b: [] });
  });

  it("drops a card that is no longer in the trip", () => {
    const start = seedProgress([card("a", [0]), card("removed", [1, 2])]);
    const next = mergeProgress(start, [{ tripCardId: "a", markedSlots: [0] }]);
    expect(asObject(next)).toEqual({ a: [0] });
  });

  it("adds a card another member added", () => {
    const next = mergeProgress(seedProgress([]), [{ tripCardId: "new", markedSlots: [3] }]);
    expect(asObject(next)).toEqual({ new: [3] });
  });

  it("does not revert a card whose own mark is still in flight", () => {
    // The failure this prevents: a poll that *started* before the player's mark
    // landed arrives after it, and the square flips back under their finger.
    // That reads as the app losing the tap. The toggle's own response
    // reconciles the card instead.
    const optimistic = seedProgress([card("a", [0, 6]), card("b", [1])]);
    const stale = [
      { tripCardId: "a", markedSlots: [0] },
      { tripCardId: "b", markedSlots: [1, 9] },
    ];

    const next = mergeProgress(optimistic, stale, new Set(["a"]));

    expect(asObject(next)).toEqual({ a: [0, 6], b: [1, 9] });
  });

  it("still admits a pending card that it has never seen before", () => {
    const next = mergeProgress(seedProgress([]), [{ tripCardId: "a", markedSlots: [2] }], new Set(["a"]));
    expect(asObject(next)).toEqual({ a: [2] });
  });
});

describe("createProgressPoller", () => {
  function harness(options: { visible?: boolean; poll?: () => Promise<void> } = {}) {
    let visible = options.visible ?? true;
    const polls = { count: 0 };

    const poller = createProgressPoller({
      intervalMs: 10_000,
      isVisible: () => visible,
      schedule: (fn, ms) => setTimeout(fn, ms) as unknown as number,
      cancel: (handle) => clearTimeout(handle),
      poll:
        options.poll ??
        (async () => {
          polls.count += 1;
        }),
    });

    return {
      poller,
      polls,
      show() {
        visible = true;
        poller.refresh();
      },
      hide() {
        visible = false;
        poller.refresh();
      },
    };
  }

  it("polls on the interval while the page is visible", async () => {
    vi.useFakeTimers();
    const { poller, polls } = harness();

    await vi.advanceTimersByTimeAsync(35_000);
    expect(polls.count).toBe(3);

    poller.stop();
    vi.useRealTimers();
  });

  it("does not poll at all while the page is hidden", async () => {
    vi.useFakeTimers();
    const { poller, polls } = harness({ visible: false });

    await vi.advanceTimersByTimeAsync(60_000);
    expect(polls.count).toBe(0);

    poller.stop();
    vi.useRealTimers();
  });

  it("stops when the page is hidden and resumes when it comes back", async () => {
    // A trip left open in a background tab must not keep asking indefinitely.
    vi.useFakeTimers();
    const harnessed = harness();

    await vi.advanceTimersByTimeAsync(10_000);
    expect(harnessed.polls.count).toBe(1);

    harnessed.hide();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(harnessed.polls.count).toBe(1);

    harnessed.show();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(harnessed.polls.count).toBe(2);

    harnessed.poller.stop();
    vi.useRealTimers();
  });

  it("schedules nothing further once stopped", async () => {
    vi.useFakeTimers();
    const { poller, polls } = harness();

    poller.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(polls.count).toBe(0);

    // And a late visibility change cannot restart it.
    poller.refresh();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(polls.count).toBe(0);

    vi.useRealTimers();
  });

  it("does not stack a second poll behind one that has not answered", async () => {
    vi.useFakeTimers();
    let started = 0;
    let release: (() => void) | undefined;

    const { poller } = harness({
      poll: () => {
        started += 1;
        return new Promise<void>((resolve) => {
          release = resolve;
        });
      },
    });

    await vi.advanceTimersByTimeAsync(30_000);
    expect(started).toBe(1);

    release?.();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(started).toBe(2);

    poller.stop();
    vi.useRealTimers();
  });
});
