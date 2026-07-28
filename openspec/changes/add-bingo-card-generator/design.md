## Context

Greenfield project. No existing frontend, backend, or infrastructure. React + TypeScript frontend, Terraform-provisioned AWS infrastructure. The app is stateless — no database, no accounts, no persisted cards, and — for this phase — no backend at all. A Go backend is planned for a future change once persistence/sharing is needed; this design deliberately keeps generation logic framework-agnostic (plain TS, no React-specific state coupling) so it can be ported to Go later with minimal rework.

## Goals / Non-Goals

**Goals:**
- A single card, live: it reflects the current entry pool at all times, with no minimum entry count gating whether a card is shown.
- Keep the card-building logic (blank-fill + randomize) as a pure, isolated TS module so it's unit-testable and portable to a future Go service.
- An explicit, repeatable randomize action lets the user reshuffle the card's arrangement (and, when the pool exceeds 24 entries, which entries are shown) as many times as they want.
- Produce a printable card layout that works via standard browser print-to-PDF, sized for US Letter / A4, with cells that stay a fixed size regardless of content length.
- Keep AWS infrastructure minimal and cheap to run — static hosting only, no compute, no persistent state.

**Non-Goals:**
- No user accounts, sessions, or server-side saved card history — the URL export is the only persistence mechanism, and it's entirely client-encoded.
- No backend/API in this phase — card building, rendering, and URL encoding all happen client-side.
- No server-generated PDF/image files in this iteration — printing is done client-side via the browser's print dialog.
- No URL shortening — exported URLs contain the full encoded card state and can be long for large entry pools.
- No non-5x5 grid sizes for the initial version (can be revisited later).
- No multi-card batches — only a single card is ever shown or printed at a time.

## Decisions

