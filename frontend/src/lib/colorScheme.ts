export interface ColorScheme {
  backgroundColor: string;
  cellColor: string;
  textColor: string;
  titleColor: string;
}

export const DEFAULT_COLOR_SCHEME: ColorScheme = {
  backgroundColor: "#ffffff",
  cellColor: "#ffffff",
  textColor: "#1a1a1a",
  titleColor: "#1a1a1a",
};

function randomHexColor(rng: () => number): string {
  const value = Math.floor(rng() * 0x1000000);
  return `#${value.toString(16).padStart(6, "0")}`;
}

/** The four colours a card carries, as a value the UI can iterate over. */
export type ColorRole = keyof ColorScheme;

/**
 * Neutrals every role wants and no theme reliably supplies — white paper, near
 * black ink, and the greys between.
 */
const NEUTRALS = ["#ffffff", "#f7f7f5", "#cccccc", "#8a8a8a", "#404040", "#1a1a1a"];

/**
 * The curated colours offered for one role.
 *
 * Derived from the suggested themes rather than authored separately, so the
 * repo has one source of curated colour instead of two that drift. Callers pass
 * the schemes in — this file must not depend on `suggestions.ts`, which depends
 * on it.
 *
 * Theme colours come first because they are the interesting ones; the neutrals
 * are the fallback anyone reaches for.
 */
export function curatedColorsFor(role: ColorRole, schemes: ColorScheme[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const color of [...schemes.map((scheme) => scheme[role]), ...NEUTRALS]) {
    const normalized = color.trim().toLowerCase();
    if (normalized === "" || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

export function randomColorScheme(rng: () => number = Math.random): ColorScheme {
  return {
    backgroundColor: randomHexColor(rng),
    cellColor: randomHexColor(rng),
    textColor: randomHexColor(rng),
    titleColor: randomHexColor(rng),
  };
}
