> **Blocked on `add-ai-ui-workflow`.** That change supplies the gallery this is
> reviewed in, the baselines phase 1 is gated against, the card-renderer guard,
> and the print isolation that keeps the new header and background out of the
> PDF. `save-full-entry-pool` is archived, so `App.tsx` and `EntryInput.tsx` are
> settled; keep this change last in the queue regardless, since a restyle
> conflicts textually with almost any editor feature work.

## 1. Foundations — zero visual change

- [ ] 1.1 Add `baseUrl` and `paths: { "@/*": ["./src/*"] }` to `frontend/tsconfig.json` (the solution file — the shadcn CLI reads it) and to `frontend/tsconfig.app.json` (which actually typechecks `src`)
- [ ] 1.2 Add the matching `resolve.alias` for `@` to `frontend/vite.config.ts`
- [ ] 1.3 Install `tailwindcss@4` and `@tailwindcss/vite`; add the plugin to `vite.config.ts`. No `tailwind.config.js`, no PostCSS
- [ ] 1.4 Create `frontend/src/index.css`: `@import "tailwindcss"`, the `dark` custom variant bound to `[data-theme=dark]`, the light and dark token blocks, and the `@theme inline` mapping
- [ ] 1.5 Use shadcn's conventional token names verbatim, plus `--warning`, `--info`, `--paper`, `--stamp`, `--shadow-postcard`
- [ ] 1.6 Import `index.css` in `main.tsx` **before** `App.css`, so the card's unlayered rules keep winning
- [ ] 1.7 Add `src/lib/colorMode.ts` — pure resolve/persist logic for `system | light | dark`, with a co-located test
- [ ] 1.8 Add the inline script in `index.html` that applies the stored mode to `data-theme` before first paint
- [ ] 1.9 Set `colorSchemeSelector: "data-theme"` in `theme.ts` so MUI and Tailwind read the same attribute during coexistence; resolve `system` to a literal first
- [ ] 1.10 Add `components.json` and `src/lib/utils.ts` (`cn`); run `npx shadcn add button input label` as a CLI smoke test
- [ ] 1.11 Audit every generated file for `verbatimModuleSyntax` type modifiers, `erasableSyntaxOnly`, and unused locals/params
- [ ] 1.12 Install `lucide-react`
- [ ] 1.13 Record the bundle size
- [ ] 1.14 **Gate:** lint/test/build pass in both packages, and `/ui` plus all four routes are visually identical to the pre-migration baselines

## 2. Shell, background, and the mode toggle

- [ ] 2.1 Add `src/components/ThemeToggle.tsx` cycling light / dark / system
- [ ] 2.2 Add `src/components/SiteHeader.tsx`: sticky, translucent, wordmark + nav (Editor / My cards) + theme toggle + auth
- [ ] 2.3 Add `src/components/AppShell.tsx` with the three background layers — gradient wash, tiled map-grid SVG as a `data:` URL at 3–4% opacity, and two soft radial colour blots
- [ ] 2.4 Apply the background to the shell, **never to `body`** — MUI's `CssBaseline` sets `body`'s background and would override it
- [ ] 2.5 Mark all background layers `aria-hidden` and `pointer-events-none`, and confirm they do not print
- [ ] 2.6 Adopt the shell in all four pages, replacing their hand-rolled `Container` wrappers
- [ ] 2.7 Add an `.edge-perf` perforated-edge utility, used on exactly one surface (the card preview panel)
- [ ] 2.8 Add a token-strip entry to the gallery: every colour token in both presentations, the radius ladder, the shadow, the type scale
- [ ] 2.9 Review `/ui` and all four routes in light and dark, at 390px and 1440px

## 3. Primitives and leaf components — one commit each

> Hard rule: **no file mixes MUI and Tailwind.** A file migrates completely or not at all.

- [ ] 3.1 `npx shadcn add` the primitive set: button, input, label, card, dialog, dropdown-menu, select, popover, switch, checkbox, tooltip, alert, separator, badge
- [ ] 3.2 Build `ui/chip.tsx` — no shadcn equivalent; `badge` is display-only but `SuggestionsDialog` needs selectable toggles. Base it on `button` + `aria-pressed`, styled as a passport stamp
- [ ] 3.3 Extend the `alert` cva variants to cover `info` and `warning` (shadcn ships only `default`/`destructive`)
- [ ] 3.4 Add a local `Field` wrapper standing in for `TextField`'s label + helper text + error composition
- [ ] 3.5 Migrate `AuthMenu.tsx`
- [ ] 3.6 Migrate `CardDetailsForm.tsx`
- [ ] 3.7 Migrate `FontSchemeForm.tsx`, keeping each option's preview in its own typeface, grouped with `SelectGroup`/`SelectLabel`
- [ ] 3.8 Migrate `EmojiSchemeForm.tsx`
- [ ] 3.9 Map `emoji-picker-react`'s `--epr-*` custom properties onto the tokens and drive its `theme` prop from the mode hook; keep `EmojiStyle.NATIVE` (no CDN calls — the CSP forbids them)
- [ ] 3.10 Rebuild `ColorSchemeForm.tsx`: four large swatch buttons opening a popover with a curated palette plus the native colour input as the escape hatch
- [ ] 3.11 Surface the `suggestedThemes.json` presets in the colour form as preset chips (see the `card-color-scheme` and `card-suggestions` deltas)
- [ ] 3.12 Migrate `ShareLinkDialog.tsx`
- [ ] 3.13 Migrate `SuggestionsDialog.tsx`, using the new chip
- [ ] 3.14 Migrate `EntryInput.tsx`, collapsing the two labelled switches per row into a checkbox for Active and a pin toggle for Mandatory, with the icon buttons on hover
- [ ] 3.15 Migrate `CardView.tsx` — **chrome only**; `CardGrid` is frozen. Replace the disabled-MenuItem-in-a-Box tooltip with an enabled "Sign in to share" item
- [ ] 3.16 Swap icons to lucide: Delete→Trash2, Edit→Pencil, EmojiEmotions→Smile, GridView→LayoutGrid, MoreVert→EllipsisVertical, Share→Share2
- [ ] 3.17 Replace all four `CircularProgress` uses with `Loader2` + `animate-spin`
- [ ] 3.18 Review each migrated component in the gallery as it lands, in both presentations

