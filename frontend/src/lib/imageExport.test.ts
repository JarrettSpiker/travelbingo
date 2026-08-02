import { describe, expect, it } from "vitest";
import { buildImageFilename } from "./imageExport";

describe("buildImageFilename", () => {
  it("derives a .png filename from a titled card", () => {
    expect(buildImageFilename("Road Trip")).toBe("Road Trip.png");
  });

  it("falls back to the default name for an empty title", () => {
    expect(buildImageFilename("")).toBe("bingo-card.png");
  });

  it("falls back to the default name for a whitespace-only title", () => {
    expect(buildImageFilename("    ")).toBe("bingo-card.png");
  });

  it("strips unsafe filename characters", () => {
    expect(buildImageFilename('a/b:c*d?e"f<g>h|i')).toBe("abcdefghi.png");
  });

  it("strips control characters", () => {
    expect(buildImageFilename("a\u0000b\u0007c")).toBe("abc.png");
  });

  it("strips Unicode bidi/override characters", () => {
    expect(buildImageFilename("a\u202eb")).toBe("ab.png");
    expect(buildImageFilename("x\u2066y\u2069z")).toBe("xyz.png");
  });

  it("collapses runs of whitespace into a single space", () => {
    expect(buildImageFilename("Road   Trip\tBingo")).toBe("Road Trip Bingo.png");
  });

  it("falls back to the default name when the title is all unsafe characters", () => {
    expect(buildImageFilename('???***')).toBe("bingo-card.png");
  });

  it("caps a long title to a maximum base length", () => {
    const longTitle = "a".repeat(100);
    const filename = buildImageFilename(longTitle);
    expect(filename).toBe(`${"a".repeat(60)}.png`);
    expect(filename.length).toBe(64);
  });

  it("does not cap a title within the maximum base length", () => {
    const title = "b".repeat(60);
    expect(buildImageFilename(title)).toBe(`${title}.png`);
  });
});
