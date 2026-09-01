import type { Brand, BrandId } from "./types";
import { officeBrand } from "./office";
import { travelBrand } from "./travel";

/**
 * Every brand, keyed by id.
 *
 * **Imported only by tests.** This file references every brand's module, which
 * is exactly what `../index.ts` must not do — importing it from application
 * code would put every brand in the bundle and defeat the whole seam. Nothing
 * under `src/` outside a `*.test.ts` may import it; `check-bundle.mjs` catches
 * it after the fact by finding the other brand's name in `dist/`.
 *
 * `satisfies` is what makes this exhaustive: a `BrandId` with no entry here is
 * a compile error, so the guards in `brand.contract.test.ts` always have the
 * full set to compare the selection against.
 */
export const BRAND_REGISTRY = {
  travel: travelBrand,
  office: officeBrand,
} satisfies Record<BrandId, Brand>;
