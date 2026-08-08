import { describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { parseTripCardSnapshot, parseTripInput, parseTripUpdate } from "./tripPayload.ts";

const validSnapshot = {
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

function rejectsSnapshot(input: unknown): number {
  try {
    parseTripCardSnapshot(input);
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

function rejectsInput(input: unknown): number {
  try {
    parseTripInput(input);
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("parseTripInput", () => {
  it("accepts a well-formed create payload", () => {
    const parsed = parseTripInput({ title: "Summer Road Trip", mode: "cooperative" });
    expect(parsed.title).toBe("Summer Road Trip");
    expect(parsed.mode).toBe("cooperative");
    expect(parsed.startDate).toBeUndefined();
    expect(parsed.endDate).toBeUndefined();
  });

  it("accepts a payload with a date range", () => {
    const parsed = parseTripInput({
      title: "Trip",
      mode: "competitive",
      startDate: "2026-08-01",
      endDate: "2026-08-09",
    });
    expect(parsed.startDate).toBe("2026-08-01");
    expect(parsed.endDate).toBe("2026-08-09");
  });

  it("rejects an empty or whitespace-only title", () => {
    expect(rejectsInput({ title: "", mode: "cooperative" })).toBe(400);
    expect(rejectsInput({ title: "   ", mode: "cooperative" })).toBe(400);
  });

  it("rejects an oversized title", () => {
    expect(rejectsInput({ title: "x".repeat(201), mode: "cooperative" })).toBe(400);
  });

  it("rejects an unsupported play mode", () => {
    expect(rejectsInput({ title: "Trip", mode: "solo" })).toBe(400);
    expect(rejectsInput({ title: "Trip" })).toBe(400);
  });

  it("rejects malformed dates", () => {
    expect(rejectsInput({ title: "Trip", mode: "cooperative", startDate: "Aug 1" })).toBe(400);
    expect(rejectsInput({ title: "Trip", mode: "cooperative", startDate: "2026/08/01" })).toBe(400);
    expect(rejectsInput({ title: "Trip", mode: "cooperative", endDate: "2026-13-40" })).toBe(400);
  });

  it("rejects an end date that precedes the start date", () => {
    expect(
      rejectsInput({ title: "Trip", mode: "cooperative", startDate: "2026-08-09", endDate: "2026-08-01" }),
    ).toBe(400);
  });

  it("accepts a single date without the other", () => {
    expect(parseTripInput({ title: "Trip", mode: "cooperative", startDate: "2026-08-01" }).startDate).toBe(
      "2026-08-01",
    );
  });

  it("rejects a non-object payload", () => {
    expect(rejectsInput(null)).toBe(400);
    expect(rejectsInput("trip")).toBe(400);
    expect(rejectsInput([])).toBe(400);
  });
});

describe("parseTripUpdate", () => {
  it("accepts a title and dates, ignoring mode", () => {
    const parsed = parseTripUpdate({ title: "Renamed", startDate: "2026-08-01", endDate: "2026-08-02" });
    expect(parsed.title).toBe("Renamed");
    expect(parsed.startDate).toBe("2026-08-01");
  });

  it("rejects an empty title", () => {
    expect(() => parseTripUpdate({ title: "" })).toThrow(HttpError);
  });

  it("rejects out-of-order dates", () => {
    expect(() => parseTripUpdate({ title: "x", startDate: "2026-08-02", endDate: "2026-08-01" })).toThrow(
      HttpError,
    );
  });
});

describe("parseTripCardSnapshot", () => {
  it("round-trips a valid snapshot, normalizing empty slots to null", () => {
    const parsed = parseTripCardSnapshot(validSnapshot);
    expect(parsed.slots).toEqual(["Airport", null, null, "Dog"]);
    expect(parsed.title).toBe("Road trip");
    expect(parsed.emojiScheme.emojis).toEqual(["🚗", "🌲"]);
  });

  it("ignores an editable entries pool — a snapshot carries only the render subset", () => {
    // A trip card is never re-opened in the editor, so entries are not part of
    // the snapshot. Sending them must not change the stored shape.
    const parsed = parseTripCardSnapshot({ ...validSnapshot, entries: [{ text: "x", mandatory: false, enabled: true }] });
    expect((parsed as unknown as Record<string, unknown>).entries).toBeUndefined();
  });

  it("rejects when each render field is missing or malformed", () => {
    expect(rejectsSnapshot({ ...validSnapshot, slots: "nope" })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, slots: undefined })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, title: 42 })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, hasFreeSpace: "yes" })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, freeSpaceText: null })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, colorScheme: null })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, colorScheme: { ...validSnapshot.colorScheme, textColor: "red" } })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, fontScheme: { ...validSnapshot.fontScheme, titleFont: "Comic Sans" } })).toBe(400);
    expect(rejectsSnapshot({ ...validSnapshot, emojiScheme: { emojis: "nope" } })).toBe(400);
  });

  it("rejects a slot that is not a string or null", () => {
    expect(rejectsSnapshot({ ...validSnapshot, slots: [42] })).toBe(400);
  });

  it("bounds the number of slots", () => {
    const slots = Array.from({ length: 65 }, () => "x");
    expect(rejectsSnapshot({ ...validSnapshot, slots })).toBe(400);
  });

  it("rejects fonts outside the editor's options", () => {
    expect(rejectsSnapshot({ ...validSnapshot, fontScheme: { ...validSnapshot.fontScheme, cellFont: "url(evil)" } })).toBe(400);
  });

  it("bounds the number of emojis", () => {
    expect(rejectsSnapshot({ ...validSnapshot, emojiScheme: { emojis: ["1", "2", "3", "4", "5", "6"] } })).toBe(400);
  });

  it("accepts an empty card title, matching the card rule", () => {
    // A snapshot is projected from an already-validated card, whose title may
    // be empty. The snapshot re-applies the card bound, not the trip's
    // non-empty rule.
    const parsed = parseTripCardSnapshot({ ...validSnapshot, title: "" });
    expect(parsed.title).toBe("");
  });

  it("rejects a non-object snapshot", () => {
    expect(rejectsSnapshot(null)).toBe(400);
    expect(rejectsSnapshot("snapshot")).toBe(400);
    expect(rejectsSnapshot([])).toBe(400);
  });
});
