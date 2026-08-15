## Context

The travel identity is spread across four places, and only one of them is large:

- **Three literal strings.** `index.html`'s `<title>`, the wordmark text and `MapPin` icon in `SiteHeader.tsx`, and `public/favicon.svg`. That is the entire branding surface as such — everything else matching "travel" in the frontend is a localStorage key or a CSS class name.
- **The token layer.** `frontend/src/index.css` holds an oklch palette, `--font-display`, `--radius`, two motif `@utility` definitions (`edge-perf`, `bg-map-grid`), and four travel-named tokens (`--ocean`, `--paper`, `--stamp`, `--shadow-postcard`) that components consume **by name**. This is the bulk of the work.
- **Suggestion content.** `src/data/suggestedCells.json` and `suggestedThemes.json`, loaded statically through `src/lib/suggestions.ts`'s defensive normalizer.
- **Trips copy.** ~40 hardcoded user-facing "trip" strings across the four trip pages and the header nav entry.

Three structural facts constrain every decision below:

1. **Tailwind v4 is configured entirely in CSS.** There is deliberately no `tailwind.config.js` and no PostCSS pipeline (`vite.config.ts` and `index.css` both say so). A palette therefore **cannot** come from a TypeScript object; brand colour must be CSS that the build selects.
2. **`App.css` is unlayered and the card renderer is frozen.** Unlayered rules beat anything in an `@layer`, which is what makes the card immune to app styling. The card is user data feeding four consumers (screen, print PDF, PNG export, saved thumbnail). It is outside the brand seam, permanently.
3. **`infra/`'s `local.resource_name` already derives every resource name from `bucket_name`**, and both the DynamoDB table and the Cognito user pool carry `prevent_destroy = true`.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals**
- One explicit seam between the product and its presentation, with **exactly one brand** in any given build, proven mechanically rather than assumed.
- Make brand drift a **compile error or a test failure** wherever it structurally can be — a missing copy key, a token defined in one brand and not the other, an unfilled motif slot, the wrong brand in a bundle.
- Add the second stack using the *existing* environment-isolation mechanism, with **zero diff on any existing AWS resource**.
- Keep the card renderer, the stored card shape, the API, the key format, and the URL paths brand-invariant.
- Leave the travel site byte-identical through the refactor phases, so each is independently revertible.

**Non-Goals**
- Runtime brand switching by hostname. Both brands' assets would ship to every visitor and the two domains would share a cache. Rejected at proposal time.
- A third brand. The design generalizes, but nothing here is built speculatively for one.
- Any shared state between brands — no shared accounts, cards, share links, or Cognito pool.
- Per-brand URL paths. See the decision below.
- An i18n framework. There is one locale; the problem is brand variance, not language.
- Changing card generation, sharing, accounts, or anything in `backend/`.

## Decisions

### Decision: Brand is a build-time literal injected by `define`, selected with a ternary

`vite.config.ts` validates `VITE_BRAND` against a closed list and injects it with `define`:

```ts
const BRAND_IDS = ["travel", "office"] as const;
const brandId = env.VITE_BRAND || (command === "serve" ? "travel" : undefined);
if (!BRAND_IDS.includes(brandId)) throw new Error(`VITE_BRAND must be one of ${BRAND_IDS}`);
// ...
define: { "import.meta.env.VITE_BRAND": JSON.stringify(brandId) },
```

Required for `vite build`, defaulted for `vite dev` — a fresh clone with no `.env.local` still works, which is an existing invariant, while a misconfigured CI build fails instead of shipping travel assets to the office bucket.

`src/brand/index.ts` selects with a **ternary, not a map lookup**:

```ts
export const brand: Brand =
  import.meta.env.VITE_BRAND === "office" ? officeBrand : travelBrand;
```

Two details that look like style and are not. First, `define` rather than bare `import.meta.env.VITE_BRAND`: Vite only substitutes env keys that are actually present, so an unset variable leaves a runtime property access — and both brands ship. Second, a ternary rather than `Record<BrandId, Brand>`: an object literal references both arms and defeats dead-code elimination.

The exhaustiveness check that a `Record` would have given is recovered without the cost: `src/brand/registry.ts` holds `{ travel, office } satisfies Record<BrandId, Brand>` and is imported **only by tests**, so it never enters the production graph. A test asserts the ternary in `index.ts` covers every key in the registry, in the same source-reading style as the existing `coverage.test.ts`.

