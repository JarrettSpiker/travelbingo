## Why

The account-free `?card=` URL was the original sharing mechanism, but the app now has saved cards and revocable share links as the primary sharing path. Maintaining two parallel sharing mechanisms — one permanent/stateless and one revocable/server-backed — doubles the surface area, complicates the Export menu, and forces every new card-state field to round-trip through a frozen URL schema forever. With the account features now canonical, the permanent URL path is being retired in favor of the single, consistent share-link flow.

## What Changes

- **BREAKING** — The `?card=` URL encode/decode mechanism is removed entirely. The `encodeCardToUrl` / `decodeCardFromUrl` functions, their tests, and the "Copy card link" UI are deleted.
- **BREAKING** — Existing `?card=` links stop decoding. A URL carrying a `?card=` param loads the app normally (the param is ignored); there is no sunset page and no error. There is no redirect or lookup table to honor old links — they are stateless capability-less URLs and will simply no-op.
- **BREAKING** — Sharing now requires an account. A signed-out user can still generate, randomize, print, and export a card as PNG, but cannot share one. This deliberately reverses the prior "fully usable signed out, including sharing" constraint.
- The `CardUrlData` type is relocated out of the deleted `cardUrl.ts` into a new `cardData.ts` (the editor still needs a typed representation of the current card).
- The AGENTS.md architectural constraints that enshrined `?card=` URL sharing as permanent and account-free are amended to reflect the new reality.
- Cross-references to "`?card=` URL" elsewhere (the `card-library` save requirement, the `card-share-links` recipient scenario) are amended so they no longer name a mechanism that no longer exists.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `card-url-sharing`: **Removed entirely.** Every requirement (export as URL, restore from URL, handle malformed data, remain available without an account) is deleted, and the capability ceases to exist.
- `card-library`: The save requirement currently says a saved card captures "the same state the `?card=` URL captures." That reference is replaced with an inline enumeration of the captured state, since the referenced mechanism is going away.
- `card-share-links`: The recipient scenario currently promises a signed-out visitor can "edit, print, and export" a shared card. "Export" there meant the `?card=` URL export, which is gone; the scenario is amended to drop URL-export and keep edit/print/PNG (PNG remains under `card-print-export`).

## Impact

- **Frontend logic** (`src/lib/cardUrl.ts`): deleted along with its co-located test. The `CardUrlData` interface moves to a new `src/lib/cardData.ts` (the editor's `currentCardData()` and `CardView` still need the type).
- **Frontend app** (`src/App.tsx`): the module-level `decodeCardFromUrl()` on load, the `handleExportUrl` handler, the `onExportUrl` prop pass-through, and the relevant imports are removed. The app must tolerate a leftover `?card=` param without error (it is simply ignored).
- **Frontend component** (`src/components/CardView.tsx`): the `onExportUrl` prop, the "Copy card link" `MenuItem`, the `handleExportUrl` handler, and the explanatory comment about the two sharing mechanisms are removed. The Export menu keeps PDF and PNG.
- **Frontend comment** (`src/lib/savedCard.ts`): the comment referencing `decodeCardFromUrl` is updated.
- **No backend or infra changes** — the backend never owned the `?card=` URL path.
- **AGENTS.md**: the "`?card=` URL sharing is permanent…" bullet is deleted, and the "fully usable signed out" architectural-constraints bullet is revised so sharing is no longer in the signed-out set.
- **Reversal of prior guarantees**: this change is a deliberate reversal of two architectural constraints and of the `card-url-sharing` spec's "remains available without an account" requirement. The breaking consequences for existing links and signed-out sharing are accepted by decision.
