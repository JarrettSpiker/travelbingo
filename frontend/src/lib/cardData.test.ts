import { describe, expect, it } from "vitest";
import { buildCard, cardToSlots, randomizeCard, type BingoEntry } from "./bingo";
import { cardDataEquals, type CardUrlData } from "./cardData";
import { emptyCardState } from "./cardState";
import { DEFAULT_COLOR_SCHEME } from "./colorScheme";
import { DEFAULT_EMOJI_SCHEME } from "./emojiScheme";
import { DEFAULT_FONT_SCHEME } from "./fontScheme";

const entries: BingoEntry[] = [
  { text: "Airport", mandatory: true },
  { text: "Dog", mandatory: false },
  { text: "Bus", mandatory: false, enabled: false },
];

const base: CardUrlData = {
  slots: ["Airport", null, "Dog", "Bus"],
  entries,
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: DEFAULT_COLOR_SCHEME,
  fontScheme: DEFAULT_FONT_SCHEME,
  emojiScheme: { emojis: ["🚗"] },
};

/** A structurally identical snapshot that shares no references with `base`. */
function copyOfBase(): CardUrlData {
  return {
    ...base,
    slots: [...base.slots],
    entries: base.entries!.map((entry) => ({ ...entry })),
    colorScheme: { ...base.colorScheme },
    fontScheme: { ...base.fontScheme },
    emojiScheme: { emojis: [...base.emojiScheme.emojis] },
  };
}

/** The snapshot an untouched empty editor produces, as App builds it. */
function emptyEditorSnapshot(): CardUrlData {
  const state = emptyCardState();
  return {
    slots: cardToSlots(state.card, state.hasFreeSpace),
    entries: state.entries,
    title: state.title,
    hasFreeSpace: state.hasFreeSpace,
    freeSpaceText: state.freeSpaceText,
    colorScheme: state.colorScheme,
    fontScheme: state.fontScheme,
    emojiScheme: state.emojiScheme,
  };
}

describe("cardDataEquals", () => {
  it("is true for the same object and for a structural copy", () => {
    expect(cardDataEquals(base, base)).toBe(true);
    expect(cardDataEquals(base, copyOfBase())).toBe(true);
  });

  it("is true for two absent snapshots and false when only one is absent", () => {
    expect(cardDataEquals(null, null)).toBe(true);
    expect(cardDataEquals(null, undefined)).toBe(true);
    expect(cardDataEquals(base, null)).toBe(false);
    expect(cardDataEquals(undefined, base)).toBe(false);
  });

  it("is false when a single entry's text changed", () => {
    const edited = copyOfBase();
    edited.entries![1] = { ...edited.entries![1], text: "Cat" };

    expect(cardDataEquals(base, edited)).toBe(false);
  });

  it("is false when a mandatory or enabled flag changed", () => {
    const mandatory = copyOfBase();
    mandatory.entries![1] = { ...mandatory.entries![1], mandatory: true };
    const enabled = copyOfBase();
    enabled.entries![2] = { ...enabled.entries![2], enabled: true };

    expect(cardDataEquals(base, mandatory)).toBe(false);
    expect(cardDataEquals(base, enabled)).toBe(false);
  });

  it("treats an absent enabled flag as enabled", () => {
    const explicit = copyOfBase();
    explicit.entries![1] = { text: "Dog", mandatory: false, enabled: true };

    expect(cardDataEquals(base, explicit)).toBe(true);
  });

  it("is false when an entry was added or removed", () => {
    const added = copyOfBase();
    added.entries = [...added.entries!, { text: "Train", mandatory: false }];

    expect(cardDataEquals(base, added)).toBe(false);
    expect(cardDataEquals(base, { ...copyOfBase(), entries: [] })).toBe(false);
  });

  it("is false when the grid arrangement changed but the entries did not", () => {
    // Randomize is the case a per-handler dirty flag most easily misses: the
    // pool is untouched and only the slots move.
    const pool: BingoEntry[] = Array.from({ length: 24 }, (_, i) => ({
      text: `Entry ${i + 1}`,
      mandatory: false,
    }));
    const options = { hasFreeSpace: true, freeSpaceText: "FREE" };
    const before: CardUrlData = { ...base, entries: pool, slots: cardToSlots(buildCard(pool, options), true) };
    let after = before;
    // Randomize until the arrangement actually differs — a shuffle is allowed
    // to return the same order, and that is not what this test is about.
    for (let attempt = 0; attempt < 20 && cardDataEquals(before, after); attempt++) {
      after = { ...before, slots: cardToSlots(randomizeCard(pool, options), true) };
    }

    expect(after.entries).toEqual(before.entries);
    expect(cardDataEquals(before, after)).toBe(false);
  });

  it("is false when the title or free space changed", () => {
    expect(cardDataEquals(base, { ...copyOfBase(), title: "Flight bingo" })).toBe(false);
    expect(cardDataEquals(base, { ...copyOfBase(), freeSpaceText: "GO" })).toBe(false);
    expect(cardDataEquals(base, { ...copyOfBase(), hasFreeSpace: false })).toBe(false);
  });

  it("is false when a colour, font, or emoji scheme changed", () => {
    const colors = copyOfBase();
    colors.colorScheme = { ...colors.colorScheme, titleColor: "#123456" };
    const fonts = copyOfBase();
    fonts.fontScheme = { ...fonts.fontScheme, titleFont: "'Anton', sans-serif" };
    const emojis = copyOfBase();
    emojis.emojiScheme = { emojis: ["🚗", "✈️"] };

    expect(cardDataEquals(base, colors)).toBe(false);
    expect(cardDataEquals(base, fonts)).toBe(false);
    expect(cardDataEquals(base, emojis)).toBe(false);
  });

  it("sees an untouched empty editor as clean and an edited one as dirty", () => {
    const empty = emptyEditorSnapshot();
    const edited: CardUrlData = { ...empty, title: "Road trip" };

    expect(cardDataEquals(empty, emptyEditorSnapshot())).toBe(true);
    expect(cardDataEquals(empty, edited)).toBe(false);
    expect(cardDataEquals(empty, { ...empty, emojiScheme: DEFAULT_EMOJI_SCHEME })).toBe(true);
  });

  it("sees a baseline refreshed after a save as clean again", () => {
    // The save flow's contract: the snapshot that was persisted becomes the new
    // baseline, so the editor is clean until the next edit.
    const beforeSave = copyOfBase();
    const savedBaseline = beforeSave;

    expect(cardDataEquals(beforeSave, savedBaseline)).toBe(true);
    expect(cardDataEquals({ ...beforeSave, title: "Edited after saving" }, savedBaseline)).toBe(
      false,
    );
  });
});
