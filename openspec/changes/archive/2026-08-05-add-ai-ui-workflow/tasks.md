## 1. Dev server determinism

- [x] 1.1 Add `server.port: 5173` and `server.strictPort: true` to `frontend/vite.config.ts`, keeping the existing `/api` proxy untouched
- [x] 1.2 Verify: with a process already bound to 5173, Vite exits with "Port 5173 is already in use" instead of silently serving on 5174

## 2. Baseline capture (before any change to rendered output)

> Captured with `frontend/scripts/capture.mjs` (headless Chrome over the DevTools
> Protocol, Node built-ins only) — added during this change after the Claude in
> Chrome extension turned out to be unavailable. Artifacts are review inputs, not
> committed files.

- [x] 2.1 Run the dev server and build a representative card: a title, a mix of short and long entries (including one ~40 characters), a non-default color scheme, a non-default font scheme, and an emoji scheme
- [x] 2.2 Save a reference PDF of that card (Letter), and a second one (A4)
- [x] 2.3 PNG export baseline captured by `scripts/export-check.mjs`, which drives the real Export ▸ PNG flow on the gallery's populated card (840x934, 115 KB, filename derived from the title). Only the browser download is intercepted, so `html-to-image` and the `document.fonts.ready` gate are genuinely exercised
- [x] 2.4 Thumbnail baseline captured by the same script: **41 KB of the 98 KB cap, 58% headroom**. Rather than signing in and saving (which would create a dev Cognito user and write real rows to the deployed dev table and thumbnail bucket), it imports `lib/cardThumbnail.ts` over Vite's dev module server and runs the real `generateCardThumbnail` against the real card node — same signal, zero side effects on shared dev infrastructure
- [x] 2.5 Capture reference screenshots of all four routes plus `/ui` in light and dark, at 390px and 1440px wide
- [x] 2.6 Store the baselines outside the repo (they are review inputs for the follow-on redesign, not committed artifacts)

## 3. Print isolation: opt-out to opt-in

