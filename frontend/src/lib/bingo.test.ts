import { describe, expect, it } from "vitest";
import {
  CARD_SLOT_COUNT,
  CELLS_PER_CARD,
  DEFAULT_FREE_SPACE_TEXT,
  FREE_SPACE_INDEX,
  buildCard,
  cardFromSlots,
  cardToSlots,
  getUniqueEntries,
  randomizeCard,
  type BingoEntry,
} from "./bingo";

function makeEntries(count: number, offset = 0, mandatoryIndices: number[] = []): BingoEntry[] {
  return Array.from({ length: count }, (_, i) => ({
    text: `Entry ${i + 1 + offset}`,
    mandatory: mandatoryIndices.includes(i),
  }));
}

function texts(entries: BingoEntry[]): string[] {
  return entries.map((e) => e.text);
}

function nonFreeCells(card: ReturnType<typeof buildCard>) {
  return card.cells.filter((_, i) => i !== FREE_SPACE_INDEX);
}

describe("getUniqueEntries", () => {
  it("dedupes case-insensitive and trimmed entries", () => {
    const result = getUniqueEntries([
      { text: "Cat", mandatory: false },
      { text: " cat ", mandatory: false },
      { text: "CAT", mandatory: true },
      { text: "Dog", mandatory: false },
      { text: "", mandatory: false },
    ]);
    expect(result).toEqual([
      { text: "Cat", mandatory: false },
      { text: "Dog", mandatory: false },
    ]);
  });
});

describe("buildCard", () => {
  it("always has 25 cells with the free space in the center", () => {
    const card = buildCard(makeEntries(24));
    expect(card.cells).toHaveLength(CELLS_PER_CARD);
    expect(card.cells[FREE_SPACE_INDEX].kind).toBe("free");
    expect(card.cells[FREE_SPACE_INDEX].text).toBe(DEFAULT_FREE_SPACE_TEXT);
  });

  it("fills cells in pool order and leaves the rest blank when the pool is short", () => {
    const card = buildCard(makeEntries(5));
    const cells = nonFreeCells(card);
    expect(cells.slice(0, 5).map((c) => c.text)).toEqual(["Entry 1", "Entry 2", "Entry 3", "Entry 4", "Entry 5"]);
    expect(cells.slice(0, 5).every((c) => c.kind === "entry")).toBe(true);

    const blanks = cells.slice(5);
    expect(blanks).toHaveLength(CARD_SLOT_COUNT - 5);
    expect(blanks.every((c) => c.kind === "blank" && c.text === "")).toBe(true);
  });

  it("renders an all-blank card (besides the free space) for an empty pool", () => {
    const card = buildCard([]);
    const cells = nonFreeCells(card);
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
    expect(cells.every((c) => c.kind === "blank")).toBe(true);
  });

  it("only shows the first 24 entries when the pool exceeds capacity and none are mandatory", () => {
    const card = buildCard(makeEntries(30));
    const cells = nonFreeCells(card);
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
    expect(cells.every((c) => c.kind === "entry")).toBe(true);
    expect(cells[0].text).toBe("Entry 1");
    expect(cells[CARD_SLOT_COUNT - 1].text).toBe("Entry 24");
  });

  it("defaults the free space text to FREE and honors a custom value", () => {
    expect(buildCard([]).cells[FREE_SPACE_INDEX].text).toBe("FREE");
    expect(buildCard([], "Lucky Star").cells[FREE_SPACE_INDEX].text).toBe("Lucky Star");
    expect(buildCard([], "   ").cells[FREE_SPACE_INDEX].text).toBe("FREE");
  });

  it("only changes the affected cells when an entry is added, edited, or removed", () => {
    const before = nonFreeCells(buildCard(makeEntries(10))).slice(0, 10);

    const afterAdd = nonFreeCells(buildCard([...makeEntries(10), { text: "Entry 11", mandatory: false }]));
    expect(afterAdd.slice(0, 10)).toEqual(before);
    expect(afterAdd[10]).toEqual({ text: "Entry 11", kind: "entry" });

    const edited = makeEntries(10);
    edited[3] = { text: "Edited Entry Four", mandatory: false };
    const afterEdit = nonFreeCells(buildCard(edited)).slice(0, 10);
    expect(afterEdit[3]).toEqual({ text: "Edited Entry Four", kind: "entry" });
    expect(afterEdit.filter((_, i) => i !== 3)).toEqual(before.filter((_, i) => i !== 3));
  });

  it("has no effect from mandatory flags when the pool fits within capacity", () => {
    const withoutMandatory = nonFreeCells(buildCard(makeEntries(10)));
    const withMandatory = nonFreeCells(buildCard(makeEntries(10, 0, [7])));
    expect(withMandatory).toEqual(withoutMandatory);
  });

  it("guarantees mandatory entries appear when the pool exceeds capacity", () => {
    // 30 entries, last 3 (indices 27-29) marked mandatory — they'd be
    // truncated by plain pool-order selection since capacity is 24.
    const entries = makeEntries(30, 0, [27, 28, 29]);
    const cells = nonFreeCells(buildCard(entries));
    const shownTexts = cells.map((c) => c.text);
    expect(shownTexts).toContain("Entry 28");
    expect(shownTexts).toContain("Entry 29");
    expect(shownTexts).toContain("Entry 30");
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
  });

  it("shows as many mandatory entries as fit when mandatory count exceeds capacity", () => {
    const entries = makeEntries(30, 0, Array.from({ length: 26 }, (_, i) => i));
    const card = buildCard(entries);
    const cells = nonFreeCells(card);
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
    expect(cells.every((c) => c.kind === "entry")).toBe(true);
  });
});

