# Design and visual review

How UI work in this app gets reviewed, and the rules it conforms to.

This document exists because the app has **no component tests** — no jsdom, no
Testing Library, no Playwright. That is deliberate (`AGENTS.md` pushes logic into
`src/lib/` precisely so it can be tested without a DOM), but it means nothing
mechanical checks what the app *looks* like. Looking at it is the check.

> The visual language section — colour tokens, type scale, spacing, motion — is
> added by the `redesign-app-visual-language` change. Until then this document
> covers the review process and the guardrails.

## The review loop

### 1. Start the app

```bash
cd frontend
npm run dev          # http://localhost:5173
```

Port **5173 is load-bearing**: Cognito's redirect URI is registered as exactly
`http://localhost:5173/auth/callback`. `vite.config.ts` sets `strictPort`, so a
busy port fails loudly instead of silently serving on 5174 and breaking sign-in
in a way that looks like an auth bug. Free the port; don't work around it.

Account features need `frontend/.env.local`. Without it the app runs fully
signed-out, which is the right mode for reviewing the editor.

### 2. Open the gallery

<http://localhost:5173/ui>

Every component, in its meaningful states, on one page. This is the primary
review surface — a single screenshot covers most of the UI. It is dev-only:
`routes.tsx` guards the route with `import.meta.env.DEV` and loads it through a
dynamic import, so the chunk is dropped from production builds entirely.

Two things the gallery does **not** cover, which need their own pass:

- **Dialogs** (`SuggestionsDialog`, `ShareLinkDialog`) portal to the body, so
  they can't sit inline with everything else. Each has a trigger button; open and
  capture them individually.
- **Page-level layout** — how components are composed on `/`, `/cards`, and
  `/s/:token`. The gallery shows components; it does not show arrangement, which
  is where most layout problems live. Review the real routes too.

### 3. Capture

```bash
npm run capture -- /            # the editor
npm run capture -- /ui          # the gallery
npm run capture -- / --pdf      # also print to PDF, Letter and A4
```

`scripts/capture.mjs` drives headless Chrome over the DevTools Protocol using
only Node built-ins — no Playwright, no Puppeteer, no browser extension. Chrome
itself is the only requirement (set `CHROME_PATH` if it is not in the default
macOS location). Output lands in `.captures/`, which is git-ignored.

Each run produces the review matrix:

|       | 390px (mobile) | 1440px (desktop) |
| ----- | -------------- | ---------------- |
| Light | ✓              | ✓                |
| Dark  | ✓              | ✓                |

Dark mode is emulated with `Emulation.setEmulatedMedia`, so it is reviewable
**without touching the OS setting** — worth knowing, because in the browser dark
mode still follows the OS (MUI's `colorSchemeSelector` defaults to `media` and
there is no in-app toggle yet). The capture script is currently the only way to
see dark mode without changing your system appearance.

The run also reports any `/api/` request the page makes on load. Chrome starts
from a throwaway profile, so there is never a session — meaning the count should
always be **zero**. That is the signed-out invariant from `AGENTS.md`, checked on
every capture instead of being taken on trust.

**Screenshots are review artifacts, not baselines.** Nothing diffs them in CI, so
they are not committed — they would rot within two changes. The gallery is the
baseline. Keep a copy outside the repo when you need a before/after comparison.

### 4. Compare against intent, then iterate

Compare what you see against what this document and the change's spec say it
should be — not against a vibe. Edit, let HMR reload, look again.

**Cap it at about three passes per component.** Beyond that you are thrashing
rather than converging; step back and decide what "right" actually means before
touching it again.

Check the browser console on each pass. React key warnings and accessibility
warnings surface there and nowhere else.

### Reviewing signed-in screens

`/cards`, saving, and share links need a session. Rather than going through
Google sign-in:

```bash
scripts/dev-user.sh create alice@example.com
```

It prints a `localStorage.setItem('travelbingo.session', …)` snippet. Run that on
the `http://localhost:5173` origin, then reload.

Note that local development runs against the **deployed dev** API, pool, and
table. Cards you save are real dev rows and deleting them really deletes them.

## The card renderer is frozen

`src/components/CardGrid.tsx` and the `.bingo-*` rules in `src/App.css` are the
only part of the app whose visual output is **user data**. Colours, fonts, and
emoji all come from the user's saved schemes, applied as inline styles.

