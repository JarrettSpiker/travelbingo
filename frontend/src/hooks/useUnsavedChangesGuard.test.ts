import { describe, expect, it } from "vitest";
import { cardDataEquals, type CardUrlData } from "@/lib/cardData";
import { DEFAULT_COLOR_SCHEME } from "@/lib/colorScheme";
import { DEFAULT_EMOJI_SCHEME } from "@/lib/emojiScheme";
import { DEFAULT_FONT_SCHEME } from "@/lib/fontScheme";

/**
 * The hook's decision, without a DOM.
 *
 * `useUnsavedChangesGuard` is two lines of wiring over one value: it blocks when
 * `isDirty`, and arms `beforeunload` when `isDirty`. The suite has no DOM (see
 * dev/gallery/coverage.test.ts), so rendering the hook is not available — and
 * the part worth protecting is not the wiring but what feeds it: the editor's
 * baseline lifecycle in App.tsx, modelled here exactly as App holds it (a
 * baseline seeded on mount and refreshed only by a successful save).
 */
class EditorModel {
  private baseline: CardUrlData;
  private current: CardUrlData;

  constructor(opened: CardUrlData) {
    this.current = opened;
    this.baseline = opened;
  }

  edit(change: Partial<CardUrlData>) {
    this.current = { ...this.current, ...change };
  }

  /** Mirrors saveCurrentCard: the baseline moves only when the save succeeds. */
  save(succeeds: boolean) {
    const saved = this.current;
    if (succeeds) this.baseline = saved;
  }

  get isDirty(): boolean {
    return !cardDataEquals(this.current, this.baseline);
  }

  /** What `useBlocker(() => isDirty)` reports for a pending navigation. */
  get blocksNavigation(): boolean {
    return this.isDirty;
  }
}

const openedCard: CardUrlData = {
  slots: ["Airport", "Dog", null],
  entries: [
    { text: "Airport", mandatory: false },
    { text: "Dog", mandatory: false },
  ],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: DEFAULT_COLOR_SCHEME,
  fontScheme: DEFAULT_FONT_SCHEME,
  emojiScheme: DEFAULT_EMOJI_SCHEME,
};

describe("unsaved-changes guard", () => {
  it("does not block navigation from a freshly opened card", () => {
    const editor = new EditorModel(openedCard);

    expect(editor.blocksNavigation).toBe(false);
  });

  it("blocks navigation once the card is edited", () => {
    const editor = new EditorModel(openedCard);

    editor.edit({ title: "Flight bingo" });

    expect(editor.blocksNavigation).toBe(true);
  });

  it("lets navigation proceed after a successful save", () => {
    const editor = new EditorModel(openedCard);
    editor.edit({ title: "Flight bingo" });

    editor.save(true);

    expect(editor.blocksNavigation).toBe(false);
  });

  it("keeps blocking after a failed save", () => {
    const editor = new EditorModel(openedCard);
    editor.edit({ title: "Flight bingo" });

    editor.save(false);

    expect(editor.blocksNavigation).toBe(true);
  });

  it("blocks again on the next edit after a save", () => {
    const editor = new EditorModel(openedCard);
    editor.edit({ title: "Flight bingo" });
    editor.save(true);

    editor.edit({ freeSpaceText: "GO" });

    expect(editor.blocksNavigation).toBe(true);
  });
});