describe("randomizeCard", () => {
  it("always has 25 cells with the free space in the center", () => {
    const card = randomizeCard(makeEntries(24));
    expect(card.cells).toHaveLength(CELLS_PER_CARD);
    expect(card.cells[FREE_SPACE_INDEX].kind).toBe("free");
  });

  it("includes every entry exactly once when the pool has 24 or fewer entries", () => {
    const entries = makeEntries(20);
    const cells = nonFreeCells(randomizeCard(entries));
    const entryTexts = cells.filter((c) => c.kind === "entry").map((c) => c.text).sort();
    expect(entryTexts).toEqual([...texts(entries)].sort());
    expect(cells.filter((c) => c.kind === "blank")).toHaveLength(CARD_SLOT_COUNT - entries.length);
  });

  it("selects a random 24-entry subset when the pool exceeds capacity and none are mandatory", () => {
    const entries = makeEntries(30);
    const cells = nonFreeCells(randomizeCard(entries));
    expect(cells.every((c) => c.kind === "entry")).toBe(true);
    const entryTexts = new Set(cells.map((c) => c.text));
    expect(entryTexts.size).toBe(CARD_SLOT_COUNT);
    for (const text of entryTexts) {
      expect(texts(entries)).toContain(text);
    }
  });

  it("uses a custom free space text, defaulting to FREE", () => {
    expect(randomizeCard([]).cells[FREE_SPACE_INDEX].text).toBe("FREE");
    expect(randomizeCard([], "Wild Card").cells[FREE_SPACE_INDEX].text).toBe("Wild Card");
  });

  it("produces a different arrangement across repeated calls (extremely unlikely to collide)", () => {
    const entries = makeEntries(24);
    const first = nonFreeCells(randomizeCard(entries)).map((c) => c.text);
    const second = nonFreeCells(randomizeCard(entries)).map((c) => c.text);
    expect(first).not.toEqual(second);
  });

  it("guarantees mandatory entries appear when the pool exceeds capacity", () => {
    const entries = makeEntries(30, 0, [27, 28, 29]);
    const cells = nonFreeCells(randomizeCard(entries));
    const shownTexts = cells.map((c) => c.text);
    expect(shownTexts).toContain("Entry 28");
    expect(shownTexts).toContain("Entry 29");
    expect(shownTexts).toContain("Entry 30");
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
  });

  it("shows as many mandatory entries as fit when mandatory count exceeds capacity", () => {
    const entries = makeEntries(30, 0, Array.from({ length: 26 }, (_, i) => i));
    const cells = nonFreeCells(randomizeCard(entries));
    expect(cells).toHaveLength(CARD_SLOT_COUNT);
    expect(cells.every((c) => c.kind === "entry")).toBe(true);
  });
});

describe("cardToSlots / cardFromSlots", () => {
  it("round-trips a live card, including trailing blanks", () => {
    const card = buildCard(makeEntries(10), "Wild");
    const slots = cardToSlots(card);
    expect(cardFromSlots(slots, "Wild")).toEqual(card);
  });

  it("round-trips a randomized card, including scattered blanks", () => {
    const card = randomizeCard(makeEntries(10), "Wild");
    const slots = cardToSlots(card);
    expect(cardFromSlots(slots, "Wild")).toEqual(card);
  });

  it("preserves blank positions in the middle of the grid", () => {
    const slots: (string | null)[] = [
      "A", null, "B", null, "C", null, "D", null, "E", null, "F", null,
      "G", null, "H", null, "I", null, "J", null, "K", null, "L", null,
    ];
    const card = cardFromSlots(slots, "FREE");
    expect(cardToSlots(card)).toEqual(slots);
  });
});
