// The target a trip is played toward, and the pure geometry of reaching it.
// Mirrored by hand into frontend/src/lib/winCondition.ts; the two must stay in
// sync, and their identical test tables (including the full twelve-line
// enumeration) are the only thing linking them.
//
// This module owns the grid's geometry (mirroring GRID_SIZE/CELLS_PER_CARD in
// frontend/src/lib/bingo.ts) and depends on nothing else in the package —
// deliberately, so importing it from a validator can never create a cycle.

/** The grid is a fixed 5x5. */
export const GRID_SIZE = 5;
export const CELLS_PER_CARD = GRID_SIZE * GRID_SIZE;

export type WinCondition = "line" | "two-lines" | "full-card";

/** The allowlist a trip payload's `winCondition` is validated against. */
export const WIN_CONDITIONS: ReadonlySet<WinCondition> = new Set(["line", "two-lines", "full-card"]);

/** What a trip without a stated win condition is read as. */
export const DEFAULT_WIN_CONDITION: WinCondition = "line";

/**
 * Every line on the grid: 5 rows + 5 columns + 2 diagonals = 12 lines of 5
 * indices each. Derived from the grid size rather than written out, so a grid
 * that is ever not five-by-five does not need the table re-typed — the
 * co-located test enumerates all twelve explicitly and fails loudly if the
 * derivation drifts.
 */
export const LINES: readonly (readonly number[])[] = [
  ...Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => row * GRID_SIZE + col),
  ),
  ...Array.from({ length: GRID_SIZE }, (_, col) =>
    Array.from({ length: GRID_SIZE }, (_, row) => row * GRID_SIZE + col),
  ),
  Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + i),
  Array.from({ length: GRID_SIZE }, (_, i) => i * GRID_SIZE + (GRID_SIZE - 1 - i)),
];

/**
 * How many complete lines a set of marks contains. A blank square is never in
 * `marked` (it cannot be marked), so a line through one can never complete —
 * no special-casing needed.
 */
export function completedLines(marked: ReadonlySet<number>): number {
  let count = 0;
  for (const line of LINES) {
    if (line.every((index) => marked.has(index))) count += 1;
  }
  return count;
}

/**
 * Whether the marks meet the condition. `full-card` requires every position on
 * the grid, which is why a card carrying blanks can never complete one — the
 * unreachable case, by decision, rather than a countable shortfall.
 */
export function hasWon(marked: ReadonlySet<number>, condition: WinCondition): boolean {
  switch (condition) {
    case "line":
      return completedLines(marked) >= 1;
    case "two-lines":
      return completedLines(marked) >= 2;
    case "full-card":
      for (let index = 0; index < CELLS_PER_CARD; index += 1) {
        if (!marked.has(index)) return false;
      }
      return true;
  }
}

/**
 * How many further squares the card needs before it meets the condition: 0
 * when it has already met it, `Infinity` when it never can.
 *
 * `markable` is the set of positions that hold a real square, so a line (or
 * pair of lines, or the whole card) containing a position outside it is
 * unreachable rather than merely incomplete. `two-lines` means any two
 * *distinct* lines, which may cross and share squares — a shared square is
 * counted once, which is what makes a crossing row and column nine squares
 * rather than ten.
 */
export function squaresFromWin(
  marked: ReadonlySet<number>,
  markable: ReadonlySet<number>,
  condition: WinCondition,
): number {
  if (hasWon(marked, condition)) return 0;

  const cost = (positions: Iterable<number>): number => {
    let missing = 0;
    for (const index of positions) {
      if (!markable.has(index)) return Infinity;
      if (!marked.has(index)) missing += 1;
    }
    return missing;
  };

  switch (condition) {
    case "line": {
      let best = Infinity;
      for (const line of LINES) best = Math.min(best, cost(line));
      return best;
    }
    case "two-lines": {
      let best = Infinity;
      for (let i = 0; i < LINES.length; i += 1) {
        const first = LINES[i];
        if (first === undefined) continue;
        for (let j = i + 1; j < LINES.length; j += 1) {
          const second = LINES[j];
          if (second === undefined) continue;
          const union = new Set<number>([...first, ...second]);
          best = Math.min(best, cost(union));
        }
      }
      return best;
    }
    case "full-card": {
      let missing = 0;
      for (let index = 0; index < CELLS_PER_CARD; index += 1) {
        if (!markable.has(index)) return Infinity;
        if (!marked.has(index)) missing += 1;
      }
      return missing;
    }
  }
}
