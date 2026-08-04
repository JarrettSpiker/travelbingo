import type { CardUrlData } from "./cardData";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./colorScheme";
import { MAX_EMOJIS } from "./emojiScheme";
import { DEFAULT_FONT_SCHEME, FONT_OPTIONS, type FontScheme } from "./fontScheme";

// Converts between editor state and the payload stored by the API.
//
// The stored shape is deliberately CardUrlData: a saved card and a shared
// snapshot both come back as CardUrlData and flow through the same
// cardStateFrom -> cardFromSlots path. There is exactly one deserializer for a
// card in this app, and this is not a second one.
//
// The wire shape is duplicated in backend/src/lib/cardPayload.ts with no
// compile-time link between them — the largest accepted piece of technical debt
// in this change. savedCard.contract.test.ts here and
// cardPayload.contract.test.ts there pin the same literal, so divergence fails
// CI rather than silently corrupting stored cards.

export interface SavedCardPayload {
  slots: (string | null)[];
  title: string;
  hasFreeSpace: boolean;
  freeSpaceText: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: { emojis: string[] };
}

/** Summary row as returned by GET /api/cards. */
export interface SavedCardSummary {
  cardId: string;
  title: string;
  updatedAt: string;
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const ALLOWED_FONTS = new Set(FONT_OPTIONS.map((option) => option.value));
const MAX_SLOTS = 64;

export function toSavedCardPayload(data: CardUrlData): SavedCardPayload {
  return {
    // Normalized the same way the API will: "" and null both mean an empty
    // cell, so sending one consistently keeps a round-trip stable.
    slots: data.slots.map((slot) => (slot === null || slot === "" ? null : slot)),
    title: data.title,
    hasFreeSpace: data.hasFreeSpace,
    freeSpaceText: data.freeSpaceText,
    colorScheme: data.colorScheme,
    fontScheme: data.fontScheme,
    emojiScheme: { emojis: data.emojiScheme.emojis },
  };
}

function readColor(value: unknown, fallback: string): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

function readFont(value: unknown, fallback: string): string {
  return typeof value === "string" && ALLOWED_FONTS.has(value) ? value : fallback;
}

/**
 * Reads a payload from the API back into card data.
 *
 * The API rejects anything malformed, so this should never see a bad payload —
 * but it defaults rather than throws anyway. A half-rendered card beats a blank
 * page, and a stored card the user can still see is a card they can still fix.
 */
export function fromSavedCardPayload(payload: unknown): CardUrlData | null {
  if (typeof payload !== "object" || payload === null) return null;
  const raw = payload as Record<string, unknown>;
  if (!Array.isArray(raw.slots)) return null;

  const colorScheme = (typeof raw.colorScheme === "object" && raw.colorScheme !== null
    ? raw.colorScheme
    : {}) as Record<string, unknown>;
  const fontScheme = (typeof raw.fontScheme === "object" && raw.fontScheme !== null
    ? raw.fontScheme
    : {}) as Record<string, unknown>;
  const emojiScheme = (typeof raw.emojiScheme === "object" && raw.emojiScheme !== null
    ? raw.emojiScheme
    : {}) as Record<string, unknown>;

  return {
    slots: raw.slots
      .slice(0, MAX_SLOTS)
      .map((slot) => (typeof slot === "string" && slot !== "" ? slot : null)),
    title: typeof raw.title === "string" ? raw.title : "",
    hasFreeSpace: typeof raw.hasFreeSpace === "boolean" ? raw.hasFreeSpace : true,
    freeSpaceText: typeof raw.freeSpaceText === "string" ? raw.freeSpaceText : "",
    colorScheme: {
      backgroundColor: readColor(colorScheme.backgroundColor, DEFAULT_COLOR_SCHEME.backgroundColor),
      cellColor: readColor(colorScheme.cellColor, DEFAULT_COLOR_SCHEME.cellColor),
      textColor: readColor(colorScheme.textColor, DEFAULT_COLOR_SCHEME.textColor),
      titleColor: readColor(colorScheme.titleColor, DEFAULT_COLOR_SCHEME.titleColor),
    },
    fontScheme: {
      titleFont: readFont(fontScheme.titleFont, DEFAULT_FONT_SCHEME.titleFont),
      cellFont: readFont(fontScheme.cellFont, DEFAULT_FONT_SCHEME.cellFont),
    },
    emojiScheme: {
      emojis: Array.isArray(emojiScheme.emojis)
        ? emojiScheme.emojis.filter((item): item is string => typeof item === "string").slice(0, MAX_EMOJIS)
        : [],
    },
  };
}