That same DOM feeds four consumers:

1. the on-screen preview,
2. `@media print` — the PDF export,
3. `html-to-image`'s `toPng` — the PNG export,
4. `src/lib/cardThumbnail.ts` — saved-card thumbnails.

Restyling it changes what users have **already saved and exported**. So:

- **No app design tokens inside the card.** No `var(--color-*)`, no theme values.
- **No `oklch()` inside the card.** `html-to-image` clones the node and
  serialises computed styles; modern colour syntaxes are the likeliest source of
  a silent export regression. The user's own hex values are fine.
- **Leave `#ccc` and `#999` in `App.css` alone.** They look like a dark-mode bug.
  They are not — they are the *card's* border colours, part of the exported
  artifact. Making them theme-aware would mean the printed PDF changes depending
  on the viewer's OS setting. **The card is a document, not UI. It does not have
  a dark mode.** If it reads oddly against a dark page, frame it in a themed
  panel; don't restyle the card.
- **`App.css` is deliberately unlayered CSS.** Any stylesheet that uses
  `@layer` — Tailwind's preflight and utilities, for instance — loses to
  unlayered rules in the cascade. That is what keeps the card immune to future
  app-wide styling, and it is load-bearing. Don't wrap `App.css` in a layer.

`src/components/cardGrid.guard.test.ts` enforces the mechanical parts of this.

## Export regression checklist

Run this whenever you touch `CardGrid.tsx`, `App.css`, or anything that changes
the page around the card. This is the canonical copy referenced by the definition
of done in `AGENTS.md`.

Most of it is two commands:

```bash
npm run capture -- / --pdf     # screenshots, PDFs, and the API-request count
npm run export-check           # the PNG export and the saved-card thumbnail
```

1. **Signed-out invariant.** `npm run capture` reports every `/api/` request the
   page makes on load, from a throwaway profile with no session. Expect **zero**.
2. **Print — Letter and A4.** `--pdf` writes both. Each must be exactly one page
   containing only the card: no heading, no buttons, no auth menu, no page
   background. Compare against your pre-change copies.
3. **Print — dark mode.** The capture run emulates `prefers-color-scheme`, so
   compare the dark PDF against the light one; they must be equivalent. The card
   is a document, and its exported bytes must not depend on how the app is themed.
4. **PNG export and thumbnail.** `npm run export-check`. It drives the real
   Export ▸ PNG flow on the gallery's populated card and writes the result to
   `.captures/export/`, then runs the real `generateCardThumbnail` against the
   same node and reports its size against the cap. Open both and check the
   title, colours, fonts, emoji ring, and that the long entry's text scaled down.

   The thumbnail number is the one to watch: it is dropped **silently** when it
   will not fit under `MAX_THUMBNAIL_BYTES`, so a visually heavier card
   degrades the library to placeholders with no error anywhere. At the time of
   writing the sample card uses 41 KB of the 98 KB cap — 58% headroom.

   This runs entirely against the dev server: no sign-in, no API call, and
   nothing written to the deployed dev table or thumbnail bucket.
5. **PNG edge cases.** Check the gallery's no-title card state too.
6. **Keyboard.** Tab through the editor. Every control needs a visible focus
   ring. Dialogs must trap focus, restore it on close, and close on Escape.
   Not automated — do this one by hand.

Keep reference copies of the PDF, PNG, and thumbnail from before your change so
"unchanged" is something you can check rather than assert.

## Keeping the gallery honest

Three defences, because each fails differently:

1. **`src/dev/gallery/coverage.test.ts`** globs `src/components/*.tsx` and fails
   when a component has no entry in `registry.tsx`. Catches a new component with
   no entry.
2. **The gallery imports the real components**, never copies. Catches a changed
   component automatically.
3. **This rule**, which is the only thing that catches a new *state* of an
   existing component: when you add a meaningful state — an error, an empty case,
   a limit — add it to the registry.

Layout: `registry.tsx` holds entries (constants only), `samples.tsx` holds the
interactive sample components, `sampleData.ts` holds fixtures. Split that way so
each file's exports are all one kind, which keeps the fast-refresh lint rule
quiet.
