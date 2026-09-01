import { Compass, MapPin } from "lucide-react";
import type { Brand, BrandMeta } from "../types";
import { travelCopy } from "./copy";
import meta from "./meta.json";
import suggestedCells from "./suggestedCells.json";
import suggestedThemes from "./suggestedThemes.json";

/**
 * Travel Bingo — bingo for the road, the airport, and the back seat.
 *
 * The CSS half of this brand is `theme.css` and `motifs.css` in this directory,
 * reached through the `#brand-theme` / `#brand-motifs` aliases rather than
 * imported from here; see `../index.ts` for why the two halves are selected by
 * different mechanisms.
 */
export const travelBrand: Brand = {
  id: "travel",
  name: "Travel Bingo",
  storagePrefix: "travelbingo",
  /** A luggage tag. See `BRAND.md`. */
  MarkIcon: MapPin,
  /** A compass rose — wayfinding, for the thing you travel with people on. */
  TripIcon: Compass,
  copy: travelCopy,
  suggestions: { cells: suggestedCells, themes: suggestedThemes },
  meta: meta satisfies BrandMeta,
};
