import { buildCard, cardFromSlots, type BingoCard, type BingoEntry } from "./bingo";
import type { CardUrlData } from "./cardUrl";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./colorScheme";
import { DEFAULT_EMOJI_SCHEME, type EmojiScheme } from "./emojiScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "./fontScheme";

// Extracted from the inline initial-state logic in App.tsx, which had one
// caller when the only way to load a card was a ?card= URL. There are now
// three: the URL import, opening a saved card, and importing a share snapshot.
// All three go through here, so they cannot drift.

export interface CardState {
  entries: BingoEntry[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
  card: BingoCard;
}

export function entriesFromSlots(slots: (string | null)[]): BingoEntry[] {
  return slots
    .filter((slot): slot is string => slot !== null)
    .map((text) => ({ text, mandatory: false }));
}

export function emptyCardState(): CardState {
  return {
    entries: [],
    title: "",
    hasFreeSpace: true,
    freeSpaceText: "",
    colorScheme: DEFAULT_COLOR_SCHEME,
    fontScheme: DEFAULT_FONT_SCHEME,
    emojiScheme: DEFAULT_EMOJI_SCHEME,
    card: buildCard([]),
  };
}

/**
 * Builds editor state from decoded card data.
 *
 * Note it uses cardFromSlots, not buildCard: the grid is reconstructed in the
 * exact positions it was shared in, rather than being laid out afresh. That is
 * the whole point of sharing a card.
 */
export function cardStateFrom(data: CardUrlData | null): CardState {
  if (!data) return emptyCardState();

  return {
    entries: entriesFromSlots(data.slots),
    title: data.title,
    hasFreeSpace: data.hasFreeSpace,
    freeSpaceText: data.freeSpaceText,
    colorScheme: data.colorScheme,
    fontScheme: data.fontScheme,
    emojiScheme: data.emojiScheme,
    card: cardFromSlots(data.slots, {
      hasFreeSpace: data.hasFreeSpace,
      freeSpaceText: data.freeSpaceText,
    }),
  };
}
