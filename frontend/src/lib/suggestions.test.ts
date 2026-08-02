import { describe, expect, it } from "vitest";
import type { BingoEntry } from "./bingo";
import { appendCells } from "./suggestions";

function entry(text: string, opts?: { mandatory?: boolean; enabled?: boolean }): BingoEntry {
  return { text, mandatory: opts?.mandatory ?? false, enabled: opts?.enabled ?? true };
}

describe("appendCells", () => {
  it("appends cells as enabled, non-mandatory entries", () => {
    const result = appendCells([], ["Sun", "Moon"]);
    expect(result.entries).toEqual([
      { text: "Sun", mandatory: false, enabled: true },
      { text: "Moon", mandatory: false, enabled: true },
    ]);
    expect(result.added).toEqual(["Sun", "Moon"]);
    expect(result.skipped).toEqual([]);
  });

  it("preserves existing entries unchanged", () => {
    const existing = [entry("Star"), entry("Comet", { mandatory: true })];
    const result = appendCells(existing, ["Planet"]);
    expect(result.entries.slice(0, existing.length)).toEqual(existing);
  });

  it("skips cells that duplicate an existing entry (case-insensitive, trimmed)", () => {
    const result = appendCells([entry("Star")], ["star", "  STAR ", "Moon"]);
    expect(result.added).toEqual(["Moon"]);
    expect(result.skipped).toEqual(["star", "STAR"]);
    expect(result.entries).toHaveLength(2);
  });

  it("de-dupes within the incoming batch", () => {
    const result = appendCells([], ["Sun", "sun", "SUN"]);
    expect(result.added).toEqual(["Sun"]);
    expect(result.skipped).toEqual(["sun", "SUN"]);
    expect(result.entries).toHaveLength(1);
  });

  it("ignores empty and whitespace-only cells", () => {
    const result = appendCells([], ["", "   ", "Sun"]);
    expect(result.added).toEqual(["Sun"]);
    expect(result.entries).toHaveLength(1);
  });

  it("trims incoming cell text", () => {
    const result = appendCells([], ["  Sun  "]);
    expect(result.entries[0].text).toBe("Sun");
  });

  it("treats a disabled existing entry as still occupying the pool", () => {
    const result = appendCells([entry("Star", { enabled: false })], ["star"]);
    expect(result.added).toEqual([]);
    expect(result.skipped).toEqual(["star"]);
  });
});
