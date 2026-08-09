import { buildCard, type BingoEntry } from "../../lib/bingo";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "../../lib/colorScheme";

/**
 * Fixed sample data for the gallery.
 *
 * Kept apart from `samples.tsx` so that file exports only components and this
 * one exports only constants — which is what the fast-refresh lint rule wants.
 */

function entry(text: string, extra: Partial<BingoEntry> = {}): BingoEntry {
  return { text, mandatory: false, ...extra };
}

export function sampleEntry(text: string, extra: Partial<BingoEntry> = {}): BingoEntry {
  return entry(text, extra);
}

export const FEW_ENTRIES: BingoEntry[] = [
  entry("Red barn"),
  entry("Cows in a field", { mandatory: true }),
  entry("Out-of-state licence plate"),
  entry("Someone asks 'are we there yet?'", { enabled: false }),
  entry("Water tower"),
];

/** 26 unique enabled entries against 24 slots — the over-capacity warning. */
export const OVER_CAPACITY_ENTRIES: BingoEntry[] = Array.from({ length: 26 }, (_, i) =>
  entry(`Roadside sighting ${i + 1}`),
);

/** More mandatory entries than the card has slots. */
export const MANDATORY_OVERFLOW_ENTRIES: BingoEntry[] = Array.from({ length: 26 }, (_, i) =>
  entry(`Must appear ${i + 1}`, { mandatory: true }),
);

/** Includes one deliberately long entry, to exercise the per-cell font scaling. */
export const SAMPLE_CARD = buildCard(
  [
    ...FEW_ENTRIES,
    ...Array.from({ length: 20 }, (_, i) => entry(`Sight ${i + 1}`)),
    entry("A deliberately long entry that must scale its text down"),
  ],
  { hasFreeSpace: true, freeSpaceText: "FREE" },
);

/**
 * A believable mid-game card: two lines part-built and the free space taken.
 * Deliberately not a neat block, so the review shows marks against light and
 * dark cells, next to short and long entries, and over the emoji ring.
 */
export const SAMPLE_MARKED_SLOTS: ReadonlySet<number> = new Set([0, 1, 6, 7, 12, 18, 20, 24]);

/** Every square marked — the densest the marking layer ever gets. */
export const SAMPLE_FULL_MARKS: ReadonlySet<number> = new Set(
  Array.from({ length: 25 }, (_, index) => index),
);

/**
 * A dark card. The marking layer's colour is fixed and cannot adapt to the
 * user's `cellColor`, so "the entry text stays readable through the mark" has to
 * be checked against a dark card as well as a light one — that is the case where
 * a fixed translucent mark is most likely to fail.
 */
export const MIDNIGHT_COLORS: ColorScheme = {
  ...DEFAULT_COLOR_SCHEME,
  backgroundColor: "#101828",
  cellColor: "#1f2a44",
  textColor: "#e6edf7",
  titleColor: "#93c5fd",
};

export const SUNSET_COLORS: ColorScheme = {
  ...DEFAULT_COLOR_SCHEME,
  backgroundColor: "#fff4e6",
  cellColor: "#ffe8cc",
  textColor: "#5c3d2e",
  titleColor: "#c2410c",
};
