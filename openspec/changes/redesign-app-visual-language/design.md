## Context

37 distinct MUI components across ~110 import sites in 16 files, ~2,200 lines. `Stack`, `Typography`, `Button`, and `Alert` account for 42 of those imports and mostly dissolve into plain elements. The card renderer (105 lines) is excluded. This is a two-to-three week migration, not a quarter.

Two facts about the current setup shape everything below.

**`App.css` is unlayered CSS.** Tailwind v4 puts preflight and utilities inside `@layer`, and unlayered rules beat layered ones in the cascade. So the bingo card is *automatically* immune to Tailwind — no opt-out needed. This is load-bearing and is documented as such in `DESIGN.md` and `AGENTS.md`.

**Dark mode is OS-only.** `colorSchemeSelector` defaults to `media` when both schemes are set (`createThemeWithVars.mjs:115`). There is no in-app toggle, so nobody driving a browser can exercise dark mode. That makes the toggle a prerequisite for reviewing this change, not a feature of it.

## Goals / Non-Goals

**Goals**
- One token layer that determines the app's appearance, working in light and dark.
- A visual language that says "travel" without saying "children's app".
- Layout that groups controls and gives the card the prominence it should have.
- Leave the card renderer's exported output bit-for-bit unchanged.

**Non-Goals**
- **Not** restyling the bingo card. Frozen by `add-ai-ui-workflow`.
- **Not** adding jsdom/Testing Library. Still out of scope, still its own proposal if wanted.
- **Not** a rewrite of `src/lib/`. This change touches rendering only; the pure logic and its tests are untouched.
- **Not** changing any backend or API behaviour.

## Decisions

### Decision: Coexistence at the infrastructure level, big-bang per file
Install Tailwind alongside MUI, but hold one hard rule: **no single file mixes MUI and Tailwind.** A file migrates completely in one commit or not at all.

Not a true big-bang, because a commit to `main` auto-deploys dev; a single 16-file rewrite would be one unreviewable commit with no rollback granularity. Not a free-form strangler either, because half-migrated files produce specificity fights between Emotion's `sx` and Tailwind utilities, and mixing-tolerant migrations tend not to finish.

Cost: both libraries in the bundle for four phases. Temporary and measurable — record bundle size at phase 1 and phase 5.

### Decision: Tailwind v4 with CSS-first config
`tailwindcss@4` + `@tailwindcss/vite`, configured through `@theme` in CSS. **No `tailwind.config.js`, no `postcss.config.js`.** The repo has neither today, and adding a PostCSS pipeline to a Vite 8 build buys nothing. shadcn/ui supports v4 and React 19.

