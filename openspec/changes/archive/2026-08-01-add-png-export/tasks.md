## 1. Dependency and component plumbing

- [x] 1.1 Add `html-to-image` to `frontend/package.json` dependencies and run `npm install`
- [x] 1.2 Change `CardGrid` to forward a ref to its root `.bingo-card` node so the PNG exporter can capture it

## 2. Pure filename helper

- [x] 2.1 Add a pure filename helper in `src/lib/` (e.g. `imageExport.ts`): given the card title, return a sanitized, length-capped, `.png` filename; fall back to a default (e.g. `bingo-card.png`) when the title is empty
- [x] 2.2 Add a co-located Vitest test covering: titled card (sanitized, `.png`), empty/whitespace title (default name), unsafe characters stripped, and long title length-capped

## 3. Export menu and PNG export wiring

- [x] 3.1 In `CardView`, replace the "Export URL" and "Print / Save as PDF" buttons with a single "Export" button that opens an MUI `Menu` (Export URL / PDF / PNG), closing the menu on selection
- [x] 3.2 Wire the Export URL item to the existing `exportedUrl` text-field + clipboard flow, and the PDF item to the existing `document.fonts.ready.then(() => window.print())` behavior
- [x] 3.3 Add a PNG export handler: await `document.fonts.ready`, call `toPng(cardNode, { pixelRatio: 2 })`, derive the filename via the `src/lib/` helper, and trigger a download via a programmatic `<a download>` click
- [x] 3.4 Handle PNG export failure by surfacing a short message that the PNG could not be generated (do not fail silently)

## 4. Tests and verification

- [x] 4.1 Run `npm run lint`, `npm test`, and `npm run build` from `frontend/`; confirm all pass
- [x] 4.2 Manually verify: each menu item works (URL field appears, print dialog opens, PNG downloads), the PNG reflects the title/colors/fonts, long cell text stays fixed-size, and the no-title case uses the default filename
