import { CalendarDays, TrendingUp } from "lucide-react";
import type { Brand, BrandMeta } from "../types";
import { officeCopy } from "./copy";
import meta from "./meta.json";
import suggestedCells from "./suggestedCells.json";
import suggestedThemes from "./suggestedThemes.json";

/**
 * Office Lingo Bingo — satirical bingo for corporate meetings.
 *
 * The CSS half of this brand is `theme.css` and `motifs.css` in this directory,
 * reached through the `#brand-theme` / `#brand-motifs` aliases rather than
 * imported from here; see `../index.ts` for why the two halves are selected by
 * different mechanisms.
 */
export const officeBrand: Brand = {
  id: "office",
  name: "Office Lingo Bingo",
  storagePrefix: "officelingobingo",
  /** The hockey-stick growth chart. See `BRAND.md`. */
  MarkIcon: TrendingUp,
  /** A calendar, for the thing that recurs whether or not anyone wants it. */
  TripIcon: CalendarDays,
  copy: officeCopy,
  suggestions: { cells: suggestedCells, themes: suggestedThemes },
  meta: meta satisfies BrandMeta,
};