### Decision: shadcn's token names verbatim
Use `--background`, `--foreground`, `--card`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`, and the rest exactly as shadcn names them, so `npx shadcn add` output works unmodified. Add `--warning` and `--info` (MUI's `Alert` has `info`/`warning`/`error` severities; shadcn's ships only `default`/`destructive`), plus `--paper`, `--stamp`, and `--shadow-postcard` for the travel treatment.

### Decision: `data-theme` on the root, shared by both systems
The mode toggle writes `light` or `dark` to `data-theme` on `<html>`. Tailwind reads it via `@custom-variant dark`.

⚠️ **The usual inline script in `index.html` is not available here.** The production CSP is `script-src 'self'` — no `'unsafe-inline'`, no hash — so an inline script is blocked, and blocked *only* in production, since CloudFront applies the CSP and dev never sees it. Weakening `script-src` is not on the table, and a CSP hash would put the script in `index.html` and its digest in Terraform, where a mismatch surfaces as a broken page after deploy. Phase 1 therefore applies the stored mode from `main.tsx` before `createRoot`, which is enough while nothing outside the React tree paints from a token.

**Phase 2 must revisit this**, because the shell will paint `bg-background`. Two CSP-clean options: a `@media (prefers-color-scheme: dark)` fallback in the token layer, which costs a duplicated token block but covers `system` (the default, and most users); or `public/theme-init.js` loaded as a normal same-origin script, which covers every case at the cost of one render-blocking request.

An attribute also applies in **every medium**, which a media query does not — that is what put a near-black page into the PDF for dark-mode users in phase 1. See the print note under Risks.

**Set `colorSchemeSelector: "data-theme"` in `theme.ts` during phase 1**, so MUI reads the same attribute. Otherwise MUI follows the OS while Tailwind follows the toggle, and every mixed screen disagrees with itself for four phases. `system` must resolve to a literal `light`/`dark` before being written — MUI understands only those two.

### Decision: the palette, and the one collision in it
- **primary** — sun-faded terracotta, ~`oklch(0.62 0.17 35)`. A vintage luggage tag.
- **accent** — ocean teal, ~`oklch(0.60 0.11 200)`. The travel-poster complement to terracotta.
- **background (light)** — warm cream, ~`oklch(0.975 0.012 85)`, **not white**. The card is usually white; it has to sit *on* something. This one value carries most of the warmth.
- **background (dark)** — warm-shifted ink navy, ~`oklch(0.22 0.02 260)`, never pure black.
- **muted / foreground** — warm greys, hue-shifted to 60–80°. Neutral grey is what makes a Tailwind app look like every other Tailwind app.

⚠️ **destructive collides with primary.** A terracotta primary and a red destructive sit close enough in hue to be confusable, which matters when the destructive action is "delete a saved card". Mitigation: push destructive to a deeper crimson (~25°, higher chroma, lower lightness) *and* give delete a ghost/outline treatment so the two are never adjacent as solid fills. Verify contrast for both against their foregrounds.

### Decision: two depth devices, not an elevation ladder
Material's elevation scale is the wrong instrument for this. Instead:
1. `--shadow-postcard` — warm-tinted, two-stop, low opacity. Warm shadows, never black.
2. A 1px `--border` hairline on every surface, because shadows all but vanish in dark mode and the hairline is what carries structure there.

### Decision: one new font family for chrome
The five `@fontsource` families already installed are **card-content choices offered to the user**. Reusing one for app chrome blurs the line between "your card" and "the app" — which is precisely the distinction this change is trying to sharpen.

Add exactly one: **`@fontsource-variable/outfit`** for headings only, with `ui-sans-serif, system-ui` for body text. One self-hosted variable file, so no `font-src` change; body text costs nothing to download. Fallback if the extra dependency is unwanted: Fredoka, already present, accepting the overlap.

### Decision: at most one travel motif per surface
The background pattern, the perforated postcard edge, the stamp-style chips, the luggage-tag wordmark — each is fine alone and kitsch in combination. The perforated edge appears on exactly one surface: the card preview panel. This rule goes in `DESIGN.md`, because it is the failure mode a themed redesign actually has.

### Decision: components with no clean shadcn equivalent
Most mappings are 1:1 Radix primitives. These are not:

| MUI | Resolution |
| --- | --- |
| `TextField` | `input` + `label` + a local `Field` wrapper. MUI's floating label, `helperText`, and `error` collapse into three elements. **Do not adopt react-hook-form** — shadcn's `form` requires it and these are simple controlled inputs. |
| `Chip` | **The one genuinely new component.** shadcn's `badge` is display-only, but `SuggestionsDialog` uses Chips as selectable toggles. Build `ui/chip.tsx` on `button` + `aria-pressed`, styled as a passport stamp. |
| `Alert` | Extend shadcn's cva variants to cover `info` and `warning`. |
| `CardActionArea` | A real `<button>` with `focus-visible:ring` and a hover lift. Note `SavedCardsPage` currently has a `CardActionArea` *and* a `role="button"` div both calling `handleOpen` — two overlapping targets. Fix while here. |
| `Tooltip` on a disabled item | `CardView` wraps a disabled `MenuItem` in a `Box` so the tooltip fires; Radix has the same limitation. Better fix: drop the disabled item and render an enabled "Sign in to share". |
| `CircularProgress` | `lucide-react`'s `Loader2` + `animate-spin`, the documented shadcn idiom. |

`Menu` → `dropdown-menu` is a net simplification: `anchorEl` state disappears, and `SavedCardsPage`'s `{cardId, anchor}` state collapses to a per-card trigger.

### Decision: `emoji-picker-react` gets explicit attention
It cannot be shadcn-ified and will look foreign against everything else. Map its `--epr-*` custom properties onto the new tokens and drive its `theme` prop from the mode hook. `EmojiStyle.NATIVE` stays mandatory — it exists to avoid CDN calls, which the CSP forbids. This is the detail most likely to be missed.

### Decision: `@/` only for new code
Add the `@/*` alias to `tsconfig.json`, `tsconfig.app.json`, and `vite.config.ts` (the shadcn CLI reads the solution file). **Do not mass-rewrite existing relative imports** — a global rewrite is churn that conflicts with every in-flight branch and changes no behaviour.

## Risks / Trade-offs

1. **The CSP is invisible locally.** It is applied by CloudFront, not in dev. The value needs no change, but that conclusion is only proven after deploy — so a post-deploy console check exercising Select, DropdownMenu, Popover, Dialog, and the emoji picker is a numbered task, not a note. This risk paid out immediately: `script-src 'self'` ruled out the pre-paint inline script in phase 1 (see the `data-theme` decision above), and nothing local would have said so.

8. **A themed attribute applies to print; a media query does not.** Realised in phase 1. The app's dark mode was previously invisible to the printer for free, because it lived in `@media (prefers-color-scheme: dark)`. Under `data-theme` it reaches the printed page, and `color-scheme: dark` darkens the *canvas* — which paints outside the cascade that hides everything else, so **no screenshot shows it**; only the PDF does. `@media print` now pins `color-scheme: light !important`. Treat "does it still print correctly in dark mode" as a real question for every later phase, and check the PDF rather than a screenshot.
2. **`emoji-picker-react` looking foreign.** Mitigated above; the risk is forgetting entirely.
3. **destructive vs primary.** Mitigated above; verify rather than assume.
4. **The shadcn CLI vs a solution-style `tsconfig.json`.** `"files": []` + `references` is a shape the CLI is known to choke on. Budget for hand-writing `components.json` and copying a component or two from the registry. Don't fight the tool.
5. **Strict TypeScript vs generated code.** `verbatimModuleSyntax` (type modifiers required) and `erasableSyntaxOnly` (no enums, no parameter properties) will reject some generated files. `tsc -b` catches it, but at commit time rather than generation time — audit each file on arrival. Oxlint is fine as-is; `allowConstantExport: true` already covers `buttonVariants`-style exports.
6. **Two UI libraries in the bundle for four phases.** Temporary; measure at both ends.
7. **Zero component tests.** The safety nets are the build, the gallery review loop, and the two guard tests from `add-ai-ui-workflow`. That is thin, and it is the reason those guards exist.

## Migration Plan

Six phases, each shippable.

- **Phase 1 — foundations, zero visual change.** Path aliases, Tailwind install, the token layer, the mode toggle, `colorSchemeSelector`, `components.json`, `cn`, `lucide-react`. Gate: lint/test/build pass **and** the app is visually identical to the pre-migration baselines. Proving zero change here is what makes every later diff attributable.
- **Phase 2 — shell and background.** `AppShell`, `SiteHeader`, `ThemeToggle`, the layered background, adopted by all four pages. Background goes on the shell, never `body` — MUI's `CssBaseline` sets `body`'s background and would override it while MUI is still present. Gallery gains the token strip.
- **Phase 3 — primitives and leaf components**, one commit each, leaf to root: `AuthMenu`, `CardDetailsForm`, `FontSchemeForm`, `EmojiSchemeForm`, `ColorSchemeForm` (rebuilt), `ShareLinkDialog`, `SuggestionsDialog`, `EntryInput`, `CardView` (chrome only).
- **Phase 4 — pages and layout.** `SavedCardsPage`, `SharedCardPage`, `AuthCallbackPage`, then the `App.tsx` two-column workspace. Run the full export regression before committing.
- **Phase 5 — remove MUI.** Delete `theme.ts`, `CssBaseline`, `ThemeProvider`; uninstall the four packages; delete the dead `hero.png`/`react.svg`/`vite.svg`; update the `infra/main.tf` CSP comment; record the bundle delta.
- **Phase 6 — polish**, driven by gallery review: spacing rhythm, contrast, focus rings, reduced motion, 390px, dark-mode surface separation.

## Sequencing

`add-ai-ui-workflow` is archived and provides the gallery, the baselines, the card-renderer guard, and the print isolation. `save-full-entry-pool` and `enhance-saved-cards-view` are archived too. Nothing is in flight; this change is unblocked.

It runs to completion **before** `add-trips`, so the substantial trips UI is authored once in the final design system rather than written in MUI and immediately rewritten. See the proposal's Sequencing section for the full rationale.

## Open Questions

- Whether to take the Outfit dependency or reuse Fredoka for chrome. Proposed: Outfit, for the clean chrome/card separation; it is one self-hosted variable file.
- Whether the colour picker's curated palette should be authored fresh or derived from the existing `suggestedThemes.json`. Proposed: derive, so there is one source of curated colour in the repo rather than two that drift.
- Whether `.no-print` is deleted in this change once opt-in print isolation has settled. Proposed: yes, in phase 4, alongside the layout rework that proves the isolation holds.