- **Card building runs entirely client-side, in the frontend.** A network round-trip adds latency, CORS, and infra (Lambda/API Gateway) for zero benefit when the computation is trivial and has no persistence or shared state involved. The logic is a pure TypeScript module (inputs: entry list + free-space text → output: one card) decoupled from React components, so it stays unit-testable and can be ported to Go later if needed.
- **Single card, always live.** There is no discrete "generate" action gating whether a card is shown. The card is derived from the current entry pool and free-space text on every change: entries fill the 24 non-free cells in insertion order, and any remaining cells render blank when the pool has fewer than 24 entries. This directly satisfies "update the card as entries are added" without the user needing to click anything.
- **Randomize is a separate, explicit, repeatable action.** Clicking "Randomize card" shuffles the entry pool (Fisher-Yates) and, if the pool has more than 24 entries, takes a random 24-entry subset; it also shuffles which grid positions are blank when the pool has fewer than 24. This replaces the live (insertion-order) arrangement until the next entries/free-space change, at which point the view resets to the live arrangement. The user can click Randomize as many times as they like. Keeping this separate from the live-update path avoids the card visibly scrambling on every keystroke while still giving on-demand randomization.
- **Mandatory entries are guaranteed inclusion, and only change selection behavior when the pool exceeds 24 entries.** Each entry carries a `mandatory` flag (default off). Selection is unaffected when the pool fits within 24 entries — mandatory or not, everything shows, exactly as before. Once the pool exceeds 24, entry selection changes from "first/random 24 of the whole pool" to "all mandatory entries (up to 24), then fill remaining slots from the rest of the pool" — applied identically in both the live view (mandatory entries keep their relative order, non-mandatory entries fill what's left in order) and Randomize (both groups are shuffled independently, then combined and the final 24 slot positions are shuffled together, same as before). If more than 24 entries are marked mandatory, only the first/a random 24 of them (live/randomize respectively) can be shown — the "guaranteed" promise necessarily caps at grid capacity, and the UI surfaces this rather than failing silently.
- **Grid: standard 5x5 with a free center space.** This is the most recognizable bingo format; the center cell always shows the free-space content regardless of how many entries exist.
- **Card title:** the user provides a single title for the card; it's a plain live-bound field (not a submitted "generation" input) rendered as a heading on the card and on print.
- **Free space content is user-specified.** The user provides the text shown in the center cell (e.g. "FREE", a logo name, an emoji); it defaults to `"FREE"` if left blank. This is separate from the pool entries — it does not count toward or get drawn from the 24 entry slots.
- **Cells are a fixed size; text scales down instead of growing the cell.** The grid is laid out as a fixed-size square (`grid-template-rows`/`grid-template-columns` both `repeat(5, 1fr)` inside a fixed-aspect-ratio container) so cell dimensions never depend on content. Font size per cell is scaled down in steps based on the text's character length, so long entries shrink to fit rather than resizing the grid.
- **Printing via browser, not server-rendered PDF.** A dedicated print stylesheet (`@media print`) renders the card at a fixed size on one page, with the title, free-space text, and color scheme included. This avoids adding any PDF-generation dependency for the initial version.
- **`print-color-adjust: exact` (and the `-webkit-` prefix) is set on the card and cells for print.** Browsers default to omitting background colors when printing (an ink-saving default, controlled by a "background graphics" toggle in the print dialog that's usually off). Without this CSS override, a customized color scheme would silently disappear on the printed/exported page even though it appears correctly on screen. Setting `exact` forces the chosen colors to print regardless of that toggle.
- **Color scheme is a pure rendering concern, decoupled from card building.** Background/cell/text colors don't affect which entries land where, so they're plain UI state applied at render time (inline styles), not part of the card-building input. Randomization independently picks a random hex value for each of the three colors — no contrast/accessibility algorithm in this iteration, since the cards are for casual printed use, not on-screen accessibility-critical reading.
- **Card state is exported by encoding it into a URL query parameter, not a shortened/opaque token.** The current card's exact 24-slot arrangement (entries and blanks, in their displayed positions — not just the raw entry pool, so an already-randomized card reproduces exactly), title, free-space text, and color scheme are JSON-serialized and base64url-encoded into a single `card` query parameter. Loading the app with that parameter present reconstructs the identical state on first render, before any live-update logic runs. No backend, no database, no short-link service — "saving" a card is just keeping the URL.
- **Infrastructure: S3 + CloudFront for the static frontend only.** No compute, no API Gateway, no Lambda — the entire app ships as static assets. Terraform provisions just the bucket, CloudFront distribution, and supporting DNS/ACM as needed.

## Risks / Trade-offs

- [Editing/adding an entry resets any active randomized arrangement back to the live (insertion-order) view] → Accepted trade-off; keeps the mental model simple (live view vs. an explicit randomize action) instead of trying to preserve a stale shuffle across pool edits.
- [Browser print output can vary slightly across browsers/printers] → Use a conservative, well-tested print stylesheet (fixed page size, minimal reliance on browser-specific CSS) and note this as a known limitation rather than solving pixel-perfect parity now.
- [Client-side-only card-building logic may need porting to Go if a future backend takes over generation for consistency with persisted cards] → Mitigated by keeping the module pure and dependency-free now, minimizing rework later.
- [Fully random color picks can produce low-contrast/hard-to-read combinations (e.g. similar background and text color)] → Accepted trade-off; the user can re-randomize or manually adjust any of the three colors if a combination is illegible.
- [Character-length-based font scaling is a heuristic, not true text measurement — some edge cases (e.g. many wide uppercase characters) may still look slightly cramped] → Accepted trade-off for this iteration; steps are conservative enough to keep text legible for typical entries.
- [Large entry pools produce long exported URLs, which some sharing channels truncate or mishandle] → Accepted trade-off for this iteration; no URL shortening service. Could be revisited if it becomes a real pain point.
- [The exported URL contains the card's content in plain (base64-encoded, not encrypted) form, readable by anyone who has the link] → Acceptable since there's no sensitive data involved (bingo entries) and no accounts/auth to protect.
- [If more than 24 entries are marked mandatory, not all of them can appear — physically impossible given a 24-slot grid] → The entry list shows a warning when mandatory count exceeds capacity; excess mandatory entries are treated like any other overflow (dropped for that build/randomize) rather than the app erroring.
- [The URL export encodes only the 24 entries currently shown on the card, not the full pool or mandatory flags — reopening an exported URL when the original pool exceeded 24 entries loses the "extra" entries and everyone's mandatory status] → Pre-existing limitation of the URL export (it was already scoped to "the card," not "the pool"); mandatory status follows the same scoping rather than expanding the export's contract. Could be revisited together if full-pool export is wanted later.

## Open Questions

- Whether to support a "no free space" mode (25 entries, no center free cell) in this iteration or defer it.
- When persistence is added later: whether card-building logic moves to the Go backend at that point, or stays client-side with the backend only handling storage.
