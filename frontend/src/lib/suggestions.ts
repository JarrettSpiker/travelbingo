import { brand } from "../brand";
import type { BingoEntry } from "./bingo";
import type { ColorScheme } from "./colorScheme";
import { MAX_EMOJIS, type EmojiScheme } from "./emojiScheme";
import type { FontScheme } from "./fontScheme";

export interface SuggestedCategory {
  id: string;
  label: string;
  cells: string[];
}

export interface SuggestedTheme {
  id: string;
  label: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
}

export interface AppendCellsResult {
  entries: BingoEntry[];
  added: string[];
  skipped: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizeCategory(raw: unknown): SuggestedCategory | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const label = typeof raw.label === "string" ? raw.label : id;
  const cells = asStringArray(raw.cells).map((c) => c.trim()).filter((c) => c !== "");
  return cells.length > 0 ? { id, label, cells } : null;
}

function normalizeColorScheme(raw: unknown): ColorScheme | null {
  if (!isRecord(raw)) return null;
  const { backgroundColor, cellColor, textColor, titleColor } = raw;
  if (
    typeof backgroundColor !== "string" ||
    typeof cellColor !== "string" ||
    typeof textColor !== "string" ||
    typeof titleColor !== "string"
  ) {
    return null;
  }
  return { backgroundColor, cellColor, textColor, titleColor };
}

function normalizeFontScheme(raw: unknown): FontScheme | null {
  if (!isRecord(raw)) return null;
  const { titleFont, cellFont } = raw;
  if (typeof titleFont !== "string" || typeof cellFont !== "string") return null;
  return { titleFont, cellFont };
}

function normalizeEmojiScheme(raw: unknown): EmojiScheme | null {
  if (!isRecord(raw)) return null;
  return { emojis: asStringArray(raw.emojis).slice(0, MAX_EMOJIS) };
}

function normalizeTheme(raw: unknown): SuggestedTheme | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  const label = typeof raw.label === "string" ? raw.label : id;
  const colorScheme = normalizeColorScheme(raw.colorScheme);
  const fontScheme = normalizeFontScheme(raw.fontScheme);
  const emojiScheme = normalizeEmojiScheme(raw.emojiScheme);
  if (!colorScheme || !fontScheme || !emojiScheme) return null;
  return { id, label, colorScheme, fontScheme, emojiScheme };
}

export function normalizeCategories(raw: unknown): SuggestedCategory[] {
  if (!isRecord(raw) || !Array.isArray(raw.categories)) return [];
  return raw.categories
    .map(normalizeCategory)
    .filter((category): category is SuggestedCategory => category !== null);
}

export function normalizeThemes(raw: unknown): SuggestedTheme[] {
  if (!isRecord(raw) || !Array.isArray(raw.themes)) return [];
  return raw.themes
    .map(normalizeTheme)
    .filter((theme): theme is SuggestedTheme => theme !== null);
}

/*
  Suggestion content is brand-supplied — the categories a road-trip audience
  wants are not the ones a meeting audience wants. Only the *content* varies:
  the normalizer above, `appendCells` below, and everything the dialog does with
  the result are identical in every brand.

  Still bundled at build time, not fetched: the suggestions dialog works with no
  network, which is the signed-out invariant this app is built around.
*/
export const SUGGESTED_CATEGORIES: SuggestedCategory[] = normalizeCategories(
  brand.suggestions.cells,
);
export const SUGGESTED_THEMES: SuggestedTheme[] = normalizeThemes(brand.suggestions.themes);

/**
 * Appends suggested cells to an existing entry pool as enabled, non-mandatory
 * entries, skipping any that duplicate an existing entry (case-insensitive,
 * trimmed). Also de-dupes within the incoming batch. Returns the next pool
 * plus the cells that were added and the ones skipped.
 */
export function appendCells(existing: BingoEntry[], cells: string[]): AppendCellsResult {
  const seen = new Set(existing.map((entry) => entry.text.trim().toLowerCase()));
  const added: string[] = [];
  const skipped: string[] = [];
  for (const cell of cells) {
    const trimmed = cell.trim();
    if (trimmed === "") continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      skipped.push(trimmed);
      continue;
    }
    seen.add(key);
    added.push(trimmed);
  }
  const entries: BingoEntry[] = [
    ...existing,
    ...added.map((text) => ({ text, mandatory: false, enabled: true })),
  ];
  return { entries, added, skipped };
}