This is the same argument, and the same mechanism, the repo already uses for the dev gallery — which is likewise dropped by DCE and likewise *proven* dropped by `scripts/check-bundle.mjs` rather than trusted.

**Alternative considered:** a Vite `resolve.alias` for the TypeScript side too, giving true per-brand module resolution. Rejected — it would duplicate a path mapping across `vite.config.ts` and `tsconfig.app.json`, a hazard both files already warn about by name, and it would mean `tsc -b` typechecks only the selected brand, deferring drift to whenever the other brand is next built. With `define`, both brands typecheck on every build.

### Decision: `index.css` becomes imports only; brand CSS arrives through an alias

```css
@import "tailwindcss";
@import "#brand-theme";
@import "#brand-motifs";
@import "./base.css";
```

`src/base.css` takes everything brand-independent that lives in `index.css` today — `@custom-variant dark`, the `@theme inline` bridge, the `html {}` base paint, `.emoji-picker-themed`, the reduced-motion kill switch, and the prose comments that make the file worth reading. `src/brand/<id>/theme.css` holds the `:root` and `[data-theme="dark"]` blocks, `--font-display`, and `--radius`; `src/brand/<id>/motifs.css` holds that brand's `@utility` definitions.

**`index.css` containing nothing but imports is load-bearing.** CSS requires `@import` to precede all other rules, so any `:root` block left behind would sit *after* the brand import and win.

`#brand-theme` and `#brand-motifs` are `resolve.alias` entries pointing at the selected brand's files. This works because `@tailwindcss/vite` builds its `customCssResolver` from Vite's own resolver, so aliases apply inside the Tailwind CSS graph and `onDependency` registers the result for HMR. That is the linchpin of this plan and it is **verified by code-reading, not assumed** — task 1.1 proves it with a throwaway spike before anything is built on it.

`components.json` needs no change: `src/index.css` still exists and is still the Tailwind entry. But `npx shadcn add` writes new `:root` tokens into it, which would now land ahead of the brand import — so `tokens.contract.test.ts` asserts that neither `index.css` nor `base.css` declares any brand-owned custom property, forcing a shadcn-added token to be moved into **both** brand files.

**Fallback if the spike fails:** a ~15-line local Vite plugin whose `transform(code, id)` rewrites the two `@import` lines when `id` ends with `src/index.css`. Zero resolver assumptions. A distant third option — shipping both palettes scoped by a `data-brand` attribute — is recorded only to be rejected: it reintroduces brand bleed, which is the failure this design exists to prevent.

### Decision: The data/CSS split has exactly one rule

A value lives in the TypeScript `Brand` object if a React component needs to **read** it; it lives in CSS if a stylesheet needs to **apply** it. Nothing appears in both.

| TypeScript (`Brand`) | CSS (`theme.css`, `motifs.css`) |
| --- | --- |
| `name`, `storagePrefix`, `MarkIcon` | every oklch token, light and dark |
| every varying copy string | `--font-display`, `--radius`, `--shadow-raised` |
| suggestion data (card content) | `@utility panel-edge`, `@utility bg-page-texture` |
| `meta` (title, description, hexes) | |

`MarkIcon` as a component inside a data object is fine: `lucide-react` ships per-icon ESM, so the unused one is dropped.

### Decision: Motifs are named by role, so brands cannot silently omit one

Renaming is the whole trick. A component that asks for `edge-perf` is asking for a picture and a second brand has nothing to give it; a component that asks for `panel-edge` is asking for a job every brand must do.

| Today | Becomes | Consumers |
| --- | --- | --- |
| `@utility edge-perf` | `@utility panel-edge` | `CardView.tsx` |
| `@utility bg-map-grid` | `@utility bg-page-texture` | `AppShell.tsx` |
| `--shadow-postcard` | `--shadow-raised` | `index.css`, `CardView.tsx`, DESIGN.md |
| `--ocean` / `--color-ocean` | `--brand-accent` | `index.css`, `AppShell.tsx`, `SuggestionsDialog.tsx` |

`--paper` and `--stamp` are already role-named and survive unchanged.

Five slots, each bound to one surface, each of which **every brand must fill** — including filling one with a stated nothing (`@utility panel-edge { mask-image: none; }`) rather than an absence, so the parity guard can see it. DESIGN.md's "at most one motif per surface" rule is untouched.

