> **Unblocked.** `add-ai-ui-workflow` is archived, so the gallery, the
> baselines phase 1 is gated against, the card-renderer guard, and the print
> isolation are all in place. Nothing else is in flight.
>
> This change runs to completion **before** `add-trips`, so the trips UI is
> authored once in the final design system. Review each phase with
> `npm run capture` and the `ui-review` agent as it lands.

## 1. Foundations — zero visual change

- [x] 1.1 Add `paths: { "@/*": ["./src/*"] }` to `frontend/tsconfig.json` (the solution file — the shadcn CLI reads it) and to `frontend/tsconfig.app.json` (which actually typechecks `src`). No `baseUrl`: TypeScript 6 errors on it as deprecated, and `paths` has resolved relative to the config file since 5.4. The shadcn CLI turned out not to need it
- [x] 1.2 Add the matching `resolve.alias` for `@` to `frontend/vite.config.ts`
- [x] 1.3 Install `tailwindcss@4` and `@tailwindcss/vite`; add the plugin to `vite.config.ts`. No `tailwind.config.js`, no PostCSS
- [x] 1.4 Create `frontend/src/index.css`: `@import "tailwindcss"`, the `dark` custom variant bound to `[data-theme=dark]`, the light and dark token blocks, and the `@theme inline` mapping
- [x] 1.5 Use shadcn's conventional token names verbatim, plus `--warning`, `--info`, `--paper`, `--stamp`, `--shadow-postcard`. `--sidebar-*` and `--chart-*` deliberately omitted — nothing here has a sidebar or a chart
- [x] 1.6 Import `index.css` in `main.tsx` **before** `App.css`, so the card's unlayered rules keep winning
- [x] 1.7 Add `src/lib/colorMode.ts` — pure resolve/persist logic for `system | light | dark`, with a co-located test
- [x] 1.8 ~~Add the inline script in `index.html`~~ **Not possible: the production CSP is `script-src 'self'` with no `'unsafe-inline'` and no hash, so an inline script is blocked — and blocked only in production, where CloudFront applies the CSP.** Applied instead from `main.tsx` before `createRoot`, which is sufficient while nothing outside the React tree paints from a token. Phase 2 must revisit this when the shell adopts `bg-background`: either a `prefers-color-scheme` fallback in the token layer (covers `system`, the default) or a `public/theme-init.js` loaded with `'self'` (covers every case, at one extra request)
- [x] 1.9 Set `cssVariables: { colorSchemeSelector: "data-theme" }` in `theme.ts` (MUI v9 nests it under `cssVariables`) so MUI and Tailwind read the same attribute during coexistence; resolve `system` to a literal first. MUI is also handed the same `modeStorageKey`, so the two agree on the mode as well as the attribute
- [x] 1.10 Add `components.json` and `src/lib/utils.ts` (`cn`); run `npx shadcn add button input label` as a CLI smoke test. The CLI handled the solution-style `tsconfig.json` without complaint
- [x] 1.11 Audit every generated file for `verbatimModuleSyntax` type modifiers, `erasableSyntaxOnly`, and unused locals/params — `tsc -b` clean with no edits needed. Oxlint needed one override: `react/only-export-components` is off for `src/components/ui/**`, because `allowConstantExport` does not cover a `cva()` call
- [x] 1.12 Install `lucide-react`
- [x] 1.13 Record the bundle size. Pre-migration: **JS 897.91 kB / 260.39 kB gzip, CSS 28.06 kB / 13.87 kB gzip**. After phase 1: **JS 898.50 kB / 260.73 kB gzip, CSS 48.37 kB / 18.93 kB gzip** — +5.4 kB gzip total, almost all of it Tailwind's preflight
- [x] 1.14 **Gate:** lint/test/build pass in both packages, and `/ui` plus all four routes are visually identical to the pre-migration baselines

### Phase 1 gate results

Screenshots proved byte-deterministic across runs, so the gate was a pixel
comparison rather than an eyeball. Against the pre-migration baselines, the
complete set of differences is:

