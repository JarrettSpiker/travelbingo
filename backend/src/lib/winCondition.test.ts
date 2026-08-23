import { describe, expect, it } from "vitest";
import { CELLS_PER_CARD } from "./tripPayload.ts";
import { completedLines, hasWon, LINES, squaresFromWin } from "./winCondition.ts";

// The twelve lines of the 5x5 grid, written out by hand as a fixed table so a
// change to the derivation fails loudly here — rather than producing a card
// that can never win, or always wins. This file's table is mirrored verbatim
// in frontend/src/lib/winCondition.test.ts; the two must stay identical.

const ROWS: [number, number, number, number, number][] = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
];

const COLUMNS: [number, number, number, number, number][] = [
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
];

const DIAGONALS: [number, number, number, number, number][] = [
  [0, 6, 12, 18, 24],
  [4, 8, 12, 16, 20],
];

const TWELVE_LINES = [...ROWS, ...COLUMNS, ...DIAGONALS];

const ALL = new Set(Array.from({ length: CELLS_PER_CARD }, (_, index) => index));

describe("LINES", () => {
  it("derives exactly the twelve lines of the 5x5 grid", () => {
    const actual = LINES.map((line) => [...line].sort((a, b) => a - b).join(",")).sort();
    const expected = TWELVE_LINES.map((line) => [...line].sort((a, b) => a - b).join(",")).sort();
    expect(actual).toEqual(expected);
  });
});

describe("completedLines", () => {
  // Each case is an object so it.each passes the line as one value; a bare
  // tuple would be spread across five parameters.
  it.each(TWELVE_LINES.map((line) => ({ line })))("counts $line marked on its own as one line", ({ line }) => {
    expect(completedLines(new Set(line))).toBe(1);
  });

  it("counts a crossing row and column as two lines", () => {
    // Row 0 and column 0 share position 0; that is two lines, not one and a half.
    expect(completedLines(new Set([...TWELVE_LINES[0]!, ...TWELVE_LINES[5]!]))).toBe(2);
  });

  it("counts a line one square short as none", () => {
    expect(completedLines(new Set(TWELVE_LINES[1]!.slice(0, 4)))).toBe(0);
  });

  it("counts nothing on an unmarked card", () => {
    expect(completedLines(new Set())).toBe(0);
  });
});

describe("hasWon", () => {
  it("line: a single complete line wins", () => {
    expect(hasWon(new Set(TWELVE_LINES[2]!), "line")).toBe(true);
  });

  it("line: a partial line does not", () => {
    expect(hasWon(new Set(TWELVE_LINES[2]!.slice(1)), "line")).toBe(false);
  });

  it("two-lines: one line alone is not enough", () => {
    expect(hasWon(new Set(TWELVE_LINES[0]!), "two-lines")).toBe(false);
  });

  it("two-lines: two crossing lines win", () => {
    expect(hasWon(new Set([...TWELVE_LINES[0]!, ...TWELVE_LINES[9]!]), "two-lines")).toBe(true);
  });

  it("full-card: every square on the grid is required", () => {
    const missingOne = new Set(ALL);
    missingOne.delete(12);
    expect(hasWon(missingOne, "full-card")).toBe(false);
    expect(hasWon(ALL, "full-card")).toBe(true);
  });
});

describe("squaresFromWin", () => {
  it("takes the cheapest route to a line", () => {
    // Column 0 is one square away (20); row 1 is three away (7, 8, 9).
    const marked = new Set([0, 5, 10, 15, 6, 7]);
    expect(squaresFromWin(marked, ALL, "line")).toBe(1);
  });

  it("returns 0 on a card that has already won", () => {
    expect(squaresFromWin(new Set(TWELVE_LINES[3]!), ALL, "line")).toBe(0);
  });

  it("returns Infinity when every line contains an unmarkable square", () => {
    // The main diagonal {0, 6, 12, 18, 24} crosses every row, every column,
    // and both diagonals, so removing it from `markable` leaves no completable
    // line at all.
    const holed = new Set(ALL);
    for (const index of DIAGONALS[0]!) holed.delete(index);
    expect(squaresFromWin(new Set(), holed, "line")).toBe(Infinity);
    expect(squaresFromWin(new Set(), holed, "two-lines")).toBe(Infinity);
  });

  it("two-lines: counts shared squares once — a crossing row and column is nine squares", () => {
    expect(squaresFromWin(new Set(), ALL, "two-lines")).toBe(9);
  });

  it("two-lines: a completed line leaves only the cheapest second line", () => {
    // Row 0 is done; column 0 shares position 0 and needs four more.
    expect(squaresFromWin(new Set(TWELVE_LINES[0]!), ALL, "two-lines")).toBe(4);
  });

  it("full-card: counts the unmarked squares", () => {
    expect(squaresFromWin(new Set(TWELVE_LINES[0]!), ALL, "full-card")).toBe(20);
  });

  it("full-card: any unmarkable square makes the target unreachable", () => {
    const holed = new Set(ALL);
    holed.delete(7);
    expect(squaresFromWin(new Set(), holed, "full-card")).toBe(Infinity);
  });
});
