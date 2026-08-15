## Why

The app is a general-purpose bingo card generator wearing a travel costume. The generator, the renderer, the export pipeline, the accounts layer, and the whole backend are subject-agnostic — what makes this Travel Bingo is a warm terracotta palette, five travel motifs, three suggestion categories about road trips and airports, and the word "Trip" on a handful of screens. That costume is thin, and it is the only thing standing between this codebase and a second audience.

Corporate meeting bingo is that second audience. It wants the same product with a different face: a deliberately boring enterprise theme, suggestion content drawn from meeting jargon rather than road-trip landmarks, and "Meetings" wherever Travel Bingo says "Trips". Nothing about how a card is built, randomized, printed, exported, saved, or shared changes at all.

The alternative is a fork, and a fork is the expensive answer disguised as the cheap one: every bug fix, every accessibility correction, every card-renderer guard would have to be applied twice, and the two copies would diverge within a month. Instead this change introduces a **brand seam** — a single, explicit boundary between "the product" and "how the product presents itself" — and then puts a second brand behind it. The seam is worth building even if the second brand never ships, because the work is almost entirely making implicit branding explicit: renaming four travel-flavoured design tokens by their role, moving the palette into a swappable file, and pulling ~25 varying strings into a typed object.

The seam is deliberately narrow. The card renderer, the stored card shape, the API, the DynamoDB key format, and every URL path stay **brand-invariant**. A card is a document made of user data; it does not get a brand any more than it gets a dark mode.

## What Changes

- **A build-time brand selection.** A validated `VITE_BRAND` value (`travel` | `corporate`) is injected as a compile-time literal, selecting one brand's design tokens, motif set, UI copy, suggestion content, and marketing metadata. Exactly one brand's assets reach the bundle; the build **fails loudly** on a missing or unrecognized value rather than silently shipping the wrong site to a bucket.
- **The design token layer splits into shared structure and per-brand values.** `frontend/src/index.css` becomes imports only; the brand-independent scaffolding (the dark variant, the `@theme` bridge, the base page paint, the reduced-motion rule) moves to `base.css`; the oklch palette, `--font-display`, `--radius`, and the motif utilities move to a per-brand file selected by a build-time alias.
- **Four travel-flavoured design tokens are renamed by role**, so components stop naming a picture and start naming a job: `--shadow-postcard` → `--shadow-raised`, `--ocean` → `--brand-accent`, `edge-perf` → `panel-edge`, `bg-map-grid` → `bg-page-texture`. This is the largest mechanical diff in the change and lands with **no visual change whatsoever**.
- **A motif *inventory* becomes a motif *slot list*.** DESIGN.md's five travel devices become five named slots — page texture, wordmark mark, panel edge, selectable chip, raised-surface shadow — that **every brand SHALL fill**, including filling one with a stated nothing. The "at most one motif per surface" rule is unchanged.
- **UI copy that differs between brands moves into a typed `BrandCopy` interface.** Not an i18n framework: a plain TypeScript interface, so a key missing from a brand is a compile error and there is no runtime lookup and no key-string typo class of bug. A string enters `BrandCopy` **only when the two brands' values actually differ** — `Save`, `PDF`, `Entries`, `Look & feel` stay inline.
- **Suggestion content becomes brand-supplied.** `src/data/suggested*.json` move under the travel brand; corporate gets its own categories (Standup, All-Hands, Client Call, Performance Review) and card themes (Slide Deck, Spreadsheet, Legal Pad, Redline).
- **A per-brand marketing surface.** `index.html` gains a description, Open Graph, Twitter card, canonical, and theme-color tags — none of which exist today — injected at build time from per-brand metadata, along with a per-brand `<title>` and favicon.
- **A second AWS stack.** Corporate dev and prod get their own S3 buckets, CloudFront distributions, DynamoDB tables, Cognito pools, Lambdas, and APIs — provisioned by the **existing, unmodified** root Terraform module under two new HCP workspaces. Isolation between brands uses exactly the mechanism that already isolates dev from prod.
- **Two new deploy environments**, wired through the existing reusable workflows.
- **PR-triggered CI becomes a prerequisite, not a nicety.** Today lint/test/build run only on the deploy path, which would mean *nothing ever builds the corporate brand except a production deploy*. The `ci.yml` already proposed in `add-branch-protection` must land with a build matrix over both brands.
- **Unchanged:** the signed-out editor, the zero-API-requests-on-load invariant, the frozen card renderer (`CardGrid.tsx` and `App.css` are not touched), the stored card shape and both contract tests, `backend/src/` in its entirety, the DynamoDB key format, every API route, and **every URL path** — corporate shows "Meetings" but still routes `/trips` and `/invite/:token`.

