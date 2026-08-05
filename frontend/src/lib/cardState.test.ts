import { describe, expect, it } from "vitest";
import { cardFromSlots, cardToSlots, randomizeCard, type BingoEntry } from "./bingo";
import { cardStateFrom, emptyCardState, entriesFromSlots } from "./cardState";
import type { CardUrlData } from "./cardData";
import { fromSavedCardPayload, toSavedCardPayload } from "./savedCard";
import { DEFAULT_COLOR_SCHEME } from "./colorScheme";
import { DEFAULT_FONT_SCHEME } from "./fontScheme";

const data: CardUrlData = {
  slots: ["Airport", null, "Dog", "Cat", "Bus"],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: { backgroundColor: "#111111", cellColor: "#222222", textColor: "#333333", titleColor: "#444444" },
  fontScheme: { titleFont: "'Poppins', sans-serif", cellFont: "system-ui, sans-serif" },
  emojiScheme: { emojis: ["🚗"] },
};

describe("entriesFromSlots", () => {
  it("drops empty slots and marks nothing mandatory", () => {
    expect(entriesFromSlots(["a", null, "b"])).toEqual([
      { text: "a", mandatory: false },
      { text: "b", mandatory: false },
    ]);
  });
});

describe("emptyCardState", () => {
  it("is the defaults, with a blank card", () => {
    const state = emptyCardState();

    expect(state.entries).toEqual([]);
    expect(state.title).toBe("");
    expect(state.hasFreeSpace).toBe(true);
    expect(state.colorScheme).toEqual(DEFAULT_COLOR_SCHEME);
    expect(state.fontScheme).toEqual(DEFAULT_FONT_SCHEME);
  });
});

describe("cardStateFrom", () => {
  it("returns the empty state for null", () => {
    expect(cardStateFrom(null)).toEqual(emptyCardState());
  });

  it("carries every field across", () => {
    const state = cardStateFrom(data);

    expect(state.title).toBe("Road trip");
    expect(state.freeSpaceText).toBe("FREE");
    expect(state.colorScheme).toEqual(data.colorScheme);
    expect(state.fontScheme).toEqual(data.fontScheme);
    expect(state.emojiScheme).toEqual(data.emojiScheme);
  });

  it("preserves slot positions rather than re-laying-out the grid", () => {
    // The point of sharing a card is that the recipient sees the same grid.
    const state = cardStateFrom(data);
    const texts = state.card.cells.map((cell) => cell.text);

    expect(texts[0]).toBe("Airport");
    expect(texts[2]).toBe("Dog");
  });

  it("produces the same state for the same data", () => {
    expect(cardStateFrom(data)).toEqual(cardStateFrom(data));
  });

  it("falls back to deriving the pool from slots when entries is absent (legacy)", () => {
    // No entries field → pool is rebuilt from the grid, mandatory:false, as before.
    const state = cardStateFrom(data);
    expect(state.entries).toEqual(entriesFromSlots(data.slots));
    expect(state.entries.every((e) => e.mandatory === false && (e.enabled ?? true) === true)).toBe(true);
  });

  it("restores the full pool from entries with flags intact, while the grid still comes from slots", () => {
    const withPool: CardUrlData = {
      ...data,
      entries: [
        { text: "Airport", mandatory: false, enabled: true },
        { text: "Dog", mandatory: false, enabled: true },
        { text: "Beach", mandatory: true, enabled: true }, // in pool, not on this grid
        { text: "Museum", mandatory: false, enabled: false }, // disabled, in pool
      ],
    };
    const state = cardStateFrom(withPool);

    // Pool restored verbatim, including the off-grid and disabled entries.
    expect(state.entries).toEqual(withPool.entries);

    // Grid still reconstructed from slots — Beach/Museum do not appear on it.
    const gridTexts = state.card.cells.map((c) => c.text);
    expect(gridTexts).toContain("Airport");
    expect(gridTexts).toContain("Dog");
    expect(gridTexts).not.toContain("Beach");
    expect(gridTexts).not.toContain("Museum");
  });
});

describe("randomize -> save -> reload preserves the card", () => {
  // The regression guard for the reported concern: a randomized card must come
  // back from a save/reload cycle with its grid arrangement intact (the grid is
  // reconstructed from slots, never re-laid-out from the pool), and the full
  // pool must survive with its flags.
  const pool: BingoEntry[] = [
    { text: "Airport", mandatory: false, enabled: true },
    { text: "Beach", mandatory: true, enabled: true },
    { text: "Castle", mandatory: false, enabled: true },
    { text: "Dog", mandatory: false, enabled: true },
    { text: "Museum", mandatory: false, enabled: false },
  ];

  function deterministicRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  it("keeps the randomized grid and the full pool across a save/reload cycle", () => {
    const shuffled = randomizeCard(pool, { hasFreeSpace: true, freeSpaceText: "FREE" }, deterministicRng(0.5));
    const gridAtSave = shuffled.cells.map((c) => c.text);

    // App.currentCardData() captures the shuffled grid as slots and the live pool.
    const saved: CardUrlData = {
      slots: cardToSlots(shuffled, true),
      entries: pool,
      title: "Road trip",
      hasFreeSpace: true,
      freeSpaceText: "FREE",
      colorScheme: { backgroundColor: "#1", cellColor: "#2", textColor: "#3", titleColor: "#4" },
      fontScheme: { titleFont: "system-ui, sans-serif", cellFont: "system-ui, sans-serif" },
      emojiScheme: { emojis: [] },
    };

    // Save → wire payload → reload (the same path the API and a refresh take).
    const reloaded = cardStateFrom(fromSavedCardPayload(toSavedCardPayload(saved))!);

    expect(reloaded.card.cells.map((c) => c.text)).toEqual(gridAtSave); // grid preserved
    expect(reloaded.entries).toEqual(pool); // pool preserved with flags
    // The disabled entry must not have leaked onto the rendered grid.
    expect(reloaded.card.cells.map((c) => c.text)).not.toContain("Museum");
  });

  it("rebuilds an identical grid from the saved slots alone (cardFromSlots round-trip)", () => {
    const shuffled = randomizeCard(pool, { hasFreeSpace: true, freeSpaceText: "FREE" }, deterministicRng(0.91));
    expect(cardFromSlots(cardToSlots(shuffled, true), { hasFreeSpace: true, freeSpaceText: "FREE" })).toEqual(shuffled);
  });
});