- **The four native `<input type="color">` swatches** on `/`, and the eight on
  `/ui`, lose their inner bevel — Tailwind's preflight zeroes input padding, so
  the swatch fills its box. This is the control task 3.10 replaces outright.
- **12–20 pixels of corner antialiasing** on MUI `Alert` boxes, dark mode only
  (`/auth/callback`, `/s/:token`, one entry in `/ui`).
- `/cards` is pixel-identical in all four combinations. The PNG export and the
  saved-card thumbnail are bit-identical. Both PDFs are content-stream identical.

Two real regressions were found and fixed here rather than discovered later:

1. **The card title silently lost its size and weight.** `.bingo-card-title`
   declared only `margin`, so its `<h3>` was rendering at the UA stylesheet's
   1.17em/bold — and preflight's `h1..h6 { font-size: inherit }` beats a UA
   rule. The title dropped to 16px/400 on screen, in the PDF, in the PNG, and in
   the saved thumbnail at once. `App.css` being unlayered does not help where it
   declares nothing. Fixed by pinning the values the card was already rendering
   with; guarded by two new assertions in `cardGrid.guard.test.ts`.
2. **A dark-mode visitor printed a near-black page.** Print was always light by
   accident, because the dark palette lived behind
   `@media (prefers-color-scheme: dark)`, which does not match while printing.
   An attribute applies in every medium, so `color-scheme: dark` reached the
   printed page and darkened the canvas — which paints outside the cascade that
   hides everything else, and therefore never appears in a screenshot. `@media
   print` now pins `color-scheme: light !important`; guarded.

Both guards were verified to fail when violated. The first version of the
title guard did not: a `}` inside a CSS comment ended its `[^}]*` match early,
so it asserted against prose. It strips comments first now.

## 2. Shell, background, and the mode toggle

- [x] 2.1 Add `src/components/ThemeToggle.tsx` cycling light / dark / system
- [x] 2.2 Add `src/components/SiteHeader.tsx`: sticky, translucent, wordmark + nav (Editor / My cards) + theme toggle + auth. Auth arrives through an `actions` slot rather than being imported: `AuthMenu` is still MUI, and no file mixes the two systems. `AuthMenu`'s `onSaveCard` became optional so the header can carry sign-in state on every page — only the editor has a card to save
- [x] 2.3 Add `src/components/AppShell.tsx` with the three background layers — gradient wash, tiled map-grid SVG as a `data:` URL at 3–4% opacity, and two soft radial colour blots. The grid is applied as a **mask** over `--foreground` rather than drawn in a fixed colour, so one SVG serves both presentations; its opacity is lower in dark, where a near-white line on ink navy carries much further than a dark one on cream
- [x] 2.4 Apply the background to the shell, **never to `body`** — MUI's `CssBaseline` sets `body`'s background and would override it.
      **Amended:** the decorative layers are on the shell as specified, but the *base page colour* is on `<html>` in `index.css`. The shell is React, and on a cold load a dark-mode visitor would stare at a white page while a 270 kB bundle parses. `<html>` is free — MUI owns `body`, not `html` — and `theme.ts` now tells `CssBaseline` to leave `body` transparent, which avoids an `!important` fight and leaves with MUI in phase 5
- [x] 2.5 Mark all background layers `aria-hidden` and `pointer-events-none`, and confirm they do not print. They are `absolute`, not `fixed`: fixed looks slightly better while scrolling but paints only the viewport, so every full-page screenshot showed the background stopping partway down — and screenshots are the review mechanism. The shell is deliberately **not** `overflow-hidden`, which would make it a scroll container and stop the header sticking
- [x] 2.6 Adopt the shell in all four pages, replacing their hand-rolled `Container` wrappers
- [x] 2.7 Add an `.edge-perf` perforated-edge utility. **Defined and reviewable in the gallery's token strip; applied in task 3.15**, when `CardView` migrates — applying it now would mean putting a Tailwind utility on an MUI component
- [x] 2.8 Add a token-strip entry to the gallery: every colour token in both presentations, the radius ladder, the shadow, the type scale. `GalleryEntry.source` now holds a repo-relative path rather than a bare filename, so an entry can cover something that is not a component — the token strip covers `src/index.css`
- [x] 2.9 Review `/ui` and all four routes in light and dark, at 390px and 1440px