> Landed and verified against the section 2 baselines. The implementation
> changed during verification: `visibility: hidden` plus an absolutely positioned
> card made the printed card ~8% larger (it escaped its container's geometry), so
> it was replaced with a `:has()` selector that hides everything *except* the
> card, its contents, and its ancestors. Keeping the ancestors preserves normal
> flow, so the printed geometry is unchanged.

- [x] 3.1 Rewrite the `@media print` block in `frontend/src/App.css` to opt-in isolation: `body *:not(:has(.bingo-card)):not(.bingo-card):not(.bingo-card *) { display: none }`, plus `body { background: none !important }`
- [x] 3.2 Keep `.no-print { display: none !important }` inside the print block — now doing double duty as the `:has()` fallback, so a browser without `:has()` degrades to exactly the previous behaviour rather than printing the whole page
- [x] 3.3 Leave every `.bingo-*` rule and the print-specific card sizing overrides unchanged
- [x] 3.4 Verified by printing: exactly one page, card only, on both Letter and A4. `/ui` (deliberately unmarked chrome) drops from 10 printed pages to 4 — one per card instance — proving the isolation is structural rather than dependent on `.no-print`
- [x] 3.5 Printed result is **pixel-identical** to the baseline when composited over white (0 of 484,704 pixels differ). The only delta is that the PDF no longer paints a redundant white background layer, which is invisible on paper
- [x] 3.6 Cross-browser check: print verified on the deployed dev site in Firefox as well as Chrome, covering both `:has()` implementations. Safari deliberately not checked

## 4. Card-renderer guard test

- [x] 4.1 Add `frontend/src/components/cardGrid.guard.test.ts` reading `CardGrid.tsx` and `App.css` as text via `node:fs`
- [x] 4.2 Assert every `className` value in `CardGrid.tsx` is drawn from the allowlist (`bingo-card`, `bingo-card-titlebar`, `bingo-card-title`, `bingo-card-body`, `bingo-edge-emoji`, `bingo-grid`, `bingo-cell`, `bingo-cell-free`, `bingo-cell-blank`, `bingo-cell-entry`)
- [x] 4.3 Assert `App.css` still defines `.bingo-card`, `.bingo-grid`, `.bingo-cell`, `.bingo-cell-free`, `.bingo-cell-blank`, and an `@media print` block
- [x] 4.4 Assert neither file contains `var(--color-` or `oklch(`, with a comment explaining that `html-to-image` serializes computed styles so modern color syntaxes are an export-regression risk
- [x] 4.5 Confirm the test fails when a non-allowlisted class and a token reference are each temporarily introduced, then revert
- [x] 4.6 Added a guard that the `className` regex still sees every `className=` in the file, so switching to a helper like `cn()` fails loudly instead of silently asserting nothing
- [x] 4.7 Add `"node"` to `types` in `frontend/tsconfig.app.json` — the tests read source files as text, and `tsc -b` typechecks `src` including tests

## 5. Component gallery

- [x] 5.1 Create `frontend/src/dev/gallery/registry.tsx` mapping each component to its gallery entry
- [x] 5.2 Create `frontend/src/dev/GalleryPage.tsx` rendering the registry, exporting `GALLERY_SENTINEL` for the build check in 7.3
- [x] 5.3 Add gallery entries for the leaf forms: `CardDetailsForm`, `ColorSchemeForm`, `FontSchemeForm`, `EmojiSchemeForm`, `AuthMenu`
- [x] 5.4 Add gallery entries for the dialogs, behind a trigger button — MUI dialogs portal to the body and cannot render inline
- [x] 5.5 Add a gallery entry for `EntryInput` covering empty, five entries (one disabled, one mandatory), over capacity, and mandatory overflow
- [x] 5.6 Add a gallery entry for `CardView`
- [x] 5.7 Add a read-only, explicitly labelled entry rendering the bingo card itself, so the baseline captures it
- [x] 5.8 Register the route in `frontend/src/routes.tsx` at `/ui`, guarded by `import.meta.env.DEV` and loaded through a dynamic `import()` so Rollup can drop the chunk
- [x] 5.9 Split the module three ways — `registry.tsx` (constants), `samples.tsx` (components), `sampleData.ts` (fixtures) — so each file's exports are one kind and the fast-refresh lint rule stays quiet
- [x] 5.10 Visually verified `/ui`: all 10 sections render, 4 card instances, 102 cells, both dialog triggers present, in light and dark at 390px and 1440px
- [ ] 5.11 **Deferred:** a saved-cards grid entry (loading / empty / error / populated / failed-thumbnail). `SavedCardsPage` is a page that fetches on mount, so rendering its states in the gallery needs API stubbing, which needs the DOM test stack this change deliberately does not add. Revisit if that stack is ever adopted; until then those states are reviewed on `/cards` directly.

## 6. Gallery coverage test

- [x] 6.1 Add `frontend/src/dev/gallery/coverage.test.ts` using `import.meta.glob` over `src/components/*.tsx` for filenames without evaluating the modules
- [x] 6.2 Assert every discovered component has a registry entry, with a failure message naming the missing component and pointing at the registry
- [x] 6.3 Exclude co-located `.test.tsx` files from the glob
- [x] 6.4 Assert the glob matched something, so a moved directory fails loudly rather than passing vacuously
- [x] 6.5 Confirm the test fails for a temporarily added dummy component, then remove it

## 7. Verification

- [x] 7.1 `npm run lint && npm test && npm run build` pass in `frontend/` (171 tests)
- [x] 7.2 `npm run lint && npm test && npm run build` pass in `backend/` (77 tests, untouched)
- [x] 7.3 Add `frontend/scripts/check-bundle.mjs` and chain it into `npm run build`, so the sentinel grep runs on every build and CI enforces it — the spec requires the exclusion be "verified mechanically rather than assumed", and a one-off manual grep did not satisfy that
- [x] 7.3a Confirm the check fails when the dev guard is defeated (gallery chunk emitted), then revert
- [x] 7.4 Signed-out invariant: the capture script counts `/api/` requests on load from a throwaway Chrome profile — zero on `/`
- [x] 7.5 Full export regression passes: PDF (Letter and A4) pixel-identical to the baselines, PNG export and thumbnail both captured and correct via `npm run export-check`
- [x] 7.6 PDF is **pixel-identical** in light and dark (0 of 484,704 pixels differ), via emulated `prefers-color-scheme`

## 7b. Capture and export tooling (added during the change)

> The plan assumed the review loop would run through the Claude in Chrome
> extension. It is unavailable here, so the loop was built on headless Chrome
> over the DevTools Protocol instead — Node built-ins only, no Playwright, no
> Puppeteer, no extension. This is what makes the loop reproducible for anyone.

- [x] 7b.1 Add `frontend/scripts/capture.mjs`: launches headless Chrome on an ephemeral debugging port, captures the light/dark × 390px/1440px matrix, and optionally prints to PDF at Letter and A4
- [x] 7b.2 Emulate `prefers-color-scheme` via `Emulation.setEmulatedMedia`, so dark mode is reviewable without changing the OS appearance — the gap that previously made dark mode untestable
- [x] 7b.3 Count `/api/` requests on load via `Network.requestWillBeSent`, checking the signed-out invariant on every capture
- [x] 7b.4 Wait for Chrome to exit before deleting its profile (deleting it during shutdown races and throws `ENOTEMPTY`)
- [x] 7b.5 Add the `capture` npm script and git-ignore `.captures/`
- [x] 7b.6 Document the script in `DESIGN.md` and `AGENTS.md`, and use it in the Visual QA step of the definition of done
- [x] 7b.7 Extract the CDP client to `scripts/lib/cdp.mjs`, shared by both scripts rather than duplicated
- [x] 7b.8 Add `scripts/export-check.mjs` and the `export-check` npm script: real Export ▸ PNG flow plus the real thumbnail generator, with the cap headroom reported
- [x] 7b.9 Rewrite the DESIGN.md export regression checklist around the two commands, keeping the keyboard pass explicitly manual

## 8. Documentation

- [x] 8.1 Create `frontend/DESIGN.md` with the visual-review runbook: starting the dev server on 5173, the `/ui` gallery URL, the `scripts/dev-user.sh` shortcut and the `travelbingo.session` localStorage key it writes, and the light/dark × 390px/1440px capture matrix
- [x] 8.2 Add the export regression checklist to `DESIGN.md` as the canonical copy referenced by the definition of done
- [x] 8.3 Document the frozen-card-renderer rule in `DESIGN.md`, including why `#ccc`/`#999` in `App.css` are deliberate and must not be made theme-aware
- [x] 8.4 Document in `DESIGN.md` that `App.css` is deliberately unlayered CSS, which is what keeps the card immune to any future layered stylesheet
- [x] 8.5 `AGENTS.md`: add `src/dev/` and `DESIGN.md` to the repository layout, with the dev-only note
- [x] 8.6 `AGENTS.md`: add the frozen card renderer and the unlayered-`App.css` firewall to the architectural constraints
- [x] 8.7 `AGENTS.md`: add a Visual QA step to the definition of done
- [x] 8.8 `AGENTS.md`: point the existing styling bullet at `DESIGN.md`, and require a gallery entry for new components
- [x] 8.9 `AGENTS.md`: note the 5173/`strictPort` requirement in Gotchas
- [x] 8.10 Document in `DESIGN.md` that dark mode currently follows the OS (MUI `colorSchemeSelector` defaults to `media`, no in-app toggle), so a browser-driving agent cannot check it until the redesign adds one
