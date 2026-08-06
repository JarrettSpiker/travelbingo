## Why

The app's UI has drifted into looking blocky and unfinished — a blank background, no visual depth, and controls arranged without grouping. The proximate causes are concrete (`src/theme.ts` is five lines of stock MUI; no design tokens exist; form sections sit in bare `Stack`s with no surfaces), and a follow-on change will fix them.

But the reason it drifted is process, and fixing the pixels without fixing the process only buys one release. Today there is **no way for anyone — human or agent — to see the UI they just changed**: no component gallery, no screenshots, no component tests, and no design document. `AGENTS.md`'s entire styling guidance is one bullet ("follow the patterns in `App.tsx`"), and the definition of done is lint + test + build with no visual step at all. Every UI change is made blind and verified by hope.

This change builds the feedback loop and the guardrails **first**, deliberately before any restyling. It has no dependency on the visual redesign, and it retains its value if that redesign is deferred. Because it lands while the app still looks the way it does today, its gallery also captures the "before" state that the redesign will be measured against.

It also closes a latent defect that the redesign would otherwise trip over: print isolation is currently **opt-out** (`@media print { .no-print { display: none } }`), so any new chrome that forgets the class silently leaks into the exported PDF. Adding a header and a page background — exactly what the redesign does — is the scenario that breaks it.

## What Changes

- A **dev-only component gallery** at `/ui` renders every component in its interesting states on one page, so a single screenshot covers the whole UI surface. It is registered behind `import.meta.env.DEV` via a dynamic import so the entire chunk is dropped from production builds.
- The gallery is kept honest by a **coverage test**: a Vitest check using `import.meta.glob` asserts every file in `src/components/` appears in the gallery registry, so adding a component without a gallery entry fails CI. The gallery imports the real components — never copies.
- **Print isolation is inverted** from opt-out to opt-in: everything is hidden by default and only the card is made visible, so app chrome can never leak into printed output regardless of what is added around it.
- A **card-renderer guard test** locks down the one part of the app that must not be restyled. `CardGrid.tsx` and the `.bingo-*` rules in `App.css` render user data and feed four outputs (screen, print/PDF, PNG export, saved-card thumbnails). The test reads both files as text and fails if the card grows non-allowlisted classes or acquires design tokens.
- A new **`frontend/DESIGN.md`** documents the visual-iteration runbook: how to drive the running app to review a change, the capture matrix, the local test-user shortcut, and the export regression checklist.
- **`AGENTS.md`** gains a real Styling section, the frozen-card-renderer constraint, and — most importantly — a **Visual QA step in the definition of done**, which currently has none.
- `vite.config.ts` pins the dev server to port 5173 with `strictPort`, so a stray process can no longer shift it to 5174 and silently break the registered Cognito redirect URI mid-review.

## Capabilities

### New Capabilities
- `ui-development-workflow`: A dev-only component gallery covering every component and excluded from production builds; a maintained design-language document; a visual-QA step in the definition of done; and guardrails protecting the card renderer's exported output from incidental restyling.

### Modified Capabilities
- `card-print-export`: Two requirements are added. Printed output SHALL contain only the card regardless of what app chrome surrounds it (previously implied by the `.no-print` convention but never stated, and not robust to new chrome). Print and PNG output SHALL be independent of the app's light/dark mode, since the card is a document whose exported bytes must not vary with the viewer's OS preference.

## Impact

- **New dev-only route** (`src/dev/GalleryPage.tsx`, `src/dev/gallery/*`, `src/dev/gallery/registry.ts`): the gallery and its registry. Excluded from the production bundle; verified mechanically by a build-output check for a gallery-only sentinel string.
- **Routing** (`src/routes.tsx`): one `import.meta.env.DEV`-guarded lazy route. No change to the four existing routes.
- **Card stylesheet** (`src/App.css`): the `@media print` block is rewritten to visibility-based opt-in isolation. `.no-print` is retained as a harmless alias during the transition. The `.bingo-*` rules themselves are untouched.
- **New tests** (`src/dev/gallery/coverage.test.ts`, `src/components/cardGrid.guard.test.ts`): both pure, text/glob-based, no DOM — consistent with the repo's existing all-logic test suite.
- **Dev config** (`vite.config.ts`): `server.port` + `strictPort`.
- **Docs** (`frontend/DESIGN.md` new, `AGENTS.md` modified): the design language's process half lands here; its token and aesthetic sections are added by the follow-on redesign.
- **No backend, infra, or CSP change.** No production runtime code changes: the gallery is dev-only, and the print rewrite affects only `@media print`.

## Sequencing

This change is **a prerequisite for `redesign-app-visual-language`** (Tailwind + shadcn migration, design tokens, layout rework) and should land first. The gallery is what makes that change reviewable, and the print-isolation inversion is what keeps its new chrome out of the PDF.

`save-full-entry-pool` has since been archived, so the editor files it touched (`App.tsx`, `EntryInput.tsx`) are settled. This change touches neither anyway — its only edit to existing frontend code is one guarded route in `routes.tsx`.

Of the changes still open, none touch the frontend: `add-branch-protection` and `raise-lambda-concurrency-limit` are infra, and `enhance-saved-cards-view` is all but complete. So there is no live conflict surface.