### Phase 2 review results

Also landed here, from the design decisions rather than the numbered tasks:
**`@fontsource-variable/outfit`**, one self-hosted variable file, for headings
only (`font-display`). The five existing families stay what they are — card
content the user chooses.

Fixed during review:

- **The perforated edge rendered as almost nothing.** Each mask layer was sized
  to half the panel's height, so it was transparent over the other half, and
  intersecting two of those erased the panel. Both layers now run full height
  and carry one row of holes each.
- **The wordmark and nav wrapped onto two lines at 390px.** The wordmark text is
  hidden below `sm`; the mark carries the brand there.
- **The colour blots swamped narrow viewports.** A 32rem blot covers most of a
  390px screen, which turned "a hint of warmth" into a coloured page. They are
  held back below `sm`.
- **The printed card silently grew by ~9%.** `.app { padding: 0 }` in the print
  block had never actually won — MUI's `Container` carried 24px in an Emotion
  class of equal specificity, injected later. Moving the class onto the shell's
  own `<main>` made it effective for the first time. The rule now states 24px
  explicitly, with the reason, so exported PDFs keep matching the ones users
  already have. Both PDFs are content-stream identical to the pre-migration
  baseline again; the PNG export and thumbnail are bit-identical throughout.

Bundle after phase 2: **JS 931.35 kB / 271.91 kB gzip, CSS 62.13 kB / 21.33 kB
gzip** — +11.2 kB gzip of JS and +2.4 kB of CSS on phase 1. The Outfit font is a
separate `.woff2` asset and is not in either number. Worth a look during phase 5,
when the MUI removal makes the totals meaningful again.

## 3. Primitives and leaf components — one commit each

> Hard rule: **no file mixes MUI and Tailwind.** A file migrates completely or not at all.

- [x] 3.1 `npx shadcn add` the primitive set: button, input, label, card, dialog, dropdown-menu, select, popover, switch, checkbox, tooltip, alert, separator, badge. All 14 typechecked unmodified under `verbatimModuleSyntax`/`erasableSyntaxOnly`. `Tooltip` does **not** self-provide in this version, so a `TooltipProvider` sits in `main.tsx` — the only place above both the app and the `/ui` gallery, which renders components outside the shell
- [x] 3.2 Build `ui/chip.tsx` — no shadcn equivalent; `badge` is display-only but `SuggestionsDialog` needs selectable toggles. Base it on `button` + `aria-pressed`, styled as a passport stamp
- [x] 3.3 Extend the `alert` cva variants to cover `info` and `warning` (shadcn ships only `default`/`destructive`). The two additions carry their colour in the surface, border, and icon but **not** the body text: `--warning` is a light amber and `--info` a mid blue, and neither clears the contrast bar as text on its own 10% tint. `destructive` keeps upstream's red body text, which does clear it
- [x] 3.4 Add a local `Field` wrapper standing in for `TextField`'s label + helper text + error composition. Render-prop, so the control gets the matching `id` and `aria-describedby` without the wrapper having to clone children. No react-hook-form
- [x] 3.5 Migrate `AuthMenu.tsx` — the `anchorEl` state disappears, as predicted
- [x] 3.6 Migrate `CardDetailsForm.tsx`
- [x] 3.7 Migrate `FontSchemeForm.tsx`, keeping each option's preview in its own typeface, grouped with `SelectGroup`/`SelectLabel`
- [x] 3.8 Migrate `EmojiSchemeForm.tsx`
- [x] 3.9 Map `emoji-picker-react`'s `--epr-*` custom properties onto the tokens and drive its `theme` prop from the mode hook; keep `EmojiStyle.NATIVE` (no CDN calls — the CSP forbids them). The mode comes from a new `useResolvedColorMode` hook that watches the `data-theme` attribute rather than the media query, so the picker follows the in-app toggle
- [x] 3.10 Rebuild `ColorSchemeForm.tsx`: four large swatch buttons opening a popover with a curated palette plus the native colour input as the escape hatch
- [x] 3.11 Surface the `suggestedThemes.json` presets in the colour form as preset chips (see the `card-color-scheme` and `card-suggestions` deltas). **Open question resolved: the curated palette is derived from the themes, not authored fresh** — `curatedColorsFor(role, schemes)` in `lib/colorScheme.ts`, pure and tested, so there is one source of curated colour in the repo rather than two that drift
- [x] 3.12 Migrate `ShareLinkDialog.tsx`
- [x] 3.13 Migrate `SuggestionsDialog.tsx`, using the new chip
- [x] 3.14 Migrate `EntryInput.tsx`, collapsing the two labelled switches per row into a checkbox for Active and a pin toggle for Mandatory, with the icon buttons on hover
- [x] 3.15 Migrate `CardView.tsx` — **chrome only**; `CardGrid` is frozen. Replace the disabled-MenuItem-in-a-Box tooltip with an enabled "Sign in to share" item. Also carries the deferred task 2.7: the card preview panel is the one surface with `edge-perf`
- [x] 3.16 Swap icons to lucide. Done as part of each migration. `GridView`/`Share`/`MoreVert` live in `SavedCardsPage`, which is phase 4
- [x] 3.17 Replace all four `CircularProgress` uses with `Loader2` + `animate-spin`. **Delivered in phase 4**, because all four live in `routes.tsx`, `SavedCardsPage`, `SharedCardPage`, and `AuthCallbackPage` — touching only the spinner would have left those files mixing both systems. They share `ui/spinner.tsx`, which carries `role="status"` and an accessible name; a bare spinning icon announces nothing
- [x] 3.18 Review each migrated component in the gallery as it lands, in both presentations

