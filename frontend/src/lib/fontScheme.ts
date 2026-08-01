export interface FontScheme {
  titleFont: string;
  cellFont: string;
}

export interface FontOption {
  label: string;
  value: string;
  group: "System" | "Google Fonts";
}

export const SYSTEM_FONT_OPTIONS: FontOption[] = [
  { label: "Default (system)", value: "system-ui, sans-serif", group: "System" },
  { label: "Serif", value: "Georgia, 'Times New Roman', serif", group: "System" },
  { label: "Monospace", value: "'Courier New', Courier, monospace", group: "System" },
  { label: "Rounded", value: "'Comic Sans MS', 'Comic Sans', cursive", group: "System" },
  { label: "Condensed", value: "'Arial Narrow', Arial, sans-serif", group: "System" },
];

export const GOOGLE_FONT_OPTIONS: FontOption[] = [
  { label: "Poppins", value: "'Poppins', sans-serif", group: "Google Fonts" },
  { label: "Playfair Display", value: "'Playfair Display', serif", group: "Google Fonts" },
  { label: "Anton", value: "'Anton', sans-serif", group: "Google Fonts" },
  { label: "Pacifico", value: "'Pacifico', cursive", group: "Google Fonts" },
  { label: "Fredoka", value: "'Fredoka', sans-serif", group: "Google Fonts" },
];

export const FONT_OPTIONS: FontOption[] = [...SYSTEM_FONT_OPTIONS, ...GOOGLE_FONT_OPTIONS];

export const DEFAULT_FONT_SCHEME: FontScheme = {
  titleFont: FONT_OPTIONS[0].value,
  cellFont: FONT_OPTIONS[0].value,
};
