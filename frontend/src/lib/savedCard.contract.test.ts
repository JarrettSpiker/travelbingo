import { describe, expect, it } from "vitest";
import { MAX_THUMBNAIL_BYTES } from "./cardThumbnail";
import { MAX_EMOJIS } from "./emojiScheme";
import { FONT_OPTIONS } from "./fontScheme";
import { MAX_ENTRIES, fromSavedCardPayload, toSavedCardPayload } from "./savedCard";

// The wire-shape contract between this package and backend/.
//
// Mirrored by backend/src/lib/cardPayload.contract.test.ts. The two pin the
// same literal shape, the same font allowlist, and the same bounds, because
// nothing else links them at compile time. If you change one, change both.

const WIRE_CARD = {
  slots: ["Airport", null, "Dog"],
  // The full entry pool: larger than the 3-slot grid (Beach and Museum never
  // appear on the rendered card), with a mandatory flag and a disabled entry.
  // Mirrored verbatim in backend/src/lib/cardPayload.contract.test.ts.
  entries: [
    { text: "Airport", mandatory: false, enabled: true },
    { text: "Dog", mandatory: false, enabled: true },
    { text: "Beach", mandatory: true, enabled: true },
    { text: "Museum", mandatory: false, enabled: false },
  ],
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
      "entries",
      "fontScheme",
      "freeSpaceText",
      "hasFreeSpace",
      "slots",
      "title",
    ]);
  });

  it("derives a pool from slots when the editor had no entries (share-copy / legacy path)", () => {
    // CardUrlData without an entries field still produces a well-formed payload,
    // so the backend's required-on-write contract is satisfied.
    const { entries: _omit, ...wireWithoutEntries } = WIRE_CARD;
    void _omit;
    const decoded = fromSavedCardPayload(wireWithoutEntries)!;
    expect(decoded.entries).toBeUndefined();
    const payload = toSavedCardPayload(decoded);
    expect(payload.entries).toEqual([
      { text: "Airport", mandatory: false, enabled: true },
      { text: "Dog", mandatory: false, enabled: true },
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
    // MAX_EMOJIS mirrors the backend's cardPayload.MAX_EMOJIS,
    // MAX_ENTRIES mirrors the backend's cardPayload.MAX_ENTRIES, and
    // MAX_THUMBNAIL_BYTES mirrors the backend's cardPayload.MAX_THUMBNAIL_BYTES.
    expect(MAX_EMOJIS).toBe(5);
    expect(MAX_ENTRIES).toBe(256);
    expect(MAX_THUMBNAIL_BYTES).toBe(100_000);
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
