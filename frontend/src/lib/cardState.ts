import { buildCard, cardFromSlots, type BingoCard, type BingoEntry } from "./bingo";
import type { CardUrlData } from "./cardData";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./colorScheme";
import { DEFAULT_EMOJI_SCHEME, type EmojiScheme } from "./emojiScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "./fontScheme";

// Extracted from the inline initial-state logic in App.tsx. Every way a card
// arrives in the editor — opening a saved card, or importing a share snapshot —
// goes through here, so they cannot drift.

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
 * The entry pool comes from {@link CardUrlData.entries} when present (a saved
 * card carrying the full pool, flags intact), and otherwise falls back to
 * deriving it from the grid slots (legacy cards, share snapshots). Either way
 * the rendered grid is reconstructed from the slots via cardFromSlots — not
 * re-laid-out from the pool — so an opened card is pixel-identical to how it was
 * saved, including a randomized arrangement.
 */
export function cardStateFrom(data: CardUrlData | null): CardState {
  if (!data) return emptyCardState();

  return {
    entries: data.entries ?? entriesFromSlots(data.slots),
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
