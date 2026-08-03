import { describe, expect, it } from "vitest";
import { ALLOWED_FONTS, MAX_EMOJIS, MAX_SLOTS, parseCardPayload } from "./cardPayload.ts";

// The wire-shape contract between this package and the frontend.
//
// CardUrlData, the font allowlist, and the color rule are duplicated across
// backend/ and frontend/ with no compile-time link — the largest accepted piece
// of technical debt in this change (see design.md). npm workspaces was rejected
// because it hoists node_modules and would break _deploy.yml's
// cache-dependency-path invariant.
//
// This file is mirrored by frontend/src/lib/savedCard.contract.test.ts. The two
// pin the same literal shape, so divergence fails CI instead of silently
// corrupting stored cards. If you change either, change both.

const WIRE_CARD = {
  slots: ["Airport", null, "Dog"],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: {
    backgroundColor: "#ffffff",
    cellColor: "#eeeeee",
    textColor: "#1a1a1a",
    titleColor: "#1a1a1a",
  },
  fontScheme: {
    titleFont: "system-ui, sans-serif",
    cellFont: "'Poppins', sans-serif",
  },
  emojiScheme: {
    emojis: ["🚗", "🌲"],
  },
};

describe("stored card wire shape", () => {
  it("round-trips the pinned payload unchanged", () => {
    expect(parseCardPayload(WIRE_CARD)).toEqual(WIRE_CARD);
  });

  it("has exactly these top-level fields", () => {
    expect(Object.keys(parseCardPayload(WIRE_CARD)).sort()).toEqual([
      "colorScheme",
      "emojiScheme",
      "fontScheme",
      "freeSpaceText",
      "hasFreeSpace",
      "slots",
      "title",
    ]);
  });

  it("pins the font allowlist to the frontend's FONT_OPTIONS values", () => {
    expect([...ALLOWED_FONTS].sort()).toEqual(
      [
        "'Anton', sans-serif",
        "'Arial Narrow', Arial, sans-serif",
        "'Comic Sans MS', 'Comic Sans', cursive",
        "'Courier New', Courier, monospace",
        "'Fredoka', sans-serif",
        "'Pacifico', cursive",
        "'Playfair Display', serif",
        "'Poppins', sans-serif",
        "Georgia, 'Times New Roman', serif",
        "system-ui, sans-serif",
      ].sort(),
    );
  });

  it("pins the shared bounds", () => {
    // MAX_EMOJIS must equal the frontend's emojiScheme.MAX_EMOJIS, and
    // MAX_SLOTS the frontend's cardUrl.MAX_SLOTS.
    expect(MAX_EMOJIS).toBe(5);
    expect(MAX_SLOTS).toBe(64);
  });
});