### Phase 3 review results

`src/components/` is now entirely MUI-free. The five files that still import MUI
are exactly the phase 4 and 5 targets: `App.tsx`, the three pages, `routes.tsx`,
plus `main.tsx`/`theme.ts`/`GalleryPage.tsx`.

Fixed during review:

- **The printed card halved.** The new card preview panel is `inline-block` so
  the perforated edge hugs the card, but the print rule sizes the card with
  `width: 100%`, and a percentage against a shrink-to-fit parent resolves to the
  card's own content width. The panel is `print:block`, along with resets for its
  padding, mask, and shadow — it is an ancestor of `.bingo-card`, so the print
  isolation deliberately keeps it.
- **`npm run export-check` broke, and was right to.** It drove the Export menu
  with `element.click()`, which MUI honoured and Radix does not — Radix opens on
  `pointerdown` and selects on `pointerup`. It now dispatches real mouse events
  through CDP, which is both a fix and a better test.
- **Colour swatches stretched into banners.** An equal-fractions grid made each
  swatch ~400px wide at a wide viewport. Fixed width instead.
- **Dead pin controls showed on exactly the rows with nothing to offer.** The
  button base carries `disabled:opacity-50`, which beat the hover-reveal
  `opacity-0`, so an inactive entry's disabled pin was the only one visible. An
  inactive, unpinned entry now renders no pin at all; a pinned-but-inactive one
  keeps it, because that state is worth seeing.

Print output and both exports remain content-identical to the pre-migration
baseline. Bundle after phase 3: **JS 1,008.80 kB / 296.47 kB gzip, CSS 84.29 kB /
24.77 kB gzip** — both libraries are now fully present, which is the peak. Phase
5 is where this comes back down.

## 4. Pages and layout

