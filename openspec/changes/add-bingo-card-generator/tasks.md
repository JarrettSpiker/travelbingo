## 1. Repo scaffolding

- [x] 1.1 Create `frontend/` and `infra/` directories at the repo root
- [x] 1.2 Scaffold the React + TypeScript app in `frontend/` (Vite recommended)
- [x] 1.3 Add root-level README describing the project and how to run the frontend locally

## 2. Card building logic (client-side)

- [x] 2.1 Define types for entry pool, title, free-space content, and a single card (with entry/free/blank cell kinds)
- [x] 2.2 Implement a "live" card builder: fills the 24 non-free cells from the pool in order, leaving trailing cells blank when the pool has fewer than 24 entries
- [x] 2.3 Implement the free-center-space rule (defaulting to "FREE"), independent of entry count
- [x] 2.4 Implement a "randomize" card builder: shuffles the pool (and takes a random 24-entry subset when the pool exceeds 24), and randomizes which grid positions are blank
- [x] 2.5 Write this as a pure, framework-independent TS module (no React coupling) so it's easy to port to Go later
- [x] 2.6 Add unit tests for the live builder, the randomize builder, and blank-cell handling (including empty pool and pool > 24)

## 3. Frontend: entry input

- [x] 3.1 Build the entry list UI (add/remove text entries)
- [x] 3.2 Add duplicate-entry feedback on add and on edit (no minimum-count validation/gating)
- [x] 3.3 Add a title input field for the card (live-bound, no submit step)
- [x] 3.4 Add a free-space content input field (optional, defaults to "FREE", live-bound)
- [x] 3.5 Add inline editing of an existing entry's text, rejecting edits that duplicate another entry in the pool

## 4. Frontend: card display and printing

- [x] 4.1 Build the card grid component (5x5, free center space, blank-cell styling) with fixed-size cells and content-length-based font scaling
- [x] 4.2 Render the card live, updating automatically as entries/title/free-space change, with the card title as a heading (when provided)
- [x] 4.3 Add a "Randomize card" control that reshuffles the arrangement on demand, repeatable without limit
- [x] 4.4 Add a print-optimized stylesheet (`@media print`) so the card renders correctly sized on one page
- [x] 4.5 Add a print/export control that triggers the browser print dialog

## 5. Frontend: color scheme

- [x] 5.1 Define a pure TS module for color scheme defaults and random color generation (no React coupling)
- [x] 5.2 Add color controls (background, cell, text) to the form, defaulting to the standard scheme
- [x] 5.3 Add a "Randomize colors" control that sets all three colors at once and updates the controls to reflect them
- [x] 5.4 Apply the active color scheme to the rendered card (screen and print)
- [x] 5.5 Add unit tests for the default scheme and random color generation
- [x] 5.6 Fix background/cell colors not appearing in print/PDF output (`print-color-adjust: exact`)

## 6. Frontend: export/import card via URL

- [x] 6.1 Add slot-level helpers (`cardToSlots`/`cardFromSlots`) so the exact displayed arrangement (including scattered blanks from a randomized card) can be serialized and reconstructed
- [x] 6.2 Implement a pure TS module to encode card state (slots, title, free-space text, color scheme) into a URL query parameter and decode it back, tolerating missing/malformed data
- [x] 6.3 Add an "Export URL" control: generates the URL, copies it to the clipboard when available, and displays it in a selectable field as a fallback
- [x] 6.4 On initial load, detect card data in the URL and restore the exact state (entries, title, free-space text, colors, and displayed arrangement) instead of starting empty
- [x] 6.5 Add unit tests for the encode/decode round trip, including blanks and malformed input

## 7. Frontend: mandatory entries

- [x] 7.1 Change the entry pool's data shape to carry a `mandatory` flag per entry (not just plain text), threaded through the card-building module, entry input UI, and app state
- [x] 7.2 Implement pool-selection logic: unaffected when the pool fits within 24 entries; when it exceeds 24, mandatory entries are included first (up to capacity) and remaining slots are filled from the rest of the pool — applied in both the live builder and the randomize builder
- [x] 7.3 Add a control per entry to mark/unmark it mandatory, reflected in the entry list
- [x] 7.4 Show a warning in the entry list when more than 24 entries are marked mandatory
- [x] 7.5 Add unit tests: mandatory has no effect within capacity; guaranteed inclusion over capacity for both the live and randomize builders; graceful behavior when mandatory count exceeds 24

## 8. Infrastructure (Terraform on AWS)

- [x] 8.1 Define S3 bucket + CloudFront distribution for static frontend hosting
- [x] 8.2 Define supporting DNS/ACM certificate resources as needed
- [x] 8.3 Wire up Terraform variables/outputs for environment-specific config
- [x] 8.4 Document the `terraform plan`/`apply` workflow in `infra/README.md`

## 9. Integration and verification

- [x] 9.1 End-to-end manual test: add entries below and above 24, confirm live blank-cell behavior, set a title and free-space text, randomize repeatedly, print/export, confirm layout on a real page size
- [x] 9.2 Verify long entry text shrinks to fit instead of resizing the cell
- [x] 9.3 Verify exported URL, opened fresh, reproduces the exact card (including a randomized arrangement), title, free-space text, and colors
- [x] 9.4 Verify printed/exported output retains the customized background and cell colors
- [x] 9.5 Verify mandatory entries are guaranteed to appear with a pool > 24, on both the live view and after randomizing
- [ ] 9.6 Deploy the built frontend to the Terraform-provisioned S3/CloudFront and verify it loads correctly
