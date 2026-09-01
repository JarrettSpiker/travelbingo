# Travel Bingo — brand specifics

The look: a sun-faded travel poster. Warm cream paper, terracotta ink, ocean
teal as the second voice.

`frontend/DESIGN.md` holds the **rules** — what each token role is for, the
motif slots and the one-motif-per-surface constraint, spacing, type, depth,
focus, the frozen renderer, and the export checklist. This file holds only what
is true of *this* brand. Neither restates the other.

Files: `theme.css` (token values), `motifs.css` (the CSS motif slots),
`copy.ts`, `meta.json`, `suggestedCells.json`, `suggestedThemes.json`,
`index.ts`.

## Palette

Warmth is the whole idea, and it is carried by one value: `--background` is a
warm cream, not white, so the white card has something to sit *on*. The greys
are hue-shifted warm (60–80°) throughout, because neutral grey is what makes an
app look like every other app.

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--background` | `oklch(0.975 0.012 85)` warm cream | `oklch(0.22 0.02 260)` ink navy | Never white, never pure black. |
| `--primary` | `oklch(0.57 0.17 35)` sun-faded terracotta | `oklch(0.70 0.15 38)` | A vintage luggage tag. Dark lifts it — the light value is too dark to read as a fill on navy. |
| `--brand-accent` | `oklch(0.52 0.11 200)` ocean teal | `oklch(0.72 0.10 200)` | The travel-poster complement to terracotta. Dark enough to read as text. |
| `--destructive` | `oklch(0.52 0.20 25)` deep crimson | `oklch(0.70 0.17 25)` | See the hazard below. |
| `--paper` | `oklch(0.99 0.01 85)` | `oklch(0.28 0.022 258)` | The card preview panel only. |
| `--stamp` | `oklch(0.50 0.13 30)` muted terracotta | `oklch(0.72 0.12 32)` | Dark enough to clear 4.5:1 as the chip's 12px lettering, not just as a rule. |

### The pair to keep apart: `--primary` and `--destructive`

Terracotta and crimson are close in hue and confusable at a glance, which
matters when the destructive action is "delete a saved card". Two mitigations,
both in place and both worth keeping: crimson is pushed deeper and
higher-chroma than a default red, and **destructive actions use a ghost or
outline treatment**, never a solid fill beside a solid primary.

This is the pair *this* brand has to re-derive. A different palette has a
different one — see `../office/BRAND.md`, where a blue primary retires this
collision and creates another.

## Typeface

`--font-display` is **Outfit Variable**, one variable file, imported by
`theme.css` — app chrome only, and only for headings. Body text stays on the
system stack, which costs nothing to download.

The five `@fontsource` families in `main.tsx` are *card-content choices offered
to the user*. Keeping the two sets apart is the point: reusing a card font for
chrome would blur the line between "your card" and "the app".

## Motif slots

| Slot | Realization | Where |
| --- | --- | --- |
| Page texture | Map graticule — a 1px grid with a tick at each crossing, 64×64 | `AppShell`, via `bg-page-texture` |
| Wordmark mark | `MapPin` — a luggage tag | `SiteHeader` |
| Panel edge | Perforated postcard edge, holes along the top and bottom | `CardView`, via `panel-edge` |
| Selectable chip | Passport stamp: dashed, `-rotate-2`, uppercase, `--stamp` ink | `ui/chip.tsx` |
| Raised surface | Warm two-stop shadow, low opacity, never black | `--shadow-raised`, anywhere |

The trip icon is `Compass` — wayfinding, for the thing you travel with people
on. It is deliberately not the wordmark mark: the mark is the product, the trip
icon is one object inside it.

## Words

The noun is **trip** (`brand.copy.noun`). The register is warm and plain —
"friends", "an event", "gather".

## Content

Suggestion categories are road-trip and airport flavoured; themes are named for
places and seasons. Both are ordinary card content, so they carry raw hex rather
than tokens — the card is user data and is outside the brand seam entirely.