- [x] 4.1 Migrate `SavedCardsPage.tsx` to shadcn card + dropdown-menu + CSS grid. The per-card `DropdownMenu` trigger removed the `{cardId, anchor}` state entirely — each menu already knows which card it belongs to
- [x] 4.2 Fix the duplicated click target there — a `CardActionArea` and a `role="button"` div both call `handleOpen`; replace with one real `<button>` with a focus ring. Also deletes a hand-rolled Enter/Space key handler that `<button>` provides for free. The menu trigger is a sibling, never a child, so opening a card and opening its menu can never both fire
- [x] 4.3 Migrate `SharedCardPage.tsx` and `AuthCallbackPage.tsx`
- [x] 4.4 Migrate the `routes.tsx` loading state
- [x] 4.5 Rework `App.tsx` into a two-column workspace at `lg+`: scrolling controls left, sticky card preview right; single column below `lg` with the preview sticky at top. Widen from `md` to `max-w-6xl`.
      **Amended below `lg`:** the preview is first but **not** sticky. The card plus its buttons is ~500px; sticking that to the top of an 844px phone viewport leaves under half the screen for the controls it is supposed to help you use. Being first still means it is on screen when you arrive and returns with a short scroll. A collapsed mini-preview would satisfy both, and is a new component rather than a layout change — worth considering later
- [x] 4.6 Reorder control sections to the user's journey — entries, then look-and-feel, then card details — each as its own surface with a header and icon. New `components/Panel.tsx`. The five form components dropped their own headings, since the panel owns them and every section would otherwise be titled twice; `EntryInput` also lost its `onOpenSuggestions` prop, because the button belongs in the panel header and the dialog is the editor's concern
- [x] 4.7 Merge colour, font, and emoji into one "Look & feel" panel with three sub-sections or a tab strip. Sub-sections, separated by a hairline: a tab strip hides two-thirds of the choices behind a click, and these three are usually adjusted together
- [x] 4.8 Delete `.no-print` now that opt-in print isolation has settled. The `:has()` fallback it doubled as goes with it — that is deliberate, and the comment in `App.css` now says so
- [x] 4.9 Run the full export regression from `DESIGN.md` before committing — this is the phase most likely to break print

### Phase 4 review results

- **The editor lost its `<h1>`.** The rework dropped "Bingo Card Generator",
  which was right visually — the header already names the app — but left the
  page with no top-level heading at all. It is back as `sr-only`, along with one
  for `/auth/callback`, which never had one.
- Two stale comments corrected while here: `App.css` still described the
  `visibility` + absolute-positioning approach that was abandoned for printing
  the card ~8% larger, and the gallery samples still claimed `samples.tsx` was
  MUI and that the perforated edge was unapplied.

**Not verified:** the signed-in saved-cards grid — thumbnails, rename, the
dropdown, and the single click target — cannot be reached without a real dev
session, and `SavedCardsPage` has no gallery entry (deferred from
`add-ai-ui-workflow`, which wanted API stubbing first). Only the signed-out and
accounts-disabled states were reviewed. This is the one part of phase 4 that
needs a human pass on the dev deploy.

Print output and both exports remain content-identical to the pre-migration
baseline. Bundle after phase 4: **JS 868.49 kB / 252.64 kB gzip, CSS 85.73 kB /
25.07 kB gzip** — already **below** the pre-migration JS baseline of 260.39 kB
gzip, because no page imports an MUI component any more even though the package
is still installed for `ThemeProvider`/`CssBaseline`.

## 5. Remove MUI

- [x] 5.1 Delete `src/theme.ts`; remove `ThemeProvider` and `CssBaseline` from `main.tsx`. `GalleryPage.tsx` migrated here too — dev-only, but it imported MUI, so nothing could be uninstalled while it stood
- [x] 5.2 Verify `emoji-picker-react` does not depend on Emotion, then uninstall `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`. Confirmed: its only dependency is `flairup`. Emotion was MUI's alone
- [x] 5.3 Delete the dead assets `src/assets/hero.png`, `react.svg`, `vite.svg` — the whole directory, unreferenced by `src/` or `index.html`
- [x] 5.4 Update the CSP comment at `infra/main.tf:112` — `'unsafe-inline'` is now required by Radix, not Emotion. **The CSP value itself does not change.** The comment also now records why `script-src` staying free of `'unsafe-inline'` is load-bearing rather than incidental: it is what rules out the pre-paint inline theme script
- [x] 5.5 Confirm `dist/` contains no `@mui` reference; record the bundle size delta against task 1.13