## Capabilities

### New Capabilities
- `brand-theming`: A build-time brand selection that varies the design token values, motif set, UI copy, suggestion content, and marketing metadata across otherwise identical deployments, while guaranteeing that exactly one brand reaches a build and that the card renderer, stored card shape, API, and URL paths remain brand-invariant.

### Modified Capabilities
- `app-visual-design`: The token system requirement gains the constraint that token *values* are brand-supplied while token *names and roles* are shared, and that every brand must define every token in both presentations — the drift that would otherwise be silent.
- `card-suggestions`: Bundled suggestion data becomes brand-scoped rather than global, and the fonts referenced by a brand's themes are constrained to the shared persisted-card allowlist.
- `deployment-pipeline`: The "two isolated environments" requirement generalizes to two environments **per brand**, with brand selection as a build input that is validated at build time and verified in the built artifact.
- `custom-domains`: Generalized from one hosted zone and one apex domain to one per brand.
- `ui-development-workflow`: Visual review is now per brand; the design document splits into shared rules and per-brand specifics; the gallery and card-renderer guards gain brand-awareness.

## Impact

- **Backend** (`backend/src/`): **no changes.** Verified: no hardcoded domains, no email templates, no seed data, no suggestion content, and no auth configuration in the Lambda (identity is established by the API Gateway JWT authorizer; `context.ts` reads only `TABLE_NAME`, `THUMBNAIL_BUCKET_NAME`, `AWS_REGION`). Brand isolation is stack isolation.
- **Frontend** (`frontend/src/`): a new `brand/` module (types, build-time selector, per-brand token CSS, motif CSS, copy, metadata, suggestion data); `index.css` split into `index.css` + `base.css`; the four token renames applied across `CardView`, `Panel`, `AppShell`, `SiteHeader`, `SuggestionsDialog`, `ui/chip`, `SavedCardsPage`, `SharedCardPage`, and the gallery's design samples; ~25 copy strings extracted; a `transformIndexHtml` plugin and brand aliases in `vite.config.ts`.
- **Trips UI** (`frontend/src/pages/Trip*.tsx`, `InvitePage.tsx`): roughly 40 user-facing occurrences of "trip" move to `brand.copy`, and the `Compass` icon becomes brand-selected. `add-trips` lands first and this change retrofits it — see design.md.
- **Infra** (`infra/`): the root module needs only a `brand` variable for cost-allocation tagging and a corrected `environment` default plus validation. **Every derived resource name already falls out of `bucket_name`**, so the second stack needs no new Terraform. `infra/bootstrap/` is the real work: its hardcoded two-entry environment map becomes a map variable, with existing keys and IAM role names preserved byte-for-byte.
- **CI/CD** (`.github/workflows/`): one new build env var in `_deploy.yml`, two new caller workflows, two new GitHub Environments, and the two-brand `ci.yml` build matrix.
- **Guards and tests**: three new contract tests (token parity across brands and presentations, copy/registry exhaustiveness, favicon-to-palette agreement); `check-bundle.mjs` extended to prove the right *single* brand shipped and to check `dist/index.html`; `cardGrid.guard.test.ts` gains one assertion that the card renderer never reads brand data; `capture.mjs` gains the brand in its output slug so a second brand's captures cannot silently overwrite the first's.
- **Contract tests**: `cardPayload.contract.test.ts` and `savedCard.contract.test.ts` are **unchanged** — the wire shape is brand-invariant.
- **No new runtime dependencies** in either package.
- **Two latent bugs surface and are fixed in passing**: `var.environment` defaults to `"production"` while `dynamodb.tf` gates deletion protection on `== "prod"`, and `bootstrap`'s GitHub-environment name and IAM role suffix are equal only by coincidence.
- **Out of scope**: runtime (per-hostname) brand switching, more than two brands, a shared cross-brand account or card library, any change to card generation, sharing, or the accounts model, per-brand URL paths, and Open Graph preview images (the tag is omitted rather than pointed at a missing asset).
