## Context

The frontend has 16 UI files (~2,200 lines) and **zero component tests**. There is no jsdom, no `@testing-library`, no Playwright, and no Storybook. Every test in the repo is a pure-logic `src/lib/*.test.ts`. That is a deliberate choice — `AGENTS.md` pushes logic down into `src/lib/` precisely so it can be tested without a DOM — but it leaves the rendered surface entirely unverified.

The consequence shows up in the UI's current state: stock MUI defaults, no design tokens, a card preview stranded in the left third of the viewport, and raw `<input type="color">` swatches sitting next to MUI controls. None of these are hard problems. They persisted because nobody — and no agent — was looking at the result.

This change adds the missing feedback loop without adding a DOM test stack.

## Goals / Non-Goals

**Goals**
- Make the entire UI surface reviewable from a single page.
- Make "review the UI" a required, documented step rather than an optional one.
- Prevent the upcoming redesign from silently breaking print, PNG export, or thumbnails.
- Keep every addition out of the production bundle.

**Non-Goals**
- **Not** adding jsdom + `@testing-library`. It roughly doubles the scope of this change and reverses a deliberate repo decision. Its absence is exactly why the gallery and the guard tests are worth building; revisit it as its own proposal if component tests are later wanted.
- **Not** adding Playwright, Chromatic, Percy, or any CI visual-diffing step. There is no CI job to diff against, so committed reference screenshots would rot within two changes.
- **Not** restyling anything. This change deliberately lands while the app still looks the way it does today.

## Decisions

### Decision: A gallery route, not a Storybook install
Storybook is a large dependency tree, a second build pipeline, and a second dev server, for a 16-file app. A single route that imports the real components gets the same benefit — every component in every state, in one screenshot — at the cost of one lazily-loaded page. It also renders inside the real app shell, so it reflects real inherited styling rather than Storybook's isolated canvas.

### Decision: `import.meta.env.DEV` + dynamic import for exclusion
Vite statically replaces `import.meta.env.DEV` with `false` at build time, so Rollup drops the guarded branch and, because the import is dynamic, the entire gallery chunk with it. This is more reliable than a runtime check (which would keep the code in the bundle) and needs no separate entry point or build config.

Because "the dead-code elimination worked" is an assumption rather than a guarantee, it is **verified mechanically**: the gallery contains a distinctive sentinel string, and a build check greps `dist/assets/*.js` for it.

### Decision: Three independent staleness defenses for the gallery
A gallery that drifts out of date is worse than none, because it produces confident, wrong screenshots. Three defenses, because each fails differently:
1. **A coverage test** (`import.meta.glob` over `src/components/*.tsx` vs the registry) — catches a *new* component with no entry. Mechanical, fails CI.
2. **The gallery imports the real components** — catches a *changed* component automatically. No copies, ever.
3. **An `AGENTS.md` rule** — catches the case the first two cannot: a new *state* of an existing component.

The coverage test asserts presence, not completeness of states; that is what the rule is for.

### Decision: Invert print isolation rather than audit `.no-print` usage
The current `@media print { .no-print { display: none } }` is opt-out: correctness depends on every author remembering the class. That has held so far because the app is one container of controls, but it fails the moment a persistent header, a sticky nav, or a fixed page background exists — all of which the redesign adds.

Opt-in isolation inverts the default:

```css
@media print {
  body { background: none !important; }
  body * { visibility: hidden; }
  .bingo-card, .bingo-card * { visibility: visible; }
  .bingo-card { position: absolute; left: 0; top: 0; width: 100%; }
}
```

`visibility` rather than `display` because it preserves layout inside the card. The explicit `background: none` is required because a fixed page background paints outside the visibility cascade, and the absolute repositioning is required because hiding ancestors visually does not reclaim their space. `.no-print` is kept as a harmless alias so existing call sites keep working, and is removed once the redesign has settled.

Trade-off: visibility-based isolation is known to interact badly with `position: fixed` ancestors, so this must be verified by actually printing, not by reading the CSS.

### Decision: A text-based guard test for the card renderer
`CardGrid.tsx` and the `.bingo-*` rules are the only part of the app whose visual output is **user data**, and they feed four consumers: screen preview, `@media print`, `html-to-image`'s PNG export, and `lib/cardThumbnail.ts`. A restyle that reaches them changes what users have already saved and exported.

There is no DOM to assert against, so the guard reads both files as **text** and asserts:
- `CardGrid.tsx`'s `className` values are only allowlisted `bingo-*` classes;
- `App.css` still defines the five card classes and the `@media print` block;
- neither file contains `var(--color-` (a design token) or `oklch(`.

`oklch` is called out specifically because `html-to-image` clones and serializes computed styles, making modern color syntaxes the most likely source of a silent export regression. User-supplied hex values are safe; tokens are not.

This is a crude test. It is also the only kind available without a DOM, and it catches the exact failure mode that matters.

### Decision: `strictPort` on the dev server
Cognito's redirect URI is registered as exactly `http://localhost:5173/auth/callback`. When port 5173 is busy, Vite silently serves on 5174 and sign-in fails with a redirect-mismatch error that looks like an auth bug. Failing loudly on a busy port converts a confusing mid-review failure into an obvious one.

## Risks / Trade-offs

- **The gallery becomes a maintenance burden.** Mitigated by the three defenses above, and bounded by the app's size — 16 components, not 200.
- **Dead-code elimination silently regresses**, shipping the gallery to production. Mitigated by the sentinel-string build check, which is the reason that check exists rather than trusting Vite.
- **The print rewrite breaks printing in a way the guard test cannot see.** The guard test asserts the print block *exists*, not that it is correct. This is why the export regression checklist requires actually printing to PDF on both Letter and A4, in both light and dark mode, before the change is considered done.
- **The coverage test creates friction** for anyone adding a component. That is the intent; the alternative is a gallery nobody trusts.

## Migration Plan

Additive and reversible. The gallery is new files plus one guarded route. The two tests are new files. The only edit to existing behavior is the `@media print` block, which is verified by the export regression checklist in the same commit.

No backend, infra, or CSP changes. No production runtime code changes.

## Sequencing

Lands before `redesign-app-visual-language`. Independent of `save-full-entry-pool` (which touches `App.tsx` and `EntryInput.tsx`; this change touches neither), with a conflict surface of a single registry line if both are in flight.

## Open Questions

- Whether `.no-print` should be deleted in this change or left until the redesign settles. Proposed: keep it here as an alias, delete it in the redesign, so this change has no chance of breaking an existing call site.
- Whether the gallery should render the bingo card itself. Proposed: yes, but read-only and clearly labeled as frozen, so the "before" baseline captures it — while the guard test ensures the gallery cannot become a vector for restyling it.
