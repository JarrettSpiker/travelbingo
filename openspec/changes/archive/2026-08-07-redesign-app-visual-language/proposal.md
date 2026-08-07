## Why

The app looks unfinished: a blank background, no visual depth, and controls arranged without grouping. The causes are specific rather than a matter of taste.

- `frontend/src/theme.ts` is five lines — `createTheme({ colorSchemes: { light: true, dark: true } })`. No palette, type scale, shape, shadows, or component defaults. Every surface is stock MUI on stock white.
- There are no design tokens. The only CSS variables in the app are three card-layout knobs; borders are hardcoded `#ccc`/`#999`.
- `App.tsx` puts all five form components into bare `Stack`s with no `Paper`/`Card` wrappers, so sections are separated by whitespace alone and nothing reads as grouped.
- `CardView` caps the card at 420px and left-aligns it inside a `maxWidth="md"` container, so the app's centerpiece sits in the left third of a desktop viewport.
- `ColorSchemeForm` uses four raw `<input type="color">` elements — unstyled native controls beside MUI ones.

The app is a travel bingo generator. Nothing about its current appearance says so.

This change gives it a design system and a deliberate visual language, and moves it from MUI to Tailwind + shadcn/ui in the process. The library swap is not the point — the tokens, the surfaces, and the layout are. But shadcn components live in the repo as readable Tailwind markup rather than opaque component props, which makes them substantially easier to adjust, and it is the right moment to make that switch since nearly every UI file is being touched anyway.

## What Changes

- **A design token layer.** CSS custom properties in a new `src/index.css` become the single source of truth for colour, radius, shadow, and type, defined for light and dark. Components consume tokens; no component carries a raw hex value.
- **An explicit light/dark/system mode toggle**, persisted across sessions, applied as `data-theme` on the document root. Today dark mode follows the OS only (MUI's `colorSchemeSelector` defaults to `media`) and cannot be exercised without changing an OS setting — which also makes it untestable in the review loop.
- **A playful travel visual language**: warm terracotta and ocean-teal palette, a warm-cream page (not white) so the card reads as an object on a surface, generous radii, warm-tinted shadows plus hairline borders, and a layered page background — gradient wash, faint map-grid pattern, soft colour blots — replacing the blank field.
- **A real app shell.** A sticky header with wordmark, navigation, theme toggle, and auth, adopted by all four pages in place of four independently hand-rolled `Container` blocks.
- **The editor becomes a two-column workspace** at wide viewports: controls on the left, a sticky card preview on the right, so the card stays visible while editing. Control sections become distinct surfaces, reordered to the user's actual journey (entries first, then look-and-feel, then card details), with colour/font/emoji merged into one panel instead of three bare stacks.
- **The colour controls are rebuilt**: large swatch buttons opening a picker offering a curated palette, with the native colour input retained as the escape hatch. The existing theme presets are surfaced here as well as in the suggestions dialog.
- **Migration from MUI v9 + Emotion to Tailwind v4 + shadcn/ui**, component by component, ending with the removal of `@mui/material`, `@mui/icons-material`, `@emotion/react`, and `@emotion/styled`. Icons move to `lucide-react`.
- **The bingo card renderer is deliberately excluded.** `CardGrid.tsx` and the `.bingo-*` rules are frozen by the constraint established in `add-ai-ui-workflow`.

## Capabilities

### New Capabilities
- `app-visual-design`: A design token system as the single source of truth for the app's appearance; light and dark support with a user-selectable, persisted mode; app chrome visually distinct from card content; and contrast and visible-focus requirements for interactive controls.

### Modified Capabilities
- `card-color-scheme`: The "Customize card colors" requirement is amended so the colour controls offer a curated set of palette choices alongside free colour selection, rather than only raw colour inputs. Free choice of any colour is preserved.
- `card-suggestions`: The "Suggested theme presets" requirement is amended so themes are reachable directly from the card's customization controls, not only from within the suggestions dialog.

## Impact

- **New token layer** (`frontend/src/index.css`): Tailwind import, the light and dark token blocks, and the `@theme` mapping. Imported before `App.css` so the card's unlayered rules continue to win.
- **New app shell** (`src/components/AppShell.tsx`, `SiteHeader.tsx`, `ThemeToggle.tsx`) and a mode hook (`src/lib/colorMode.ts`, with a co-located test for the pure resolve-and-persist logic).
- **New generated component directory** (`src/components/ui/`): shadcn primitives, treated as vendored code — editable, but reviewed as such.
- **Every page and component** under `src/pages/` and `src/components/` except `CardGrid.tsx`: migrated from MUI to Tailwind, one file per commit. `App.tsx` and `SavedCardsPage.tsx` additionally get the layout rework.
- **Build config** (`vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`): the `@tailwindcss/vite` plugin and an `@/*` path alias, which the shadcn CLI requires and which does not currently exist.
- **Entry point** (`src/main.tsx`, `index.html`): the token stylesheet import, removal of `ThemeProvider`/`CssBaseline` at the end, and an inline script that applies the stored theme before first paint to avoid a flash.
- **Gallery** (`src/dev/gallery/`): a token strip entry is added, and each component's entry is reviewed as that component migrates.
- **Docs** (`frontend/DESIGN.md`): gains its visual-language half — the token table, spacing and type scales, motion rules, and the travel-motif inventory.
- **Infra comment only** (`infra/main.tf`): the CSP's `'unsafe-inline'` justification currently cites Emotion; after MUI is removed it is Radix that needs it. **No CSP value change** — `style-src 'self' 'unsafe-inline'` and `font-src 'self' data:` already cover Radix's inline positioning styles and self-hosted fonts.
- **No backend change.**

## Sequencing

**Depends on `add-ai-ui-workflow`, which must land first.** That change provides the component gallery this redesign is reviewed in, the pre-migration baselines its output is compared against, the card-renderer guard test, and the print isolation that keeps the new header and page background out of the PDF. Starting this change without those means restyling blind, which is the condition that produced the current state.

`add-ai-ui-workflow` is archived, so its gallery, baselines, card-renderer guard, and print isolation are all in place. `save-full-entry-pool` and `enhance-saved-cards-view` are archived too, so `App.tsx`, `EntryInput.tsx`, and `SavedCardsPage.tsx` are settled. **Nothing is in flight, so this change is unblocked and can start now.**

**Decision: this change runs to completion before `add-trips`.**

The earlier guidance here was to keep a restyle last in the queue, which is right when feature work is already in progress. It is the wrong call now. `add-trips` is a large UI addition — a trips listing, a trip view, invite redemption, card assignment — and it has not started. Building it first would mean authoring all of that in MUI and then immediately rewriting it here, and designing new screens against a visual language that is about to be replaced. Landing the redesign first means the trips UI is built once, in the final design system.

The cost is that feature work waits for the migration. That is accepted deliberately: the rework it avoids is larger than the delay it introduces.

The remaining open changes (`add-branch-protection`, `raise-lambda-concurrency-limit`) are infra-only and do not touch the frontend, so they can proceed in parallel.
