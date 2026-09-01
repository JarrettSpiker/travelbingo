# Office Lingo Bingo — brand specifics

The look: the beige-cubicle version of Travel Bingo's warmth, and it works
better the more convincing it is. Cool printer paper, the default corporate
blue, a highlighter, and a rubber stamp. **Nothing in the chrome winks at the
joke** — the content does that, and the contrast between a deadpan interface and
"You're on mute" is where the satire actually lives.

`frontend/DESIGN.md` holds the **rules**. This file holds only what is true of
*this* brand.

Files: `theme.css`, `motifs.css`, `copy.ts`, `meta.json`,
`suggestedCells.json`, `suggestedThemes.json`, `index.ts`.

## Palette

Cool is the whole idea, and it is the single change that stops this reading as
the same app with a different accent: the greys are hue-shifted **cool** (250°)
where the travel brand shifts them warm, in both presentations.

| Token | Light | Dark | Notes |
| --- | --- | --- | --- |
| `--background` | `oklch(0.975 0.004 250)` cool off-white | `oklch(0.21 0.012 255)` cool slate | Printer paper under fluorescent light. Slate, not navy. |
| `--primary` | `oklch(0.50 0.15 255)` corporate blue | `oklch(0.70 0.13 255)` | The default blue of every enterprise product ever shipped. Chosen for being unremarkable. |
| `--brand-accent` | `oklch(0.62 0.15 125)` highlighter green | `oklch(0.80 0.16 125)` | Pulled down from a true highlighter in light so it clears 3:1 as an icon; lifted to the real thing on slate, where it can be. |
| `--destructive` | `oklch(0.55 0.22 28)` flat alarm red | `oklch(0.70 0.19 28)` | No terracotta to be confused with here, so it can be the obvious red the action deserves. |
| `--info` | `oklch(0.53 0.09 212)` teal | `oklch(0.72 0.08 212)` | Teal, not blue. See the hazard below. |
| `--paper` | `oklch(1 0 0)` pure white | `oklch(0.27 0.012 255)` | Printer paper against the barely-off-white page. |
| `--stamp` | `oklch(0.45 0.14 310)` rubber-stamp violet | `oklch(0.74 0.13 312)` | See the hazard below. |

`--radius` is `0.25rem`, squarer than travel's `0.75rem`. Enterprise software
does not have soft corners. `--shadow-raised` is cool, tighter, and shallower —
a form lying on a desk rather than a postcard propped up.

### The pair to keep apart: `--stamp` and `--destructive`

The travel brand's terracotta/crimson collision does not disappear here, it
**transfers**. A blue primary retires that pair and creates a new one: the
obvious reading of a stamp is red ink, and this brand's `--destructive` is red.

Measured, a bureaucratic red stamp against this destructive red came out at
**1.18:1** — indistinguishable, on the chip and the alert surfaces both.

So `--stamp` is **violet**, a deliberate departure from the "bureaucratic red"
the design proposed. It is the authentic answer as well as the safe one: aniline
stamp pads are the reason every RECEIVED and every date stamp in an office is
purple. 282° of hue from `--destructive`, and 7.43:1 on the page, so it still
carries the chip's 12px lettering.

### The other pair: `--primary` and `--info`

A second saturated blue five degrees from `--primary` reads as the same colour
at a glance, so `--info` is pushed to teal — 43° of separation. An info alert
should not look like a primary action.

### Measured contrast

Every value was re-derived against this palette rather than inherited. Light /
dark: foreground on background 14.5 / 14.4, muted-foreground 5.6 / 6.9, primary
5.7 / 6.6, destructive on card 5.4 / 5.5, stamp on background 7.4 / 7.3,
brand-accent 3.3 / 9.8, info on card 4.8 / 5.6. All in sRGB gamut.

## Typeface

`--font-display` is the **system stack**, and `theme.css` imports no font at
all. Cheaper than a webfont, and exactly the joke: whatever the visitor's OS
thinks a UI font is, is precisely right for a product that looks like it was
specified by procurement.

## Motif slots

| Slot | Realization | Where |
| --- | --- | --- |
| Page texture | Spreadsheet cell ruling — the travel graticule SVG with the ticks deleted, at 96×40 so the aspect ratio reads as a spreadsheet rather than graph paper | `AppShell`, via `bg-page-texture` |
| Wordmark mark | `TrendingUp` — the hockey-stick growth chart | `SiteHeader` |
| Panel edge | Three-hole-punch binder edge: three fixed holes down the left, `mask-repeat: no-repeat` | `CardView`, via `panel-edge` |
| Selectable chip | "APPROVED" rubber stamp: dashed, `-rotate-2`, uppercase, `--stamp` ink | `ui/chip.tsx` |
| Raised surface | Cool grey-blue shadow, tighter and shallower than travel's | `--shadow-raised`, anywhere |

Both CSS motifs are the travel brand's own techniques with the imagery swapped,
which is the best evidence the slots were named for the right thing: neither
`AppShell` nor `CardView` changed a line.

The trip icon is `CalendarDays` — for the thing that recurs whether or not
anyone wants it.

## Words

The noun is **meeting**, not "meeting series". Both were considered: the thing
really is a series, but "meeting series" is four syllables that has to survive
every sentence in the app, and the possessive ("a meeting series's mode") is
unsayable. "Meeting" is what someone would actually call it, and the satire
lands harder for being plain.

The register is the joke: this brand says "stakeholders" where the travel brand
says "friends", "attendees" where it says "members", and "has concluded" where
it says "has ended". Nothing is written with a smile.

## Content

Four categories — Standup, All-Hands, Client Call, Performance Review — and six
themes: Slide Deck, Spreadsheet, Legal Pad, Whiteboard, Redline, Q4 Earnings.

The themes carry raw hex, which is correct: they are card content, not app
chrome, and the card is outside the brand seam. **Every font they name must come
from the shared allowlist** (`FONT_OPTIONS` in `src/lib/fontScheme.ts`, held
byte-identical to the backend's `ALLOWED_FONTS`) — a theme naming anything else
makes the card unsaveable with a 400 arriving far from the cause.
`brand.contract.test.ts` checks this.
