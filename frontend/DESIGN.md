# Design and visual review

How UI work in this app gets reviewed, and the rules it conforms to.

**This document holds the rules; each brand's own values live beside it.** The
app ships as more than one brand — one is selected at build time by
`VITE_BRAND` — so what a token is *for* is shared and what colour it *is* is
not. Token roles, the motif slots, the spacing and type scales, depth, focus,
the frozen renderer, and the export checklist are here. Palettes, typefaces, and
each brand's realization of each motif are in `src/brand/<id>/BRAND.md`:

- `src/brand/travel/BRAND.md` — Travel Bingo
- `src/brand/office/BRAND.md` — Office Lingo Bingo

Neither restates the other. This one stays a document about a system; each of
those stays a document about a look.

This document exists because the app has **no component tests** — no jsdom, no
Testing Library, no Playwright. That is deliberate (`AGENTS.md` pushes logic into
`src/lib/` precisely so it can be tested without a DOM), but it means nothing
mechanical checks what the app *looks* like. Looking at it is the check.

## The review loop

### 1. Start the app

```bash
cd frontend
npm run dev                       # http://localhost:5173, travel brand
VITE_BRAND=office npm run dev     # the same app as Office Lingo Bingo
```

`VITE_BRAND` is optional for the dev server and **required** for `vite build` —
a fresh clone with no `.env.local` still runs, while a misconfigured CI job
fails instead of shipping one brand's assets to another brand's bucket. The dev
default is `travel`.

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

