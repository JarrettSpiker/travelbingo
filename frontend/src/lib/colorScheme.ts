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

export function randomColorScheme(rng: () => number = Math.random): ColorScheme {
  return {
    backgroundColor: randomHexColor(rng),
    cellColor: randomHexColor(rng),
    textColor: randomHexColor(rng),
    titleColor: randomHexColor(rng),
  };
}
