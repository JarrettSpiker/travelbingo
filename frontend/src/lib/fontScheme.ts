export interface FontScheme {
  titleFont: string;
  cellFont: string;
}

export const FONT_OPTIONS = [
  { label: "Default (system)", value: "system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif" },
  { label: "Monospace", value: "'Courier New', Courier, monospace" },
  { label: "Rounded", value: "'Comic Sans MS', 'Comic Sans', cursive" },
  { label: "Condensed", value: "'Arial Narrow', Arial, sans-serif" },
] as const;

export const DEFAULT_FONT_SCHEME: FontScheme = {
  titleFont: FONT_OPTIONS[0].value,
  cellFont: FONT_OPTIONS[0].value,
};