| Slot | Travel | Office |
| --- | --- | --- |
| Page texture | map graticule with crossing ticks | spreadsheet cell ruling — the same 64px grid SVG with the tick paths deleted |
| Wordmark mark | `MapPin` (a luggage tag) | `TrendingUp` — the hockey-stick growth chart |
| Panel edge | perforated postcard, holes top and bottom | three-hole-punch binder edge — same `radial-gradient` mask, three holes down the left, `mask-repeat: no-repeat` |
| Selectable chip | passport stamp: dashed, `-rotate-2`, uppercase | "APPROVED" rubber stamp: dashed, `-rotate-1`, uppercase, `--stamp` set to bureaucratic red |
| Raised surface | warm two-stop shadow | cool grey-blue, tighter radius |

Four of the five are already a token or a `@utility`, so they generalize for free once renamed. Only the wordmark mark is a component-level swap. That is the best evidence available that this scope is genuinely small.

**Office palette direction:** the satire is that it is the beige-cubicle version of the travel site's warmth, and it works better the more convincing it is. A faintly cool printer-paper off-white page rather than warm cream; the flat "we used the default blue" corporate blue as `--primary`; highlighter yellow-green as `--brand-accent`; bureaucratic red as `--stamp`; cool slate rather than warm navy in dark.

**A contrast hazard transfers rather than disappears.** DESIGN.md warns that terracotta `--primary` and crimson `--destructive` are confusable. A blue primary retires that conflict and creates a new one: red `--stamp` against `--destructive`. This is the archetype of a per-brand value that must be *re-derived* rather than inherited, and it is precisely what the token guard cannot catch — the guard checks presence, never value. A human checks it once per brand.

### Decision: Copy is a typed interface, and a string qualifies only when the brands differ

```ts
export interface BrandCopy {
  readonly noun: {
    readonly trip: string;  readonly trips: string;   // "trip"  / "meeting series"
    readonly Trip: string;  readonly Trips: string;   // "Trip"  / "Meeting series"
  };
  readonly nav: { readonly trips: string };
  readonly trips: { /* newTitle, editTitle, detailsPanel, emptyTitleError, createCta, backLink, notFound, modeHint */ };
  readonly editor: { readonly titlePlaceholder: string };
  readonly share: { readonly fallbackCardName: string };
  readonly exportFile: { readonly defaultPngName: string };
  readonly tagline: string;
}
```

`tsc -b` enforces both directions: a key in the interface but missing from a brand is a compile error, and a key in a brand but not the interface is an excess-property error. There is no runtime lookup, therefore no "missing key" runtime failure and no key-string typo. Jump-to-definition works. A recursive key-set comparison in `brand.contract.test.ts` is belt-and-braces for anything the interface makes optional.

Capitalized variants are **explicit keys, not a `capitalize()` helper** — `"all-hands"` → `"All-hands"` is not a rule worth letting a helper guess at.

**The rule that stops this metastasizing, to be written into `AGENTS.md`:** *a string enters `BrandCopy` only when the two brands' values actually differ.* `Save`, `Cancel`, `PDF`, `PNG`, `Add selected`, `Entries`, `Look & feel`, `Card details` are identical in both brands and stay inline. That keeps the object near 25 keys rather than 300. The failure mode being avoided is turning every component into an indirection with no payoff.

**Alternative considered:** an i18n library with a message catalogue. Rejected — there is one locale, and the machinery would trade a compile-time guarantee for a runtime lookup and a class of key-typo bugs that does not currently exist.

### Decision: URL paths stay brand-invariant; `ROUTES` makes that reversible

The office brand renders "Meetings" and still routes `/trips`, `/trips/new`, `/trips/:tripId`, `/invite/:token`. Route paths, `tripApi.ts`, `tripTypes.ts`, the `TRIP#` key prefix, and `POST /api/trips` stay `trip` in every brand. Only user-visible text varies.

Invite and share links are **persisted capability URLs**. A brand-dependent path makes every already-minted link a function of the brand that minted it, which is a broken-link class of bug for no user benefit. Per-brand paths would also mean a second `AppRoutes` to review and per-brand capture invocations.

The hedge costs about twenty lines: a `src/lib/routes.ts` exporting `ROUTES = { editor: "/", cards: "/cards", trips: "/trips", … } as const`, used at every `NavLink to` / `navigate()` / `signIn()` site instead of a literal. If `/meetings` is ever wanted, it becomes one file rather than twenty call sites.

