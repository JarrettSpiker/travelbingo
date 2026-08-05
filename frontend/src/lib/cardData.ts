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
