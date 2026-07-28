import { describe, expect, it } from "vitest";
import { DEFAULT_COLOR_SCHEME, randomColorScheme } from "./colorScheme";

const HEX_COLOR = /^#[0-9a-f]{6}$/;

describe("DEFAULT_COLOR_SCHEME", () => {
  it("provides a valid hex color for each field", () => {
    expect(DEFAULT_COLOR_SCHEME.backgroundColor).toMatch(HEX_COLOR);
    expect(DEFAULT_COLOR_SCHEME.cellColor).toMatch(HEX_COLOR);
    expect(DEFAULT_COLOR_SCHEME.textColor).toMatch(HEX_COLOR);
    expect(DEFAULT_COLOR_SCHEME.titleColor).toMatch(HEX_COLOR);
  });
});

describe("randomColorScheme", () => {
  it("generates valid hex colors for all four fields", () => {
    const scheme = randomColorScheme();
    expect(scheme.backgroundColor).toMatch(HEX_COLOR);
    expect(scheme.cellColor).toMatch(HEX_COLOR);
    expect(scheme.textColor).toMatch(HEX_COLOR);
    expect(scheme.titleColor).toMatch(HEX_COLOR);
  });

  it("is deterministic given a deterministic rng, and varies each of the four colors independently", () => {
    let call = 0;
    const values = [0, 0.34, 0.67, 0.999999];
    const rng = () => values[call++ % values.length];

    const scheme = randomColorScheme(rng);
    expect(scheme.backgroundColor).toBe("#000000");
    expect(scheme.cellColor).toBe("#570a3d");
    expect(scheme.textColor).toBe("#ab851e");
    expect(scheme.titleColor).toBe("#ffffef");
  });
});
