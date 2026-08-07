import { describe, expect, it } from "vitest";
import {
  nextColorMode,
  parseColorMode,
  resolveColorMode,
  type ColorMode,
} from "./colorMode";

describe("parseColorMode", () => {
  it("accepts each of the three modes", () => {
    expect(parseColorMode("system")).toBe("system");
    expect(parseColorMode("light")).toBe("light");
    expect(parseColorMode("dark")).toBe("dark");
  });

  it("falls back to system for anything unrecognised", () => {
    // Covers an empty store, a corrupted value, and a mode written by an older
    // build — all of which should behave like the pre-toggle app.
    expect(parseColorMode(null)).toBe("system");
    expect(parseColorMode(undefined)).toBe("system");
    expect(parseColorMode("")).toBe("system");
    expect(parseColorMode("DARK")).toBe("system");
    expect(parseColorMode("auto")).toBe("system");
    expect(parseColorMode(1)).toBe("system");
    expect(parseColorMode({ mode: "dark" })).toBe("system");
  });
});

describe("resolveColorMode", () => {
  it("passes an explicit choice through, whatever the OS says", () => {
    expect(resolveColorMode("light", true)).toBe("light");
    expect(resolveColorMode("light", false)).toBe("light");
    expect(resolveColorMode("dark", false)).toBe("dark");
    expect(resolveColorMode("dark", true)).toBe("dark");
  });

  it("defers to the OS for system", () => {
    expect(resolveColorMode("system", true)).toBe("dark");
    expect(resolveColorMode("system", false)).toBe("light");
  });

  it("only ever yields a literal, since data-theme cannot hold system", () => {
    for (const mode of ["system", "light", "dark"] as ColorMode[]) {
      for (const prefersDark of [true, false]) {
        expect(["light", "dark"]).toContain(resolveColorMode(mode, prefersDark));
      }
    }
  });
});

describe("nextColorMode", () => {
  it("cycles light to dark to system and back", () => {
    expect(nextColorMode("light")).toBe("dark");
    expect(nextColorMode("dark")).toBe("system");
    expect(nextColorMode("system")).toBe("light");
  });

  it("returns to the starting mode after three steps, from any start", () => {
    for (const mode of ["system", "light", "dark"] as ColorMode[]) {
      expect(nextColorMode(nextColorMode(nextColorMode(mode)))).toBe(mode);
    }
  });

  it("reaches every mode from every mode", () => {
    for (const mode of ["system", "light", "dark"] as ColorMode[]) {
      const seen = new Set([mode, nextColorMode(mode), nextColorMode(nextColorMode(mode))]);
      expect(seen.size).toBe(3);
    }
  });
});