VITE_BRAND=office npm run capture -- /   # against an office dev server
```

**Pass `VITE_BRAND` to `capture` to match the server you started it against.**
It goes in the output filename (`office-root-1440-light.png`), so one brand's
captures cannot silently overwrite the other's — which matters because the two
are meant to be compared, and the failure mode is a reviewer looking at one
brand twice and concluding they agree.

`scripts/capture.mjs` drives headless Chrome over the DevTools Protocol using
only Node built-ins — no Playwright, no Puppeteer, no browser extension. Chrome
itself is the only requirement (set `CHROME_PATH` if it is not in the default
macOS location). Output lands in `.captures/`, which is git-ignored.

Each run produces the review matrix:

|       | 390px (mobile) | 1440px (desktop) |
| ----- | -------------- | ---------------- |
| Light | ✓              | ✓                |
| Dark  | ✓              | ✓                |

Dark mode is emulated with `Emulation.setEmulatedMedia`, so a capture run covers
both presentations without touching the OS setting.

In the browser, use the **theme toggle in the header** — it cycles light → dark →
system and persists the choice. What it sets is `data-theme` on `<html>`, which
Tailwind reads through `@custom-variant dark` in `index.css`. `system` is
resolved to a literal `light`/`dark` before it is written, so the attribute only
ever holds one of those two.

The capture script emulates `prefers-color-scheme` rather than driving the
toggle, so it exercises the `system` path. To review an *explicit* choice, set
it in the browser — `localStorage["travelbingo.colorMode"]` is where it lands.

The run also reports any `/api/` request the page makes on load. Chrome starts
from a throwaway profile, so there is never a session — meaning the count should
always be **zero**. That is the signed-out invariant from `AGENTS.md`, checked on
every capture instead of being taken on trust.

**Screenshots are review artifacts, not baselines.** Nothing diffs them in CI, so
they are not committed — they would rot within two changes. The gallery is the
baseline. Keep a copy outside the repo when you need a before/after comparison.

### 4. Compare against intent, then iterate

Compare what you see against what this document, the brand's `BRAND.md`, and
the change's spec say it should be — not against a vibe. Edit, let HMR reload,
look again.

**Review every brand the change can affect.** A change to `src/brand/<id>/` is
that brand's alone, and the others need only be confirmed unchanged. Anything
else — a component, `base.css`, a shared utility — affects all of them, and the
matrix doubles. Nothing mechanical catches "this brand's disabled button fails
contrast against its own secondary"; the guards catch *structural* drift only.

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

## The visual language

The style layer is split. `src/base.css` holds what every brand shares — the
dark variant, the `@theme inline` token bridge that *names* every token, the
base page paint, the reduced-motion rule. `src/brand/<id>/theme.css` holds one
brand's values for those names, and `src/index.css` is imports only.

Components consume tokens; **no component carries a raw hex value**, and `npm
run build` is not what catches that — a reviewer is.

### Colour tokens

The names are shadcn/ui's, verbatim, so `npx shadcn add` output works
unmodified. See them rendered in both presentations at `/ui`, first section.

The table below is what each token is **for**. What each one *is* depends on the
brand — see that brand's `BRAND.md`. Every brand must define every token in both
presentations; `src/brand/tokens.contract.test.ts` fails the build otherwise,
because a token missing from one brand renders as *nothing*, with no error
anywhere.

| Token | Use it for |
| --- | --- |
| `--background` | The page. Deliberately **not** white — the card is white and has to sit *on* something. This one value carries most of a brand's character. |
| `--foreground` | Body text. |
| `--card` | Panels and any raised surface. |
| `--popover` | Popovers, dropdowns, dialogs. Same value as `--card` in both brands today; separate because they will diverge if a panel ever gains a tint. |
| `--primary` | The main action, the wordmark, one accent per screen. Dark generally lifts it — a light-mode fill colour is usually too dark to read against a dark page. |
| `--secondary` | Quiet fills: hover states, icon chips, secondary buttons. |
| `--muted` / `--muted-foreground` | Helper text, captions, placeholder fills. Hue-shifted, never neutral — neutral grey is what makes an app look like every other app. Which *way* it shifts is the brand's call, and it is the single strongest signal of one. |
| `--accent` | shadcn's hover/active surface, **not** a brand colour. Every `ghost` and `outline` button and every menu item is `hover:bg-accent`; a saturated value turns each into a solid block on hover. Keep it quiet. |
| `--brand-accent` | The second voice. Sparingly, and always by name — a background wash and a success icon, not a second primary. |
| `--destructive` | Delete and revoke, **only**. |
| `--warning` / `--info` | Alert severities. shadcn ships two variants where this app needs four; these are the additions. |
| `--border` / `--input` | Every surface edge. In dark this is what carries structure — see Depth. |
| `--ring` | Focus. Never remove it; see Focus. |
| `--paper` | The card preview panel only. |
| `--stamp` | Ink for the selectable chip — a border and letter colour, never a fill. Must clear 4.5:1: it is 12px lettering, not just a rule. |
| `--radius` | The one corner-radius knob; shadcn's `sm`/`md`/`lg`/`xl` ladder derives from it. |
| `--shadow-raised` | Depth. See Depth. |

⚠️ **Some pairs must stay distinguishable, and which pairs those are changes
per brand.** The user has to tell the primary action from the destructive one at
a glance; wherever two tokens carry meanings that must not be confused, the pair
has to be **re-derived against that brand's own values**, in both presentations,
never inherited. The token guard checks presence, never value, so this is a
human check — once per brand, on the chip and alert surfaces specifically.

Both brands have hit this, and differently. Travel's terracotta `--primary`
sits close to its crimson `--destructive`. Office's blue primary retires that
collision and creates two more: a red stamp against a red destructive, and an
info blue against a primary blue. See each `BRAND.md` for what was done about
it.

### Spacing

4px base. For **layout** — gaps between elements, padding on panels and pages —
use only `1 2 3 4 6 8 12`: `gap-2`, `p-4`, `mb-6`, and so on.

Half-steps (`0.5`, `1.5`, `2.5`) are allowed **inside a single control**, where
optical padding rarely lands on a 4px grid — a nav link's `px-2.5 py-1.5`, a
chip's padding, the gap in a swatch grid. They are not allowed between
components. If you are reaching for `gap-5` you want `4` or `6`.

| Step | Where |
| --- | --- |
| `1` / `2` | Inside a control: icon-to-label, chip padding. |
| `3` / `4` | Between fields in a form; a panel's internal padding on mobile. |
| `6` | Between panels; between sub-sections inside a panel. |
| `8` | Page top and bottom padding. |
| `12` | Between major regions of a long page. |

### Type

Two families and no more. **`font-display` (Outfit) is for headings only.** Body
text is the system stack, which costs nothing to download.

The five `@fontsource` families — Poppins, Playfair Display, Anton, Pacifico,
Fredoka — are **card-content choices offered to the user**. Never use one for app
chrome. Keeping the two sets apart is what makes the card read as the user's and
the app as ours.

| Class | Use |
| --- | --- |
| `font-display text-3xl font-semibold` | Page title. |
| `font-display text-2xl font-semibold` | Page title on a secondary screen. |
| `font-display text-lg font-semibold` | Panel and section heading. |
| `text-sm font-medium text-muted-foreground` | Sub-section heading inside a panel. |
| `text-base` | Body. |
| `text-sm text-muted-foreground` | Helper text, captions, timestamps. |
| `text-xs` | Field labels above a control, and metadata. |

### Depth

Two devices, not an elevation ladder:

1. `--shadow-raised` — low opacity, tinted toward the brand's own hue rather
   than black. Never pure black.
2. A 1px `--border` hairline on **every** surface.

**Never ship a surface with only a shadow.** Shadows all but vanish against the
dark background; the hairline is the only thing holding a panel together there.

### Icons

`lucide-react`, at `size-4` inside controls and `size-5` standing alone. Always
`aria-hidden` when a text label is beside them. The shadcn button styles size
bare `svg` children automatically — pass a class only to override.

### Motion

150–200ms, ease-out, and only on hover/open transitions. Nothing in this app
animates to convey meaning, which is why `base.css` disables all of it under
`prefers-reduced-motion: reduce` globally rather than per component — a rule
every future component must remember is a rule that will be forgotten.

### Focus

Every interactive control shows `focus-visible:ring-[3px] focus-visible:ring-ring/50`.
The shadcn primitives do this already; anything hand-rolled — the colour
swatches, the saved-card open button, the header links — must opt in explicitly.
Tab through a screen before calling it done.

## The motif slots

Character is carried by five devices. Each is fine alone and kitsch in
combination, so the rule is **at most one per surface**:

| Slot | Its one surface |
| --- | --- |
| Page texture (`bg-page-texture`) | The page, via `AppShell` — with the wash and the colour blot. |
| Wordmark mark (`brand.MarkIcon`) | The header wordmark. |
| Panel edge (`panel-edge`) | The card preview panel in `CardView`. Nothing else. |
| Selectable chip (`--stamp`, via `ui/chip.tsx`) | Theme presets and suggestion toggles. |
| Raised surface (`--shadow-raised`) | Any raised surface — the one device allowed everywhere, because it reads as depth rather than as decoration. |

If you are reaching for a second motif on a surface that already has one, the
answer is no. This is the failure mode a themed redesign actually has: not too
little character, but too much of it in one place.

**These are slots, not pictures.** Each is named for the job it does, so a
component never asks for something a second brand has no answer to — `panel-edge`
rather than `edge-perf`, `--shadow-raised` rather than `--shadow-postcard`.
Every brand must fill **every** slot, including filling one with a stated
nothing (`@utility panel-edge { mask-image: none; }`) rather than an absence, so
`tokens.contract.test.ts` can tell "deliberately empty" from "forgotten".

What each brand puts in each slot is in its `BRAND.md`.

## Which component for which job

`src/components/ui/` is generated shadcn code. Treat it as vendored: editable,
but reviewed as such, and re-check it against the registry before hand-editing.

| Job | Component |
| --- | --- |
| Labelled text input with helper or error text | `ui/field.tsx` + `ui/input.tsx`. **Not** react-hook-form — shadcn's `form` requires it and every input here is a simple controlled value. |
| A menu hanging off a button | `ui/dropdown-menu.tsx`. The trigger is the anchor, so there is no `anchorEl` state to hold. |
| A choice from a list | `ui/select.tsx`, grouped with `SelectGroup`/`SelectLabel`. |
| Something floating that is not a menu | `ui/popover.tsx`. |
| A selectable tag | `ui/chip.tsx` — a real `<button>` with `aria-pressed`. |
| A tag that is not selectable | `ui/badge.tsx`. |
| A group of controls | `components/Panel.tsx`. |
| Severity message | `ui/alert.tsx` — `default`, `info`, `warning`, `destructive`. |
| Loading | `ui/spinner.tsx`. It carries `role="status"`; a bare spinning icon announces nothing. |
| A hint on hover | `ui/tooltip.tsx`. Note it needs the `TooltipProvider` in `main.tsx`, and that **a disabled control receives no pointer events**, so a tooltip on one will never fire. Offer the enabling action instead. |

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
- **The card must not inherit anything from the browser's default stylesheet.**
  This is the sharp edge of the rule above, and it drew blood: unlayered beats
  layered only where `App.css` *declares the property*. `.bingo-card-title` set
  nothing but `margin`, so its `<h3>` was rendering at the UA's 1.17em/bold —
  and a UA rule loses to any author rule. Adding Tailwind put
  `h1..h6 { font-size: inherit; font-weight: inherit }` in `@layer base`, and
  the card title silently dropped to 16px/400 on screen, in the PDF, in the PNG,
  and in the saved thumbnail simultaneously. The fix was to state the values the
  card was already rendering with. **Every property the card's appearance
  depends on must be declared in `App.css`, not inherited.**

`src/components/cardGrid.guard.test.ts` enforces the mechanical parts of this,
including that `CardGrid.tsx` renders only `div`, `span`, and `h3` — elements
with no UA typography left to lose — and that `.bingo-card-title` pins its own
`font-size` and `font-weight`.

### The marking layer is part of the frozen renderer

Trip play draws a translucent X over a marked square. That X is **inside** the
card, not over it — `.bingo-mark` and `.bingo-mark-stroke` are rendered by
`CardGrid.tsx` and styled in `App.css`, alongside everything else above.

That is not an implementation detail, it is the only thing that works.
`html-to-image` clones the `.bingo-card` node and `@media print` isolates that
same subtree, so anything drawn outside it does not exist to either consumer. An
overlay positioned over the card by a wrapper component would look correct on
screen and vanish from the PNG and the PDF — a broken feature that passes review.
So the renderer was extended deliberately, with the guard and this document
updated in the same change.

The rules the marking layer adds to the ones above:

- **Its colour is fixed, not themed, and cannot adapt to the card.** The stroke
  is a literal `rgba()` in `App.css`, for exactly the reason the `#ccc`/`#999`
  borders are literal. It would be tempting to derive it from the user's
  `cellColor` so it always contrasts — that would be application logic painting
  inside a card made of user data, and it would make the exported PNG depend on
  something the exporter cannot see. One colour, chosen to stay visible over
  both a light and a dark `cellColor`.