### Phase 5 results

| | JS (raw / gzip) | CSS (raw / gzip) |
| --- | --- | --- |
| Pre-migration | 897.91 kB / 260.39 kB | 28.06 kB / 13.87 kB |
| After phase 5 | 781.21 kB / 222.72 kB | 85.90 kB / 25.18 kB |
| Delta | **−37.67 kB gzip** | **+11.31 kB gzip** |

Net **−26.4 kB gzip**. `dist/` greps clean for `@mui`, `@emotion`, and
`emotion-`. Runtime dependencies are now React, React Router, Radix, lucide,
`emoji-picker-react`, `html-to-image`, the fonts, and the three cva/clsx/merge
helpers.

**Removing MUI changed two exported artifacts, and only one of them was
visible to the print check.** `CssBaseline` had been applying its `body1`
typography to `<body>` and font smoothing to `<html>`, and the card inherited
both without ever referencing them:

- `letter-spacing: 0.00938em` re-laid out every string on the card. This showed
  up in the PDF's glyph advances **and** in 2.7% of the exported PNG's pixels.
- `-webkit-font-smoothing: antialiased` / `-moz-osx-font-smoothing: grayscale`
  changed how every glyph rasterised without moving anything. The PDF carries
  vector text, so it was **completely unaffected** — the PNG and the saved
  thumbnail were not, at 1.8% of pixels on every line of text. A print-only
  regression check would have shipped this.

Both are now declared on `.bingo-card`, scoped to the card: the app's own text
is left on the browser's default smoothing, which is the better default, while
the card keeps MUI's because users already hold copies of it. All four
artifacts — Letter PDF, A4 PDF, PNG, thumbnail — are byte-identical to the
pre-migration baseline again.

`cardGrid.guard.test.ts` gained an assertion that `.bingo-card` declares its own
`letter-spacing` and `-webkit-font-smoothing`, verified to fail when either is
removed. That is the second and third property this class of bug has taken; the
guard now states the rule rather than the instances.

## 6. Polish

- [x] 6.1 Spacing rhythm across all screens against the scale in `DESIGN.md`. Audited mechanically; six layout-level uses were off-scale (`gap-5`, `gap-0.5`, `p-5`, two `gap-1.5`) and were snapped. The scale gained one clarification rather than a fudge: half-steps are allowed **inside a single control**, where optical padding rarely lands on a 4px grid, and nowhere else
- [x] 6.2 Verify contrast for primary, destructive, and muted foregrounds in both presentations. Measured, not eyeballed: 18 pairings × 2 presentations, resolved through a canvas because Chrome reports computed colours in `oklch()` and reading those as RGB gives confident nonsense. **Four real failures, all fixed** — `--primary-foreground` on `--primary` (3.79), `--accent-foreground` on `--accent` (3.63), and `--destructive` as text on a dark panel (3.30) and on the dark page (3.66). `--primary` and `--stamp` were darkened, dark `--destructive` lifted well past its light value. All 36 now pass
- [x] 6.3 Confirm every interactive control has a visible focus ring. Tabbed with real key events so `:focus-visible` actually matches — 70 controls across `/`, `/cards`, and `/ui`, none missing an indicator
- [x] 6.4 Confirm `prefers-reduced-motion` suppresses transitions. Implemented as one global block in `index.css` rather than `motion-reduce:` on each component — a rule every future component must remember is a rule that will be forgotten. Verified under emulation: all 28 transitioning elements drop from 0.15s to 0.00001s
- [x] 6.5 Review every route at 390px. No horizontal overflow at 320px or 390px on any of the five routes; the only element extending past the viewport is the background blot, correctly clipped by its own wrapper
- [x] 6.6 Confirm surfaces remain distinguishable in dark mode, where shadows all but vanish and the hairline border carries structure

### Phase 6 review results

Two defects found by looking that no contrast table or lint rule would have
caught:

