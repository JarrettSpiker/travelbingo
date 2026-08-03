import { describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { MAX_PAYLOAD_BYTES, MAX_SLOTS, parseCardPayload, parseTitle } from "./cardPayload.ts";

const valid = {
  slots: ["Airport", "", null, "Dog"],
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
  emojiScheme: { emojis: ["🚗", "🌲"] },
};

function rejects(input: unknown): number {
  try {
    parseCardPayload(input);
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("parseCardPayload", () => {
  it("accepts a well-formed payload", () => {
    const parsed = parseCardPayload(valid);
    expect(parsed.title).toBe("Road trip");
    expect(parsed.emojiScheme.emojis).toEqual(["🚗", "🌲"]);
  });

  it("normalizes empty slot strings to null", () => {
    expect(parseCardPayload(valid).slots).toEqual(["Airport", null, null, "Dog"]);
  });

  it("rejects rather than defaults — unlike the URL decoder", () => {
    // frontend/src/lib/cardUrl.ts substitutes a default for each of these,
    // because a half-broken card beats a blank page. Persisted state gets the
    // opposite treatment: storing a silently corrected payload would keep
    // something the user never authored.
    expect(rejects({ ...valid, title: 42 })).toBe(400);
    expect(rejects({ ...valid, hasFreeSpace: "yes" })).toBe(400);
    expect(rejects({ ...valid, colorScheme: { ...valid.colorScheme, textColor: "red" } })).toBe(400);
    expect(rejects({ ...valid, fontScheme: { ...valid.fontScheme, titleFont: "Comic Sans" } })).toBe(400);
  });

  it("rejects colors that are not hex", () => {
    expect(rejects({ ...valid, colorScheme: { ...valid.colorScheme, backgroundColor: "javascript:alert(1)" } })).toBe(400);
    expect(rejects({ ...valid, colorScheme: { ...valid.colorScheme, backgroundColor: "#12" } })).toBe(400);
  });

  it("rejects fonts outside the editor's options", () => {
    expect(rejects({ ...valid, fontScheme: { ...valid.fontScheme, cellFont: "url(evil)" } })).toBe(400);
  });

  it("bounds the number of slots", () => {
    const slots = Array.from({ length: MAX_SLOTS + 1 }, () => "x");
    expect(rejects({ ...valid, slots })).toBe(400);
  });

  it("bounds the number of emojis", () => {
    expect(rejects({ ...valid, emojiScheme: { emojis: ["1", "2", "3", "4", "5", "6"] } })).toBe(400);
  });

  it("bounds individual text lengths", () => {
    expect(rejects({ ...valid, title: "x".repeat(201) })).toBe(400);
    expect(rejects({ ...valid, slots: ["x".repeat(201)] })).toBe(400);
    expect(rejects({ ...valid, freeSpaceText: "x".repeat(201) })).toBe(400);
  });

  it("keeps the largest payload the per-field bounds permit under the size cap", () => {
    // The size check is defense-in-depth, not the primary bound: the per-field
    // limits already keep a valid payload well under it. This pins that
    // relationship, so loosening a field bound past the cap fails here rather
    // than at runtime. The reachable guard is on the raw request body — see
    // MAX_BODY_BYTES in router.test.ts.
    const slots = Array.from({ length: MAX_SLOTS }, () => "x".repeat(200));
    const largest = { ...valid, slots, title: "x".repeat(200), freeSpaceText: "x".repeat(200) };

    expect(rejects(largest)).toBe(200);
    expect(Buffer.byteLength(JSON.stringify(parseCardPayload(largest)))).toBeLessThan(MAX_PAYLOAD_BYTES);
  });

  it("rejects non-objects", () => {
    expect(rejects(null)).toBe(400);
    expect(rejects("card")).toBe(400);
    expect(rejects([])).toBe(400);
  });
});

describe("parseTitle", () => {
  it("accepts a bounded string and rejects anything else", () => {
    expect(parseTitle("Trip")).toBe("Trip");
    expect(() => parseTitle(null)).toThrow(HttpError);
    expect(() => parseTitle("x".repeat(201))).toThrow(HttpError);
  });
});
