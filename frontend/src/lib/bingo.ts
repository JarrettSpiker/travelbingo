export const GRID_SIZE = 5;
export const CELLS_PER_CARD = GRID_SIZE * GRID_SIZE;
export const FREE_SPACE_INDEX = Math.floor(CELLS_PER_CARD / 2);
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
  /** Whether the entry is eligible to appear on the card. Defaults to true. */
  enabled?: boolean;
}

export interface CardOptions {
  /** Whether the center cell is a free space or a normal entry/blank cell. Defaults to true. */
  hasFreeSpace?: boolean;
  freeSpaceText?: string;
}

/** Number of grid cells available for entries/blanks, i.e. all cells except the free space (if any). */
export function getCardSlotCount(hasFreeSpace: boolean): number {
  return hasFreeSpace ? CELLS_PER_CARD - 1 : CELLS_PER_CARD;
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
    unique.push({ text: trimmed, mandatory: entry.mandatory, enabled: entry.enabled ?? true });
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
 * Picks which entries (by text) appear on the card. Disabled entries
 * (enabled === false) are excluded before selection. Within capacity, every
 * eligible entry appears and mandatory status has no effect. Over capacity,
 * mandatory entries are guaranteed a slot (up to slotCount) and the rest is
 * filled from the remaining eligible pool. Passing `rng` shuffles each group
 * before combining (used by randomizeCard); omitting it preserves pool order
 * (used by buildCard).
 */
function selectEntryTexts(entries: BingoEntry[], slotCount: number, rng?: () => number): string[] {
  const eligible = getUniqueEntries(entries).filter((entry) => entry.enabled !== false);
  if (eligible.length <= slotCount) {
    const texts = eligible.map((entry) => entry.text);
    return rng ? shuffle(texts, rng) : texts;
  }

  const mandatoryTexts = eligible.filter((entry) => entry.mandatory).map((entry) => entry.text);
  const optionalTexts = eligible.filter((entry) => !entry.mandatory).map((entry) => entry.text);
  const orderedMandatory = rng ? shuffle(mandatoryTexts, rng) : mandatoryTexts;
  const orderedOptional = rng ? shuffle(optionalTexts, rng) : optionalTexts;

  const selectedMandatory = orderedMandatory.slice(0, slotCount);
  const remainingSlots = slotCount - selectedMandatory.length;
  return [...selectedMandatory, ...orderedOptional.slice(0, remainingSlots)];
}

/**
 * Assembles a card from an explicit slot arrangement (null = blank). The
 * slots array should have `getCardSlotCount(options.hasFreeSpace)` entries.
 */
export function cardFromSlots(slots: (string | null)[], options: CardOptions = {}): BingoCard {
  const hasFreeSpace = options.hasFreeSpace ?? true;
  const resolvedFreeSpaceText = resolveFreeSpaceText(options.freeSpaceText);
  const cells: BingoCell[] = [];
  let slotIndex = 0;
  for (let i = 0; i < CELLS_PER_CARD; i++) {
    if (hasFreeSpace && i === FREE_SPACE_INDEX) {
      cells.push({ text: resolvedFreeSpaceText, kind: "free" });
      continue;
    }
    const value = slots[slotIndex];
    slotIndex++;
    cells.push(value === null ? { text: "", kind: "blank" } : { text: value, kind: "entry" });
  }
  return { cells };
}

/** Extracts the slot arrangement (null = blank) a card was built from. */
export function cardToSlots(card: BingoCard, hasFreeSpace: boolean = true): (string | null)[] {
  return card.cells
    .filter((_, i) => !hasFreeSpace || i !== FREE_SPACE_INDEX)
    .map((cell) => (cell.kind === "blank" ? null : cell.text));
}

/**
 * Builds the "live" card: entries fill the grid in pool order, with any
 * remaining cells left blank. Adding/editing/removing an entry only ever
 * changes the cells affected — the rest of the layout stays stable. When the
 * pool exceeds capacity, mandatory entries are guaranteed inclusion.
 */
export function buildCard(entries: BingoEntry[], options: CardOptions = {}): BingoCard {
  const hasFreeSpace = options.hasFreeSpace ?? true;
  const slotCount = getCardSlotCount(hasFreeSpace);
  return cardFromSlots(padWithBlanks(selectEntryTexts(entries, slotCount), slotCount), options);
}

/**
 * Builds a randomized card: a random subset of the pool (all of it, if there
 * are fewer entries than available slots) in random order, with blank
 * positions also randomized when the pool is short. When the pool exceeds
 * capacity, mandatory entries are guaranteed inclusion (the random subset is
 * drawn from the remaining, non-mandatory entries).
 */
export function randomizeCard(
  entries: BingoEntry[],
  options: CardOptions = {},
  rng: () => number = Math.random,
): BingoCard {
  const hasFreeSpace = options.hasFreeSpace ?? true;
  const slotCount = getCardSlotCount(hasFreeSpace);
  const selected = selectEntryTexts(entries, slotCount, rng);
  const slots = shuffle(padWithBlanks(selected, slotCount), rng);
  return cardFromSlots(slots, options);
}
