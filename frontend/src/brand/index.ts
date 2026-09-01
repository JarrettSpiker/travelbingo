import type { Brand } from "./types";
import { officeBrand } from "./office";
import { travelBrand } from "./travel";

/**
 * The active brand — the one thing application code imports to reach anything
 * brand-varying.
 *
 * **The selection below is a ternary, and that is not a style choice.**
 *
 * An object literal (`{ travel, office }[id]`) references every arm, so the
 * bundler must keep every brand's module — copy, suggestion data, metadata,
 * icon — and both brands ship. A ternary against a compile-time literal folds
 * to one branch and the other module is dropped. Both halves of that were
 * verified by spike against this toolchain, and `scripts/check-bundle.mjs`
 * fails the build if a second brand's name ever reappears in `dist/`.
 *
 * `import.meta.env.VITE_BRAND` is substituted by `define` in `vite.config.ts`,
 * which is also where the value is validated against the closed list — a build
 * with no brand, or an unknown one, fails there rather than quietly falling
 * back to whichever arm is last.
 *
 * The exhaustiveness a `Record<BrandId, Brand>` would have given is recovered
 * without its cost: `registry.ts` holds that map and is imported **only by
 * tests**, and `brand.contract.test.ts` asserts every brand in it is reachable
 * from the selection below.
 */
export const brand: Brand =
  import.meta.env.VITE_BRAND === "office" ? officeBrand : travelBrand;

export type { Brand, BrandId } from "./types";
