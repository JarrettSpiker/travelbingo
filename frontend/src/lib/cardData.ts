import type { BingoEntry } from "./bingo";
import type { ColorScheme } from "./colorScheme";
import type { EmojiScheme } from "./emojiScheme";
import type { FontScheme } from "./fontScheme";

// The typed shape of the editor's current card. This used to live in cardUrl.ts
// alongside the encode/decode for the ?card= URL; that mechanism is gone, but
// the type is still the lingua franca passed to cardStateFrom, the API wrapper,
// and CardView, so it stands on its own here as pure types.
export interface CardUrlData {
  slots: (string | null)[];
  /**
   * The full entry pool (text + mandatory + enabled). Present when the card was
   * saved or opened from a saved card; absent for cards that only ever existed
   * as on-grid slots (legacy cards, a freshly decoded share snapshot). When
   * absent, the pool is derived from {@link slots} via entriesFromSlots.
   */
  entries?: BingoEntry[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
}

function slotsEqual(a: (string | null)[], b: (string | null)[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((slot, i) => slot === b[i]);
}

function entriesEqual(a: BingoEntry[] | undefined, b: BingoEntry[] | undefined): boolean {
  if (a === b) return true;
  // An absent pool and an empty one describe the same editor — cardStateFrom
  // derives the pool from the slots when it is missing.
  const left = a ?? [];
  const right = b ?? [];
  if (left.length !== right.length) return false;
  return left.every((entry, i) => {
    const other = right[i];
    return (
      entry.text === other.text &&
      entry.mandatory === other.mandatory &&
      // `enabled` defaults to true, so an explicit true and an absent flag are
      // the same entry and must not read as an edit.
      (entry.enabled ?? true) === (other.enabled ?? true)
    );
  });
}

function colorSchemesEqual(a: ColorScheme, b: ColorScheme): boolean {
  return (
    a === b ||
    (a.backgroundColor === b.backgroundColor &&
      a.cellColor === b.cellColor &&
      a.textColor === b.textColor &&
      a.titleColor === b.titleColor)
  );
}

function fontSchemesEqual(a: FontScheme, b: FontScheme): boolean {
  return a === b || (a.titleFont === b.titleFont && a.cellFont === b.cellFont);
}

function emojiSchemesEqual(a: EmojiScheme, b: EmojiScheme): boolean {
  if (a === b) return true;
  if (a.emojis.length !== b.emojis.length) return false;
  return a.emojis.every((emoji, i) => emoji === b.emojis[i]);
}

/**
 * Structural equality over two card snapshots.
 *
 * This is how the editor knows it has unsaved changes: its current
 * `currentCardData()` is compared against the baseline it opened with (and that
 * every successful save refreshes). A comparison rather than a `dirty` flag
 * because a flag relies on every one of the editor's mutating handlers — and
 * every handler added later — remembering to set it.
 *
 * Everything a save persists is compared, including `slots`: randomizing
 * changes only the grid arrangement, and that is a real unsaved change.
 */
export function cardDataEquals(
  a: CardUrlData | null | undefined,
  b: CardUrlData | null | undefined,
): boolean {
  if (a === b) return true;
  // Two absent snapshots are equal (null and undefined alike); one absent and
  // one present never are.
  if (a == null || b == null) return a == null && b == null;

  return (
    a.title === b.title &&
    a.hasFreeSpace === b.hasFreeSpace &&
    a.freeSpaceText === b.freeSpaceText &&
    slotsEqual(a.slots, b.slots) &&
    entriesEqual(a.entries, b.entries) &&
    colorSchemesEqual(a.colorScheme, b.colorScheme) &&
    fontSchemesEqual(a.fontScheme, b.fontScheme) &&
    emojiSchemesEqual(a.emojiScheme, b.emojiScheme)
  );
}