## 4. Pages and layout

- [ ] 4.1 Migrate `SavedCardsPage.tsx` to shadcn card + dropdown-menu + CSS grid
- [ ] 4.2 Fix the duplicated click target there — a `CardActionArea` and a `role="button"` div both call `handleOpen`; replace with one real `<button>` with a focus ring
- [ ] 4.3 Migrate `SharedCardPage.tsx` and `AuthCallbackPage.tsx`
- [ ] 4.4 Migrate the `routes.tsx` loading state
- [ ] 4.5 Rework `App.tsx` into a two-column workspace at `lg+`: scrolling controls left, sticky card preview right; single column below `lg` with the preview sticky at top. Widen from `md` to `max-w-6xl`
- [ ] 4.6 Reorder control sections to the user's journey — entries, then look-and-feel, then card details — each as its own surface with a header and icon
- [ ] 4.7 Merge colour, font, and emoji into one "Look & feel" panel with three sub-sections or a tab strip
- [ ] 4.8 Delete `.no-print` now that opt-in print isolation has settled
- [ ] 4.9 Run the full export regression from `DESIGN.md` before committing — this is the phase most likely to break print

## 5. Remove MUI

- [ ] 5.1 Delete `src/theme.ts`; remove `ThemeProvider` and `CssBaseline` from `main.tsx`
- [ ] 5.2 Verify `emoji-picker-react` does not depend on Emotion, then uninstall `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`
- [ ] 5.3 Delete the dead assets `src/assets/hero.png`, `react.svg`, `vite.svg`
- [ ] 5.4 Update the CSP comment at `infra/main.tf:112` — `'unsafe-inline'` is now required by Radix, not Emotion. **The CSP value itself does not change**
- [ ] 5.5 Confirm `dist/` contains no `@mui` reference; record the bundle size delta against task 1.13

## 6. Polish

- [ ] 6.1 Spacing rhythm across all screens against the scale in `DESIGN.md`
- [ ] 6.2 Verify contrast for primary, destructive, and muted foregrounds in both presentations
- [ ] 6.3 Confirm every interactive control has a visible focus ring
- [ ] 6.4 Confirm `prefers-reduced-motion` suppresses transitions
- [ ] 6.5 Review every route at 390px
- [ ] 6.6 Confirm surfaces remain distinguishable in dark mode, where shadows all but vanish and the hairline border carries structure

## 7. Documentation

- [ ] 7.1 Add the visual-language half to `frontend/DESIGN.md`: token table (name × light × dark × when to use), surface/radius/shadow rules, spacing scale (4px base; use only 1 2 3 4 6 8 12), type scale, lucide at `size-4`, motion 150–200ms ease-out
- [ ] 7.2 Document the travel-motif inventory and the **one-motif-per-surface** rule
- [ ] 7.3 Add a component-choice table: which shadcn component for which job
- [ ] 7.4 Update `AGENTS.md`: styling is Tailwind + shadcn; tokens only, never raw hex in components; `src/components/ui/` is generated code reviewed as vendored
- [ ] 7.5 Update the `AGENTS.md` gotcha about `'unsafe-inline'` now being required by Radix rather than Emotion
- [ ] 7.6 Update `DESIGN.md`'s dark-mode note — the in-app toggle now exists, so dark mode is reviewable without changing an OS setting

## 8. Verification

- [ ] 8.1 `npm run lint && npm test && npm run build` pass in both `frontend/` and `backend/`
- [ ] 8.2 Signed-out invariant: no `.env.local`, hard-reload `/`, zero XHR/fetch requests, no account UI
- [ ] 8.3 Full export regression: PDF (Letter and A4), PNG, thumbnail — all matching the pre-migration baselines
- [ ] 8.4 PDF is equivalent in light and dark presentation
- [ ] 8.5 `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components src/pages` returns nothing outside the card renderer
- [ ] 8.6 `dist/` contains no gallery sentinel and no `@mui` reference
- [ ] 8.7 Keyboard pass: focus rings everywhere; Radix dialogs trap focus, restore on close, close on Escape
- [ ] 8.8 Confirm `document.fonts.ready` still resolves before print and PNG — it gates both (`CardView.tsx`, `cardThumbnail.ts`)
- [ ] 8.9 **Post-deploy CSP check.** On the dev deploy, with the console open, exercise a Select, DropdownMenu, Popover, Dialog, and the emoji picker. Expect zero violations. This failure class is structurally invisible locally, which is why it is its own task