### Decision: `bucket_name` stays the stack discriminator — brand never enters `resource_name`

The instinct is a `brand` variable feeding `local.resource_name`. It must be resisted. `resource_name` currently equals `bucket_name` and names the DynamoDB table, the Cognito user pool, the Lambda, and the API. **The table and the pool both carry `prevent_destroy = true`**; changing the formula would make the existing prod apply hard-fail, and forcing past it would be a data-loss event that changes every `sub` and orphans every saved card.

So the second stack simply sets `bucket_name = "officelingobingo-{dev,prod}"` with `name_prefix = ""`, and every derived name — table, pool, Lambda, API, thumbnail bucket, OAC, security-headers policy, CSP, log groups — falls out correctly with **zero diff on any existing resource**. `apigateway.tf`, `lambda.tf`, `dynamodb.tf`, `cognito.tf`, `dns.tf`, and `outputs.tf` need no changes at all. The CSP in particular is already fully derived from `local.thumbnail_bucket_name` and `local.cognito_auth_domain`, so a second brand gets a correct one for free.

`var.brand` is added for **one purpose only**: `local.tags.Project`, so that with two stacks in one account the AWS cost allocation report can answer "what does the office site cost". It touches no resource name.

**`var.environment` is not overloaded with brand.** It has exactly two meaningful values and three `==` comparisons depend on it — the Cognito `ALLOW_ADMIN_USER_PASSWORD_AUTH` flow, the localhost callback URL, and DynamoDB deletion protection. A value like `office-dev` would silently get prod-like Cognito flows and no deletion protection. Brand is a separate axis, carried by `bucket_name`.

**A latent bug surfaces here and is fixed in passing:** `var.environment` defaults to `"production"` while `dynamodb.tf` gates deletion protection on `== "prod"`. If the live prod workspace does not set it explicitly, **production deletion protection is currently off**. Adding `validation { contains(["dev","prod"], …) }` and correcting the default surfaces that, which is the point.

### Decision: Bootstrap's environment map becomes a map variable, with existing keys frozen

`infra/bootstrap` hardcodes a two-entry `local.envs` built from `var.dev_*`/`var.prod_*`. It becomes:

```hcl
variable "environments" {
  type = map(object({
    bucket             = string
    workspace          = string
    role_name_prefix   = string
    github_environment = string
  }))
}
```

Three constraints, each of which bites if ignored:

- **The existing map keys stay `dev` and `prod`.** `for_each` keys are part of the resource address (`aws_iam_role.tfc["dev"]`), so preserving them makes `terraform plan` show additions only — no destroy/recreate of roles whose ARNs are already pasted into HCP and GitHub configuration. New keys are `office-dev` and `office-prod`.
- **`github_environment` becomes an explicit field.** Today `gha-roles.tf` builds the OIDC subject from `each.key` while `tfc-roles.tf` builds role names from `role_suffix`; the two are equal **by coincidence**. New entries where they differ would silently produce a role nothing can assume.
- **`role_name_prefix` becomes a field**, defaulted to `travelbingo` for the existing entries so `travelbingo-{tfc,gha,lambda}-{dev,prod}` are unchanged. Renaming a live role breaks the running deploys.

The new HCP workspaces go in the **existing** HCP project. `hcp_project_name` is embedded in the OIDC subject claim, so a new project needs a per-entry field and a rename would silently break all four trust policies until bootstrap is re-applied.

### Decision: Four explicit workflow files, not a matrix

`_deploy.yml` gains one line (`VITE_BRAND: ${{ vars.VITE_BRAND }}`); `_deploy-backend.yml` gains nothing. Two new callers — `deploy-office-dev.yml` and `deploy-office-prod.yml` — mirror the existing pair at roughly twenty lines each, with their own concurrency groups so the brands do not serialize behind one another.

A `strategy: matrix` over the reusable-workflow callers would be fewer lines and is the wrong trade:

1. `needs: backend` waits for the **entire** matrix, so an office backend failure would block the travel frontend deploy. The stacks are independent; the failure isolation should be too.
2. Prod is `workflow_dispatch` behind a per-Environment review gate. A matrix puts both brands behind one approval — the opposite of what is wanted when promoting one brand and not the other.
3. Matrix jobs collapse in the Actions UI, making "which brand failed" harder to see.

The reusable workflows already hold all the logic; twenty lines of wiring per environment is not duplication worth eliminating.

### Decision: PR CI is a prerequisite, not a nicety

