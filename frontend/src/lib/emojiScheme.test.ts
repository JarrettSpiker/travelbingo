import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMOJI_SCHEME,
  MAX_EMOJIS,
  computeEdgeEmojiPositions,
  parseEmojis,
} from "./emojiScheme";

describe("DEFAULT_EMOJI_SCHEME", () => {
  it("has no emojis by default", () => {
    expect(DEFAULT_EMOJI_SCHEME.emojis).toEqual([]);
  });
});

describe("parseEmojis", () => {
  it("returns an empty array for empty input", () => {
    expect(parseEmojis("")).toEqual([]);
  });

  it("returns an empty array when there is no emoji", () => {
    expect(parseEmojis("just plain text")).toEqual([]);
  });

  it("extracts emojis from mixed text, preserving order", () => {
    expect(parseEmojis("hi 😊 there 🎉")).toEqual(["😊", "🎉"]);
  });

  it("keeps a ZWJ family sequence as a single emoji", () => {
    expect(parseEmojis("👨‍👩‍👧‍👦")).toHaveLength(1);
  });

  it("keeps a regional-indicator flag as a single emoji", () => {
    expect(parseEmojis("🇺🇸")).toEqual(["🇺🇸"]);
  });

  it("de-dupes repeated emojis", () => {
    expect(parseEmojis("😊😊🎉😊")).toEqual(["😊", "🎉"]);
  });

  it(`clamps to at most ${MAX_EMOJIS} emojis`, () => {
    const input = "🌟🎉❤️🚀🐬🦊🌈";
    expect(parseEmojis(input)).toHaveLength(MAX_EMOJIS);
  });
});

describe("computeEdgeEmojiPositions", () => {
  const onPerimeter = (x: number, y: number) => x === 0 || x === 100 || y === 0 || y === 100;

  it("returns an empty array when there are no emojis", () => {
    expect(computeEdgeEmojiPositions([], 3)).toEqual([]);
  });

  it("returns an empty array when count is zero", () => {
    expect(computeEdgeEmojiPositions(["🌟"], 0)).toEqual([]);
  });

  it("is deterministic across repeated calls", () => {
    const emojis = ["🌟", "🎉", "🚀"];
    expect(computeEdgeEmojiPositions(emojis, 3)).toEqual(computeEdgeEmojiPositions(emojis, 3));
  });

  it("produces the same layout for equal emoji sets", () => {
    expect(computeEdgeEmojiPositions(["🌟", "🎉", "🚀"], 3)).toEqual(
      computeEdgeEmojiPositions(["🌟", "🎉", "🚀"], 3),
    );
  });

  it("differs when the emoji set differs", () => {
    const a = computeEdgeEmojiPositions(["🌟", "🎉", "🚀"], 3);
    const b = computeEdgeEmojiPositions(["🌟", "🎉", "🐬"], 3);
    expect(a).not.toEqual(b);
  });

  it("places every position on the card perimeter", () => {
    const positions = computeEdgeEmojiPositions(["🌟", "🎉", "🚀", "🐬", "❤️"], 5);
    for (const { x, y } of positions) {
      expect(onPerimeter(x, y)).toBe(true);
    }
  });

  it("lays out one position per emoji when count equals the number of emojis", () => {
    const emojis = ["🌟", "🎉", "🚀"];
    const positions = computeEdgeEmojiPositions(emojis, emojis.length);
    expect(positions).toHaveLength(emojis.length);
    expect(positions.map((p) => p.emoji).sort()).toEqual([...emojis].sort());
  });

  it("cycles emojis when count exceeds the number of emojis", () => {
    const positions = computeEdgeEmojiPositions(["🌟", "🎉"], 4);
    expect(positions).toHaveLength(4);
    expect(positions.map((p) => p.emoji)).toEqual(["🌟", "🎉", "🌟", "🎉"]);
  });
});