- **Every `ghost` and `outline` button, and every menu item, filled solid teal
  on hover.** `--accent` is shadcn's hover/active surface by convention — every
  such component is `hover:bg-accent` — and it had been given the palette's
  ocean teal. The teal moved to its own `--ocean` token, used by name in the two
  places that actually want a brand colour (the background blot, the success
  icon), and `--accent` became the quiet surface shadcn expects. This is the
  cost of using a third-party component vocabulary: the names carry meanings.
- **The suggestions dialog ran off both ends of a 390px screen with no way to
  scroll.** Upstream's `DialogContent` caps width but not height. Capped locally
  at `calc(100dvh-2rem)` with `overflow-y-auto`; `dvh` so a mobile browser's
  collapsing toolbar cannot hide the last row.

## 7. Documentation

- [x] 7.1 Add the visual-language half to `frontend/DESIGN.md`: token table (name × light × dark × when to use), surface/radius/shadow rules, spacing scale, type scale, lucide sizing, motion
- [x] 7.2 Document the travel-motif inventory and the **one-motif-per-surface** rule — five devices, each named with the single surface it belongs to
- [x] 7.3 Add a component-choice table: which shadcn component for which job, including the two traps (no react-hook-form; a disabled control receives no pointer events, so a tooltip on one never fires)
- [x] 7.4 Update `AGENTS.md`: styling is Tailwind + shadcn; tokens only, never raw hex in components; `src/components/ui/` is generated code reviewed as vendored, and local edits carry a comment saying they diverge from the registry. Also records that `--accent` is shadcn's hover surface, not a brand colour
- [x] 7.5 Update the `AGENTS.md` gotcha about `'unsafe-inline'` now being required by Radix rather than Emotion — done in `infra/main.tf` itself, which also now records why `script-src` staying clean is load-bearing rather than incidental
- [x] 7.6 Update `DESIGN.md`'s dark-mode note — the in-app toggle now exists, so dark mode is reviewable without changing an OS setting

## 8. Verification

- [x] 8.1 `npm run lint && npm test && npm run build` pass in both `frontend/` and `backend/` — 189 and 77 tests
- [x] 8.2 Signed-out invariant: verified with `.env.local` actually moved aside, not assumed. Zero XHR/fetch to `/api/` on load, no sign-in control, no "My cards" nav, and the editor, randomize, print, and PNG all still work
- [x] 8.3 Full export regression: PDF (Letter and A4), PNG, thumbnail
- [x] 8.4 PDF is equivalent in light and dark presentation — content-stream identical, and neither carries a page-fill rectangle
- [x] 8.5 `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components src/pages` returns nothing outside the card renderer
- [x] 8.6 `dist/` contains no gallery sentinel and no `@mui` reference
- [x] 8.7 Keyboard pass: focus rings everywhere; Radix dialogs trap focus, restore on close, close on Escape. **Restoration was broken and is now fixed** — see below
- [x] 8.8 Confirm `document.fonts.ready` still resolves before print and PNG — it gates both (`CardView.tsx`, `cardThumbnail.ts`)
- [ ] 8.9 **Post-deploy CSP check.** On the dev deploy, with the console open, exercise a Select, DropdownMenu, Popover, Dialog, and the emoji picker. Expect zero violations. **Cannot be done locally — CloudFront applies the policy and dev never sees it.** This is the one task that has to run after a deploy

### Phase 8 findings

**Dialogs did not restore focus.** Radix returns focus to its `DialogTrigger`'s
ref; every dialog here is controlled by a parent that owns the open state, with
the button somewhere else entirely, so there is no trigger and that ref is null.
Focus fell to `<body>` — a keyboard user who opened and closed a dialog lost
their place and had to tab from the top of the page. `Dialog` now captures the
active element during the render that opens it and `DialogContent` restores it
via `onCloseAutoFocus`.

The capture cannot be an effect: Radix moves focus from an effect inside
`DialogContent`, and child effects run before a parent's, so an effect would
always be too late. It also cannot live in `DialogContent`, whose body runs on
every render of its parent including while closed — the first attempt did, and
recorded whatever was focused at first paint.

