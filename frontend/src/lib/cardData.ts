import type { ColorScheme } from "./colorScheme";
import type { EmojiScheme } from "./emojiScheme";
import type { FontScheme } from "./fontScheme";

// The typed shape of the editor's current card. This used to live in cardUrl.ts
// alongside the encode/decode for the ?card= URL; that mechanism is gone, but
// the type is still the lingua franca passed to cardStateFrom, the API wrapper,
// and CardView, so it stands on its own here as pure types.
export interface CardUrlData {
  slots: (string | null)[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
}