Today lint, test, and build run **only on the deploy path**. A build exercises only the selected brand's CSS graph and copy — which means that without PR CI, **nothing would ever build the office brand except a production deploy.** The `ci.yml` already proposed and unimplemented in `openspec/changes/add-branch-protection/` must land with this change, with a build matrix over both `VITE_BRAND` values. This change depends on it rather than re-proposing it.

### Decision: Marketing metadata is JSON, injected by a local `transformIndexHtml` plugin

Per-brand `<title>`, description, Open Graph, Twitter card, canonical, and theme-color tags come from `src/brand/<id>/meta.json`, read by a small plugin in `vite.config.ts`.

**JSON rather than TypeScript** because `vite.config.ts` runs in Node and must read the same data the app reads; `src/brand/<id>/index.ts` imports `lucide-react`, so importing it from the config would drag React into config load. `meta.json` has no import graph, is `JSON.parse`d in the config, imported normally by the app, and typed with `satisfies BrandMeta` — the same pattern the repo already uses for suggestion data.

**Not `%VITE_*%` replacement**, which would require `VITE_BRAND_TITLE`, `VITE_BRAND_DESCRIPTION`, and so on as GitHub Environment variables — spreading brand data into CI configuration, which is exactly the drift the brand module exists to prevent.

`og:url` and `canonical` derive from the existing per-environment `VITE_APP_ORIGIN`, and are **omitted** when it is unset rather than emitting a broken absolute URL. The `og:image` tag is likewise omitted until a preview image exists.

Favicons ship as `public/favicon-{travel,office}.svg`. The other brand's ~2 KB SVG lands in `dist/`, which is a better price than per-brand `publicDir` gymnastics (Vite supports exactly one).

**This closes an existing gap.** `public/favicon.svg` carries a comment saying its hexes are the sRGB resolution of `--primary`/`--primary-foreground` and must be "kept in step by hand". Putting `markHex`/`markFgHex` in `meta.json` and asserting each favicon SVG contains both strings converts that comment into a test. It does not verify the hex matches the oklch — that needs a colour library — but it catches the palette moving without the favicon following, which is the failure that actually happens.

### Decision: DESIGN.md is not parameterized; brand specifics move to their own file

`frontend/DESIGN.md` is good *because* it is specific — "Sun-faded terracotta — a vintage luggage tag", "warm shadows, never black". Rewriting it into slots-and-two-columns would make both halves mushy.

Instead it keeps the **rules**: one motif per surface, the token *role* table (what `--primary` is for, not what colour it is), the spacing and type scales, focus, depth, the frozen-renderer section, and the export checklist. Each brand's **specifics** move to `src/brand/<id>/BRAND.md`. DESIGN.md stays a sharp document about a system; each BRAND.md stays a sharp document about a look.

### Decision: `add-trips` lands first and is retrofitted

`add-trips` landed while this proposal was being written (`85e57a7`, `21ec600`, `8c29676`). `TripsPage.tsx`, `TripFormPage.tsx`, `TripDetailPage.tsx`, `InvitePage.tsx`, the routes registration, and the header nav entry are all committed, carrying roughly **40 distinct hardcoded user-facing "trip" strings** and a travel-flavoured `Compass` icon.

So the retrofit is the decided path, and it was the right call regardless: pausing in-flight work for a change not yet written would have cost more. Two things follow. The retrofit is the **largest single copy task** in this change and should be estimated as such rather than as a footnote — it is phase 3.2 on its own. And it is a **one-time** cost: once those pages read `brand.copy`, subsequent Trips work inherits the seam for free.

The discipline that makes it tractable is the naming rule: **`trip` is the code word, `brand.copy.noun` is the display word.** Of the ~150 `trip` references across those four files, only the user-facing subset moves. Component names, file names, `tripApi.ts`, `tripTypes.ts`, the `TRIP#` key prefix, `POST /api/trips`, and every route path stay `trip` in every brand — renaming those would mean a per-brand backend, per-brand API Gateway routes, and per-brand key formats, all excluded by the stack-isolation decision.

## Risks / Trade-offs

