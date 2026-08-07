import { describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { MAX_DISPLAY_NAME_LENGTH, parseDisplayName } from "./profilePayload.ts";

function rejects(input: unknown): number {
  try {
    parseDisplayName(input);
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("parseDisplayName", () => {
  it("accepts a bounded string, trimmed", () => {
    expect(parseDisplayName("Jordan")).toBe("Jordan");
  });

  it("trims leading and trailing whitespace", () => {
    expect(parseDisplayName("  Jordan  ")).toBe("Jordan");
  });

  it("clears a whitespace-only value to null", () => {
    expect(parseDisplayName("   ")).toBeNull();
  });

  it("clears an empty string to null", () => {
    expect(parseDisplayName("")).toBeNull();
  });

  it("rejects a non-string", () => {
    expect(rejects(42)).toBe(400);
    expect(rejects(null)).toBe(400);
    expect(rejects(undefined)).toBe(400);
    expect(rejects({ name: "Jordan" })).toBe(400);
  });

  it("rejects a value over the length bound", () => {
    expect(rejects("x".repeat(MAX_DISPLAY_NAME_LENGTH + 1))).toBe(400);
  });

  it("accepts exactly the length bound", () => {
    expect(parseDisplayName("x".repeat(MAX_DISPLAY_NAME_LENGTH))).toBe(
      "x".repeat(MAX_DISPLAY_NAME_LENGTH),
    );
  });

  it("round-trips a valid value", () => {
    const parsed = parseDisplayName("  Road Tripper ");
    expect(parsed).toBe("Road Tripper");
  });
});
