import { describe, expect, it } from "vitest";
import { SUGGESTED_THEMES } from "./suggestions";
import { curatedColorsFor, type ColorScheme } from "./colorScheme";

const scheme = (overrides: Partial<ColorScheme> = {}): ColorScheme => ({
  backgroundColor: "#111111",
  cellColor: "#222222",
  textColor: "#333333",
  titleColor: "#444444",
  ...overrides,
});

describe("curatedColorsFor", () => {
  it("takes the requested role from each scheme, in order, before the neutrals", () => {
    const result = curatedColorsFor("titleColor", [
      scheme({ titleColor: "#aa0000" }),
      scheme({ titleColor: "#00bb00" }),
    ]);
    expect(result.slice(0, 2)).toEqual(["#aa0000", "#00bb00"]);
    expect(result).toContain("#ffffff");
  });

  it("de-duplicates case-insensitively, so the same colour is offered once", () => {
    const result = curatedColorsFor("backgroundColor", [
      scheme({ backgroundColor: "#ABCDEF" }),
      scheme({ backgroundColor: "#abcdef" }),
    ]);
    expect(result.filter((color) => color === "#abcdef")).toHaveLength(1);
  });

  it("normalises to lower case so swatches compare equal to an input's value", () => {
    // <input type="color"> always reports lower case, and the selected swatch
    // is found by string comparison against it.
    const result = curatedColorsFor("cellColor", [scheme({ cellColor: "#FFEEDD" })]);
    expect(result[0]).toBe("#ffeedd");
  });

  it("skips empty entries rather than offering a blank swatch", () => {
    const result = curatedColorsFor("textColor", [scheme({ textColor: "  " })]);
    expect(result.every((color) => color !== "")).toBe(true);
  });

  it("still offers the neutrals when there are no themes at all", () => {
    expect(curatedColorsFor("cellColor", []).length).toBeGreaterThan(0);
  });

  it("offers a usable set for every role from the real suggested themes", () => {
    // Guards the derivation end to end: if suggestedThemes.json is emptied or
    // its shape drifts, the picker silently degrades to neutrals only.
    const schemes = SUGGESTED_THEMES.map((theme) => theme.colorScheme);
    expect(schemes.length).toBeGreaterThan(0);
    for (const role of [
      "backgroundColor",
      "cellColor",
      "textColor",
      "titleColor",
    ] as const) {
      const colors = curatedColorsFor(role, schemes);
      expect(colors.length, `${role} has too few curated colours`).toBeGreaterThan(6);
      expect(colors.every((color) => /^#[0-9a-f]{6}$/.test(color))).toBe(true);
    }
  });
});
