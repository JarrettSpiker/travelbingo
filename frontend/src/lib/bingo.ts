export const GRID_SIZE = 5;
export const CELLS_PER_CARD = GRID_SIZE * GRID_SIZE;
export const FREE_SPACE_INDEX = Math.floor(CELLS_PER_CARD / 2);
export const CARD_SLOT_COUNT = CELLS_PER_CARD - 1;
export const DEFAULT_FREE_SPACE_TEXT = "FREE";

export type BingoCellKind = "entry" | "free" | "blank";

export interface BingoCell {
  text: string;
  kind: BingoCellKind;
}

export interface BingoCard {
  cells: BingoCell[];
}

export interface BingoEntry {
  text: string;
  mandatory: boolean;
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

export function getUniqueEntries(entries: BingoEntry[]): BingoEntry[] {
  const seen = new Set<string>();
  const unique: BingoEntry[] = [];
  for (const entry of entries) {
    const trimmed = entry.text.trim();
    if (!trimmed) continue;
    const key = normalize(trimmed);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ text: trimmed, mandatory: entry.mandatory });
  }
  return unique;
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function padWithBlanks(items: string[], length: number): (string | null)[] {
  const slots: (string | null)[] = items.slice(0, length);
  while (slots.length < length) slots.push(null);
  return slots;
}

function resolveFreeSpaceText(freeSpaceText?: string): string {
  return freeSpaceText?.trim() || DEFAULT_FREE_SPACE_TEXT;
}

/**
 * Picks which entries (by text) appear on the card. Within capacity, every
 * entry appears and mandatory status has no effect. Over capacity, mandatory
 * entries are guaranteed a slot (up to CARD_SLOT_COUNT) and the rest is
 * filled from the remaining pool. Passing `rng` shuffles each group before
 * combining (used by randomizeCard); omitting it preserves pool order (used
 * by buildCard).
 */
function selectEntryTexts(entries: BingoEntry[], rng?: () => number): string[] {
  const unique = getUniqueEntries(entries);
  if (unique.length <= CARD_SLOT_COUNT) {
    const texts = unique.map((entry) => entry.text);
    return rng ? shuffle(texts, rng) : texts;
  }

  const mandatoryTexts = unique.filter((entry) => entry.mandatory).map((entry) => entry.text);
  const optionalTexts = unique.filter((entry) => !entry.mandatory).map((entry) => entry.text);
  const orderedMandatory = rng ? shuffle(mandatoryTexts, rng) : mandatoryTexts;
  const orderedOptional = rng ? shuffle(optionalTexts, rng) : optionalTexts;

  const selectedMandatory = orderedMandatory.slice(0, CARD_SLOT_COUNT);
  const remainingSlots = CARD_SLOT_COUNT - selectedMandatory.length;
  return [...selectedMandatory, ...orderedOptional.slice(0, remainingSlots)];
}

/** Assembles a card from an explicit 24-slot arrangement (null = blank). */
export function cardFromSlots(slots: (string | null)[], freeSpaceText?: string): BingoCard {
  const resolvedFreeSpaceText = resolveFreeSpaceText(freeSpaceText);
  const cells: BingoCell[] = [];
  let slotIndex = 0;
  for (let i = 0; i < CELLS_PER_CARD; i++) {
    if (i === FREE_SPACE_INDEX) {
      cells.push({ text: resolvedFreeSpaceText, kind: "free" });
      continue;
    }
    const value = slots[slotIndex];
    slotIndex++;
    cells.push(value === null ? { text: "", kind: "blank" } : { text: value, kind: "entry" });
  }
  return { cells };
}

/** Extracts the 24-slot arrangement (null = blank) a card was built from. */
export function cardToSlots(card: BingoCard): (string | null)[] {
  return card.cells
    .filter((_, i) => i !== FREE_SPACE_INDEX)
    .map((cell) => (cell.kind === "blank" ? null : cell.text));
}

/**
 * Builds the "live" card: entries fill the grid in pool order, with any
 * remaining cells left blank. Adding/editing/removing an entry only ever
 * changes the cells affected — the rest of the layout stays stable. When the
 * pool exceeds 24 entries, mandatory entries are guaranteed inclusion.
 */
export function buildCard(entries: BingoEntry[], freeSpaceText?: string): BingoCard {
  return cardFromSlots(padWithBlanks(selectEntryTexts(entries), CARD_SLOT_COUNT), freeSpaceText);
}

/**
 * Builds a randomized card: a random 24-entry subset of the pool (all of it,
 * if there are 24 or fewer) in random order, with blank positions also
 * randomized when the pool is short of 24 entries. When the pool exceeds 24
 * entries, mandatory entries are guaranteed inclusion (the random subset is
 * drawn from the remaining, non-mandatory entries).
 */
export function randomizeCard(
  entries: BingoEntry[],
  freeSpaceText?: string,
  rng: () => number = Math.random,
): BingoCard {
  const selected = selectEntryTexts(entries, rng);
  const slots = shuffle(padWithBlanks(selected, CARD_SLOT_COUNT), rng);
  return cardFromSlots(slots, freeSpaceText);
}
