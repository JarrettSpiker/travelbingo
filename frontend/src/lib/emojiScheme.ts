export interface EmojiScheme {
  emojis: string[];
}

export const DEFAULT_EMOJI_SCHEME: EmojiScheme = { emojis: [] };

export const MAX_EMOJIS = 5;

export interface EmojiPosition {
  /** Horizontal position as a percentage of the card width (0–100). */
  x: number;
  /** Vertical position as a percentage of the card height (0–100). */
  y: number;
  emoji: string;
}

const REGIONAL_INDICATOR_A = 0x1f1e6;
const REGIONAL_INDICATOR_Z = 0x1f1ff;
const PICTOGRAPHIC = /\p{Extended_Pictographic}/u;
const PERIMETER = 400;

const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });

/** True when a grapheme cluster contains an emoji (pictographic or a regional-indicator flag). */
function isEmojiGrapheme(grapheme: string): boolean {
  // `for...of` over a string iterates code points (1- or 2-unit surrogate pairs),
  // so each `codePoint` is a full code point and .codePointAt(0) is intentional.
  for (const codePoint of grapheme) {
    const cp = codePoint.codePointAt(0);
    if (cp === undefined) continue;
    if (cp >= REGIONAL_INDICATOR_A && cp <= REGIONAL_INDICATOR_Z) return true;
    if (PICTOGRAPHIC.test(codePoint)) return true;
  }
  return false;
}

/**
 * Extracts up to {@link MAX_EMOJIS} emoji grapheme clusters from arbitrary text.
 * Handles ZWJ sequences, variation selectors, skin-tone modifiers, and flag
 * pairs (each counts as one). De-dupes by grapheme and preserves first-seen order.
 */
export function parseEmojis(input: string): string[] {
  if (!input) return [];
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const { segment } of segmenter.segment(input)) {
    if (!isEmojiGrapheme(segment)) continue;
    if (seen.has(segment)) continue;
    seen.add(segment);
    picked.push(segment);
    if (picked.length >= MAX_EMOJIS) break;
  }
  return picked;
}

/** Stable 32-bit FNV-1a hash, so the same emoji set always maps to the same seed. */
function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Maps a distance along the unit-square perimeter (0–400) to an (x, y) percentage on the border. */
function perimeterToPoint(distance: number): { x: number; y: number } {
  const p = ((distance % PERIMETER) + PERIMETER) % PERIMETER;
  const side = Math.floor(p / 100);
  const fraction = p % 100;
  switch (side) {
    case 0:
      return { x: fraction, y: 0 };
    case 1:
      return { x: 100, y: fraction };
    case 2:
      return { x: 100 - fraction, y: 100 };
    default:
      return { x: 0, y: 100 - fraction };
  }
}

/**
 * Distributes `count` positions around the card's rectangular border. The ring is
 * rotated by a deterministic offset derived from the emoji set, so a given set
 * always yields the same layout while different sets differ. Emojis cycle through
 * the positions (callers usually pass `count === emojis.length` for one each).
 */
export function computeEdgeEmojiPositions(emojis: string[], count: number): EmojiPosition[] {
  if (emojis.length === 0 || count <= 0) return [];
  const spacing = PERIMETER / count;
  const startOffset = hashString(emojis.join("")) % spacing;
  const positions: EmojiPosition[] = [];
  for (let i = 0; i < count; i++) {
    const { x, y } = perimeterToPoint(startOffset + i * spacing);
    positions.push({ x, y, emoji: emojis[i % emojis.length] });
  }
  return positions;
}
