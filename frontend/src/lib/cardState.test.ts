import { describe, expect, it } from "vitest";
import { cardStateFrom, emptyCardState, entriesFromSlots } from "./cardState";
import type { CardUrlData } from "./cardData";
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
});