- **Visual review doubles, and no machine can help.** The repo has no component tests, no jsdom, and no visual diffing by design — "looking at it is the check". The matrix goes from 4 captures to 8 per route. The realistic failure is a reviewer checking one brand and assuming the other. → Every guard here catches *structural* drift; none catches "office's `--primary` fails contrast against `--secondary` on a disabled button". Mitigated by making brand review an explicit definition-of-done item and by `capture.mjs` putting the brand in its output slug so the two runs cannot be confused.
- **The alias mechanism is the single point of failure for the whole CSS plan.** → Proven by a throwaway spike in task 1.1, before anything is built on it, with a documented `transform`-hook fallback.
- **Dead-code elimination is load-bearing and silent when it regresses.** → `check-bundle.mjs` asserts the other brand's name is absent from `dist/`, extending the mechanism already used for the dev gallery.
- **`npx shadcn add` now has a manual step** — new tokens land in `index.css` and must be relocated into both brand files. → Guarded by `tokens.contract.test.ts`, but it is a recurring tax on every component addition.
- **The Google OAuth consent screen is user-visible at sign-in.** An Office Lingo Bingo visitor asked to grant access to "Travel Bingo" is a trust-destroying bug that no test can catch. → A separate Google Cloud project with the correct app name, support email, and logo, called out as an explicit task rather than a footnote.
- **Backend deploy fan-out.** A backend fix now needs four Lambda deploys, and nothing detects "travel prod is on v37, office prod on v35". → Accepted for now; a scheduled workflow comparing `CodeSha256` across the four functions is ~15 lines if it becomes real.
- **Terraform blast radius.** Both dev workspaces watch the same repo, so an `infra/` push auto-applies to two stacks. → Consider plan-only on the office dev workspace initially.
- **A user of both sites has two unrelated accounts.** → That is the isolation decision, not an accident, but it will generate support questions.
- **Cognito's free-MAU allowance is per pool but AWS has restructured user-pool pricing into tiers**, so a pool created now may land on a different tier than the existing ones. → Verify in the console before applying; at hobby MAU it will almost certainly still round to zero. Everything else in the second stack is serverless and pay-per-request; the real recurring cost is the hosted zone at ~$0.50/month plus the `.com` registration.

## Migration Plan

Additive and reversible throughout. Phases 1–3 ship to the **live travel site with no user-visible change**, which is what makes each independently revertible and what proves the mechanism in production before any of it is depended on.

1. **Spike** the alias resolution and the DCE drop. Everything downstream depends on the two answers.
2. **Rename to roles, one brand.** Split the CSS, rename the four tokens, add the brand module with one populated arm, move the suggestion data, add the parity guards (they pass trivially with one brand — the point is that they exist and will fail the moment a second arrives). Done when `npm run capture` output is identical to a pre-change copy and the export regression checklist passes, since `--shadow-raised` touches `CardView`.
3. **Extract copy**, including the Trips retrofit once `add-trips` has landed. Add `src/lib/routes.ts`.
4. **Marketing surface.** The plugin, `meta.json`, the favicon rename, the injected tags. Independently valuable — the travel site gains a description and OG tags it does not have today.
5. **Build the office brand, frontend only, nothing deployed.** Tokens, motifs, copy, suggestion content. Land the two-brand `ci.yml`. Review both brands locally and iterate. **This is where the design is judged, with zero infrastructure committed and zero cost incurred** — if the office brand does not land creatively, work stops here having spent only the refactor, which was worth doing anyway.
6. **Infrastructure.** Register the domain and hosted zone; generalize and apply bootstrap with admin credentials; create the Google project and both OAuth clients; fix `var.environment`; add `var.brand`; create and apply the two HCP workspaces.
7. **CI/CD and go live.** The two caller workflows, the two GitHub Environments, then dev end-to-end and prod.

Rollback: phases 2–5 are ordinary commits against a single-brand build and revert cleanly. Phase 6 onward, rollback is destroying the office workspaces — which is safe precisely because nothing is shared. The travel stack is never modified at any point.

## Open Questions

- **Cognito user-pool pricing tier** for a pool created today. Verify in the console before applying; it is the only cost line that could surprise.
- **Whether the live `travelbingo-prod` HCP workspace sets `environment = "prod"` explicitly.** If it does not, prod deletion protection is off today and the validation added in phase 6 will surface it. Worth checking before, not during, the apply.
- **The office brand's suggestion content is a first draft.** The categories (Standup, All-Hands, Client Call, Performance Review) and cells are proposed in tasks.md and are expected to be revised during phase 5 review; they need no spec change.
- **Whether `/meetings` is eventually wanted** for the office site. Deferred, and cheap to revisit because of `src/lib/routes.ts`.