**The tooling lied twice before it told the truth**, which is worth recording:
the contrast pass first reported every pairing failing at ~1.0 because Chrome
returns computed colours in `oklch()` and the parser read those components as
RGB; and the keyboard pass first reported no focus trap because the dialog had
never opened — `Input.dispatchKeyEvent` with Enter does not synthesise a click
on a focused button. Both needed a positive control before their output meant
anything.

### One-time export change, accepted

The repo owner confirmed that byte-matching earlier PNG exports is not a
requirement. The two declarations added in phase 5 purely to preserve it —
`letter-spacing` and `-webkit-font-smoothing`, both inherited from MUI's
`CssBaseline` and neither cosmetically meaningful — were removed rather than
carried forward forever. The card's text is now very slightly narrower and
rendered with the browser's default smoothing, a one-time change of ~2.7% of
pixels on every line of text.

`.bingo-card-title`'s pinned `font-size`/`font-weight` **stay**: those are not
about byte-matching. Without them the title renders at body size and weight and
stops reading as a title, which is a real defect. The guard test keeps that one.

The `.app { padding: 24px }` print gutter also stays as-is. It affects the PDF
rather than the PNG, and it is a defensible printed-page decision either way —
flagged here as a remaining choice rather than changed on an inference.

## 9. Editor refinements

Requested after the phase 6-8 review, once the redesigned editor could be used.

- [x] 9.1 Make the editor's panels (Entries, Look & feel, Card details) collapsible, defaulting to expanded. `Panel` wraps a Radix `Collapsible`. The trigger is the heading, not the whole header row — `actions` holds buttons, and a button inside a button is invalid markup that browsers resolve by dropping one. The action is hidden while collapsed: an action for a section you cannot see either confuses or acts on something off screen
- [x] 9.2 Fix the card preview's width so it stops growing and shrinking with the longest entry. `.bingo-card` is capped at 420px but is otherwise as wide as its content, and the preview panel hugged it — so the card jumped sideways on every keystroke. The panel is now a fixed `calc(420px + 2rem)` (its own padding, both sides), `max-w-full` so a 390px screen still wins, and `print:w-auto` so the printed page is unaffected. Verified: the panel stays 452px and the card 420px with no entries, one short entry, one very long entry, and eight entries
- [x] 9.3 Show one row of theme chips in Look & feel with a "See _n_ more" that opens the suggestions dialog. Four inline, which fills the row in the editor's control column; they wrap to a second row below `sm`, which is the honest trade for not measuring the container

Two defects found while reviewing these:

- **The panel titles truncated to "Ent...", "Look & f...".** `min-w-0` on the
  heading plus `w-full` on the trigger let the heading shrink to nothing beside
  its action button.
- **The fixed-width preview overflowed its grid column, then the gallery.** The
  editor's preview column was pinned to `26rem` (416px) while the panel is
  452px, so one of the two was always wrong — the column is `auto` now. And on
  `/ui`, a grid item defaults to `min-width: auto` and refuses to shrink below
  its content, so a fixed-width panel pushed the whole gallery past a 390px
  viewport. Both caught by the overflow check, which is exactly the class of
  thing it exists for.

- [x] 9.4 Replace the favicon to match the new theme. It was a palm tree on a bright blue disc in Material Design colours, from before any of this. It is now the app's actual mark: the terracotta tile and lucide `map-pin` glyph the header wordmark uses, so a pinned tab and the page it opens agree. Hex values rather than tokens, because a static asset in `public/` never sees the stylesheet — they are the primary / primary-foreground pair resolved to sRGB, and the file says so

  Reviewed at 16, 24, 32, and 64px beside the header mark rather than at one
  size. The stroke is heavier than lucide's default: a favicon renders at 16px
  far more often than at 64, and a hairline is the first thing to disappear.

  It also failed silently first: the explanatory comment contained a CSS custom
  property name, and **XML forbids a double hyphen inside a comment**. The
  malformed file still served with a 200 and an `image/svg+xml` content type —
  it simply rendered as a broken image. The file now carries a note for the next
  editor.

Print geometry and both exports are unchanged by all three.
