import { describe, expect, it } from "vitest";
import { MAX_EMOJIS } from "./emojiScheme";
import { FONT_OPTIONS } from "./fontScheme";
import { fromSavedCardPayload, toSavedCardPayload } from "./savedCard";

// The wire-shape contract between this package and backend/.
//
// Mirrored by backend/src/lib/cardPayload.contract.test.ts. The two pin the
// same literal shape, the same font allowlist, and the same bounds, because
// nothing else links them at compile time. If you change one, change both.

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
    const decoded = fromSavedCardPayload(WIRE_CARD);
    expect(decoded).not.toBeNull();
    expect(toSavedCardPayload(decoded!)).toEqual(WIRE_CARD);
  });

  it("has exactly these top-level fields", () => {
    const decoded = fromSavedCardPayload(WIRE_CARD)!;
    expect(Object.keys(toSavedCardPayload(decoded)).sort()).toEqual([
      "colorScheme",
      "emojiScheme",
      "fontScheme",
      "freeSpaceText",
      "hasFreeSpace",
      "slots",
      "title",
    ]);
  });

  it("pins the font allowlist the backend enforces", () => {
    expect(FONT_OPTIONS.map((option) => option.value).sort()).toEqual(
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
    expect(MAX_EMOJIS).toBe(5);
  });
});

describe("fromSavedCardPayload", () => {
  it("defaults rather than throwing on a malformed payload", () => {
    // The API rejects these, so this is defense in depth: a card the user can
    // still see is a card they can still fix.
    const decoded = fromSavedCardPayload({
      slots: ["a"],
      title: 42,
      colorScheme: { backgroundColor: "javascript:alert(1)" },
      fontScheme: { titleFont: "url(evil)" },
      emojiScheme: { emojis: "nope" },
    })!;

    expect(decoded.title).toBe("");
    expect(decoded.colorScheme.backgroundColor).toBe("#ffffff");
    expect(decoded.fontScheme.titleFont).toBe("system-ui, sans-serif");
    expect(decoded.emojiScheme.emojis).toEqual([]);
  });

  it("returns null when there is no card at all", () => {
    expect(fromSavedCardPayload(null)).toBeNull();
    expect(fromSavedCardPayload("card")).toBeNull();
    expect(fromSavedCardPayload({})).toBeNull();
  });

  it("normalizes empty strings to null slots", () => {
    expect(fromSavedCardPayload({ ...WIRE_CARD, slots: ["a", "", null] })?.slots).toEqual(["a", null, null]);
  });
});
