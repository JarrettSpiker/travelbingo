import { describe, expect, it } from "vitest";
import {
  ALLOWED_FONTS,
  MAX_EMOJIS,
  MAX_ENTRIES,
  MAX_SLOTS,
  MAX_THUMBNAIL_BYTES,
  parseCardPayload,
  parseThumbnail,
} from "./cardPayload.ts";

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
  // The full entry pool: larger than the 3-slot grid (Beach and Museum never
  // appear on the rendered card), with a mandatory flag and a disabled entry.
  // Mirrored verbatim in frontend/src/lib/savedCard.contract.test.ts.
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
    expect(parseCardPayload(WIRE_CARD)).toEqual(WIRE_CARD);
  });

  it("has exactly these top-level fields", () => {
    expect(Object.keys(parseCardPayload(WIRE_CARD)).sort()).toEqual([
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
    // MAX_EMOJIS must equal the frontend's emojiScheme.MAX_EMOJIS,
    // MAX_SLOTS the frontend's savedCard.MAX_SLOTS,
    // MAX_ENTRIES the frontend's savedCard.MAX_ENTRIES, and
    // MAX_THUMBNAIL_BYTES the frontend's cardThumbnail.MAX_THUMBNAIL_BYTES.
    expect(MAX_EMOJIS).toBe(5);
    expect(MAX_SLOTS).toBe(64);
    expect(MAX_ENTRIES).toBe(256);
    expect(MAX_THUMBNAIL_BYTES).toBe(100_000);
  });
});

describe("thumbnail input contract", () => {
  // The save body carries an optional `thumbnail` sibling field (not part of
  // CardPayload): a data:image/png;base64 URL. Mirrored by the frontend's
  // generateCardThumbnail output shape.

  function dataUrl(bytes: Buffer): string {
    return `data:image/png;base64,${bytes.toString("base64")}`;
  }

  it("accepts a well-formed PNG data URL under the cap", () => {
    const bytes = Buffer.from("small-thumbnail");
    expect(parseThumbnail(dataUrl(bytes))).toEqual(bytes);
  });

  it("returns null when no thumbnail is supplied", () => {
    expect(parseThumbnail(undefined)).toBeNull();
    expect(parseThumbnail(null)).toBeNull();
  });

  it("drops an invalid thumbnail rather than throwing", () => {
    // The thumbnail is non-essential: a malformed one is dropped so the card
    // still saves, rather than rejecting the whole request.
    expect(parseThumbnail("not-a-data-url")).toBeNull();
    expect(parseThumbnail("data:image/jpeg;base64,AAAA")).toBeNull(); // wrong type
    expect(parseThumbnail(42)).toBeNull();
    expect(parseThumbnail("data:image/png;base64,")).toBeNull(); // empty
  });

  it("rejects a thumbnail whose decoded size exceeds the cap", () => {
    const oversized = Buffer.alloc(MAX_THUMBNAIL_BYTES + 1, 0x41);
    expect(parseThumbnail(dataUrl(oversized))).toBeNull();
  });
});