- **Translucency is a requirement, not a style choice.** The square's entry text
  must stay readable *through* the mark. That is the point of marking a card you
  then export and post somewhere: a reader has to see both what was spotted and
  that it was spotted. Raising the alpha until the mark "reads better" breaks
  the feature. Check it against a light and a dark `cellColor`, not just the
  default scheme.
- **It is two real spans, not `::before`/`::after` and not an SVG.**
  Pseudo-element serialization through `html-to-image` is precisely the class of
  silent export regression this whole section exists to prevent, and an SVG is a
  second rendering model inside a node that must serialize identically four
  ways. The tag allowlist bars the latter mechanically.
- **`@media print` must keep `print-color-adjust: exact` on the strokes.**
  Without it a browser may drop the fill and print a marked card as an unmarked
  one — silently wrong rather than obviously broken. The guard asserts the print
  rule keeps naming `.bingo-mark-stroke`.
- **A cell is interactive as a `div` with `role="button"`**, never a real button
  element, which would reintroduce the UA-typography exposure the tag allowlist
  exists to prevent and carry a UA background and border into the export.
- **An unmarked card renders exactly as it did before this layer existed.** No
  rule fires without `markedSlots`, so every card saved or exported before play
  mode is byte-for-byte unaffected. That invariant is what the checklist below
  asks you to verify with a before/after pair.

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

   Check this one properly rather than assuming, because it has already broken
   once. It used to hold by accident: the dark palette lived behind
   `@media (prefers-color-scheme: dark)`, which never matches while printing.
   Moving the theme to a `data-theme` attribute — which applies in *every*
   medium — made a dark-mode visitor print a near-black page. `@media print` in
   `App.css` now pins `color-scheme: light !important`, and
   `cardGrid.guard.test.ts` checks that it stays.

   Note that a screenshot will not show you this. The page fill is painted by
   the canvas, outside the cascade that hides everything else, so it appears
   only in the PDF. Inspecting the PDF's content stream for a full-page
   rectangle is the reliable check.
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
6. **A card carrying marks.** The gallery has partially- and fully-marked card
   states. Print and export one of each and confirm the X appears in the same
   positions as on screen, that the entry text underneath is still readable, and
   that the strokes survive the PDF — a marked card that prints unmarked is the
   specific failure `print-color-adjust: exact` is there to prevent. Then export
   an **unmarked** card and diff it against your pre-change copy: it must be
   unchanged. The marking layer is only correct if it costs nothing when there
   is nothing to mark.
7. **Keyboard.** Tab through the editor. Every control needs a visible focus
   ring. Dialogs must trap focus, restore it on close, and close on Escape.
   A playable card's cells are in the tab order and toggle on Enter and Space.
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
