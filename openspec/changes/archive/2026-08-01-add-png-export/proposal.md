## Why

Today a card can be printed or saved as a PDF (via the browser print dialog) or shared as a URL, but there is no way to get a standalone image of it. Users want to drop a card into a chat, slide deck, or social post where a PDF or link is awkward. A PNG export gives a portable, self-contained image of the current card, entirely client-side.

## What Changes

- The separate **"Export URL"** and **"Print / Save as PDF"** buttons are replaced by a single **"Export"** control that opens a menu with three options: **Export URL**, **PDF**, and **PNG**.
- **Export URL** keeps the existing behavior: generates the share URL and surfaces it in a copyable text field (copied to the clipboard when supported).
- **PDF** keeps the existing behavior: waits for fonts to load, then opens the browser's native print dialog (which the user can also use to save as PDF).
- **PNG** is new: renders the current card (title + grid) to a downloadable PNG image that reflects the card's color scheme, font scheme, and title, at print fidelity. Cells stay a fixed size with text scaling down to fit, exactly as on screen and in print.
- The PNG is produced entirely in the browser from the already-styled card DOM; there is no server, no network call, and no persistence change.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `card-print-export`: The single print trigger becomes a shared **Export** control offering URL export, PDF (native print dialog), and PNG (image download). Adds a requirement to export the current card as a downloadable PNG image that captures the title, cells, color scheme, and fonts at print fidelity.

## Impact

- **Frontend dependency**: adds `html-to-image` (small, browser-side) to render the styled card DOM node to a PNG.
- **Frontend UI** (`src/components/CardView.tsx`): replaces the two export buttons with one "Export" button and an MUI `Menu` (Export URL / PDF / PNG); adds the PNG render-and-download handler.
- **Frontend component** (`src/components/CardGrid.tsx`): forwards a ref to its root card node so the PNG exporter can capture it.
- **Frontend logic** (`src/lib/`): adds a small, pure filename helper (title-derived, sanitized, with a fallback) with a co-located Vitest test.
- No URL schema, backend, persistence, or infrastructure changes. The `card-url-sharing` capability is not modified: its "export URL" requirement is phrased abstractly ("when the user triggers the export action") and is satisfied by the new menu item.
