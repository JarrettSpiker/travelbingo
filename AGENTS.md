# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo.

## Git operations require approval

**Never run `git commit`, `git push`, `git tag`, `git revert`, `git reset`,
`git rebase`, or any other command that rewrites history or shares changes with
a remote without explicit approval from the repo owner.** This includes
amending, force-pushing, creating branches that you then push, opening PRs, or
"tidying up" uncommitted work into a commit.

Stage files for review (e.g. leave changes in the working tree or show a diff)
and stop. Summarize what you changed and ask before doing anything that would
publish it. Treat every commit-to-main as an auto-deploy to dev.

## Project overview

Bingo Card Generator: a webapp that turns a list of words or phrases into
randomized, printable bingo cards.

**Card generation is entirely client-side and account-free.** Everything needed
to build, randomize, print, and share a card runs in the browser, and cards can
still be shared by encoding their whole state into a URL.

Accounts are **strictly additive** on top of that. Signed-in users can save
cards and mint revocable share links, backed by a small serverless API. The app
must remain fully usable signed out — see the architectural constraints below.

Originally built from the OpenSpec change in
`openspec/changes/add-bingo-card-generator/`; accounts were added by
`openspec/changes/add-user-accounts/`.

## Repository layout

- `frontend/` — React 19 + TypeScript + Vite app. All card-generation and
  rendering logic lives here.
  - `src/lib/` — pure, framework-agnostic logic (`bingo.ts`, `cardUrl.ts`,
    `colorScheme.ts`, `fontScheme.ts`), each with a co-located `*.test.ts`.
  - `src/components/` — React components. `src/components/ui/` is generated
    shadcn/ui code, treated as vendored.
  - `src/index.css` — the Tailwind entry. **Imports only** — see the brand seam
    below.
  - `src/base.css` — the brand-independent style layer: the dark variant, the
    `@theme inline` token bridge, the base page paint, the reduced-motion rule.
  - `src/brand/` — the brand seam. One brand is selected at build time by
    `VITE_BRAND`; `src/brand/<id>/` holds that brand's token values, motif
    realizations, copy, suggestion data, and marketing metadata.
  - `src/dev/` — the component gallery at `/ui`. **Dev-only**: guarded by
    `import.meta.env.DEV` behind a dynamic import, so it is dropped from
    production builds. Never import it from application code.
  - `scripts/capture.mjs` — screenshots and print-PDFs of the running dev
    server, via headless Chrome over the DevTools Protocol. Node built-ins only.
    `npm run capture -- /ui`. Output is prefixed with the brand, so pass
    `VITE_BRAND` to match the server it is pointed at.
  - `DESIGN.md` — the shared visual *rules*, the review loop, and the export
    checklist. Each brand's palette, typeface, and motif realizations live in
    `src/brand/<id>/BRAND.md`.
- `backend/` — Node 22 TypeScript Lambda behind an API Gateway HTTP API. Owns
  saved cards and share links.
  - `src/auth.ts` — **the** authorization module (see the constraints below).
  - `src/routes/` — one module per resource; `src/lib/` — pure logic, tested.
- `infra/` — Terraform config: S3 + CloudFront, DynamoDB, Cognito, Lambda, and
  API Gateway (optional ACM/Route53 for a custom domain).
  - `infra/bootstrap/` — local-state IAM/OIDC applied once with admin
    credentials; owns the deploy roles and the Lambda execution roles.
- `openspec/` — spec-driven change proposals, designs, specs, and tasks.
- `.claude/`, `.opencode/`, `.pi/` — agent tooling (OpenSpec skills/commands),
  **not** application code.

## Tech stack

- **Runtime:** Node.js 20+ (developed against Node 22).
- **Frontend:** React 19, Vite, TypeScript, React Router, Tailwind v4 +
  shadcn/ui (Radix), `lucide-react` for icons. Style from the tokens in
  `frontend/src/base.css` (values per brand in `src/brand/<id>/theme.css`);
  **never put a raw hex value in a component**.
  `src/components/ui/` is generated shadcn code — editable, but reviewed as
  vendored, and local edits carry a comment saying they diverge from the
  registry. Tailwind is configured in CSS: there is no `tailwind.config.js` and
  no PostCSS pipeline, deliberately.
- **Backend:** Node 22 Lambda (arm64), esbuild, AWS SDK v3, DynamoDB.
- **Auth:** AWS Cognito user pool, Google as the only identity provider.
- **Lint/format:** Oxlint.
- **Tests:** Vitest.
- **Infra:** Terraform ≥ 1.5.0, AWS (S3, CloudFront, DynamoDB, Cognito, Lambda,
  API Gateway, optional ACM/Route53).
- **CI/CD:** GitHub Actions via OIDC; infrastructure by HCP Terraform.

TypeScript is configured fairly strict (`verbatimModuleSyntax`,
`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`,
`allowImportingTsExtensions`). Respect these settings in new code.

## Commands

> ⚠️ There is no root-level `package.json`. `frontend/` and `backend/` are two
> independent npm packages — run `npm` from **inside** one of them, never at the
> repo root. They are deliberately not npm workspaces.

```bash
cd frontend
npm install      # one-time
npm run dev      # Vite dev server with HMR (http://localhost:5173)
npm run lint     # Oxlint
npm test         # Vitest, runs once
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve the production build locally
```

```bash
cd backend
npm install      # one-time
npm run lint     # Oxlint
npm test         # Vitest, runs once
npm run build    # tsc -b && esbuild → dist/index.mjs
```

Account features need `frontend/.env.local` (see `README.md`). Without it the
editor works exactly as it always has, and no account UI is shown.

> ⚠️ **There is no `npm run dev` in `backend/`, and adding one is a decision,
> not a chore.** Running the Lambda locally needs an HTTP shim, a local data
> store, and a way to fake the identity API Gateway's authorizer supplies —
> i.e. a second authentication path that must provably never reach production.
> That trade-off was considered and declined. Backend feedback comes from the
> unit tests; end-to-end verification comes from deploying to dev.

Infrastructure (see `infra/README.md` for the full workflow):

```bash
cd infra
terraform init
terraform plan  -var="bucket_name=<globally-unique-bucket>"
terraform apply -var="bucket_name=<globally-unique-bucket>"
```

## Architectural constraints (do not break)

- **The app must be fully usable signed out.** Card generation, randomize,
  print, and PNG must never require an account, a backend, or a network call. A
  signed-out visitor makes **zero** API requests on load. If a new feature
  cannot work signed out, it is an account feature and must be additive, not a
  replacement. Sharing is one such account feature: it requires saving the card
  and minting a (revocable, server-backed) share link. A leftover `?card=` query
  param is ignored — the encode/decode mechanism has been removed.
- **All authorization happens in `backend/src/auth.ts`**, from the JWT `sub`
  claim that API Gateway's authorizer has already verified. Never trust a user
  id from a request body, path, query string, or header. Never write a
  per-endpoint permission check — call `requireCardRole`. A missing membership
  returns **404, not 403**, so card ids belonging to other users do not leak.
- **Validate untrusted payloads before storing them.** `backend/src/lib/
  cardPayload.ts` rejects rather than defaults, which is the opposite of
  `cardUrl.ts` — persisted state must never be silently "corrected".
- Keep card-generation and data logic **pure and in `src/lib/`** (in both
  packages) so it stays unit-testable and free of React/DOM dependencies.
- **The card renderer is frozen.** `frontend/src/components/CardGrid.tsx` and the
  `.bingo-*` rules in `frontend/src/App.css` render *user data* (the saved
  colour, font, and emoji schemes) and feed four consumers: the screen preview,
  `@media print`, the `html-to-image` PNG export, and `src/lib/cardThumbnail.ts`.
  Restyling them changes what users have already saved and exported. No app
  design tokens and no `oklch()` inside the card; the fixed `#ccc`/`#999` borders
  are deliberate, not a dark-mode bug. See `frontend/DESIGN.md`;
  `cardGrid.guard.test.ts` enforces the mechanical parts.
- **`frontend/src/App.css` is deliberately unlayered CSS.** Unlayered rules beat
  anything inside an `@layer`, which is what keeps the card immune to app-wide
  styling. Don't wrap it in a layer. But note the limit: unlayered wins only
  where `App.css` *declares the property*. Anything the card gets from the
  browser's default stylesheet is unprotected — Tailwind's preflight silently
  reset the card title's size and weight in the app, the PDF, the PNG, and the
  thumbnail at once. **The card must declare every property its appearance
  depends on.**
- **Auth effects live only in `frontend/src/auth/AuthProvider.tsx`**, never in
  `App.tsx`. The provider renders children immediately so authentication never
  gates first paint.
- **Exactly one brand reaches a build.** `VITE_BRAND` is validated in
  `vite.config.ts` and injected as a compile-time literal; `src/brand/index.ts`
  selects with a **ternary**, because an object literal or a `Record` lookup
  references every arm and ships every brand. `src/brand/registry.ts` names them
  all and is imported **only by tests**. `scripts/check-bundle.mjs` fails the
  build if another brand's name appears in `dist/`.
- **The card renderer, the stored card shape, the API, and the URL paths are
  brand-invariant.** A card is a document made of user data; it does not get a
  brand any more than it gets a dark mode. The office brand shows "Meetings" and
  still routes `/trips` — invite and share links are persisted capability URLs,
  so a brand-dependent path would break every link already issued. `trip` stays
  the code word everywhere (file names, types, `tripApi.ts`, the `TRIP#` key
  prefix, `POST /api/trips`); `brand.copy.noun` is the display word.

## Code conventions

- New pure logic → `src/lib/`; new UI → `src/components/`.
- Co-locate tests next to source: `foo.ts` ↔ `foo.test.ts`.
- **A string enters `BrandCopy` only when the brands' values actually differ.**
  `Save`, `Cancel`, `PDF`, `PNG`, `Add selected`, `Entries`, `Look & feel`, and
  `Card details` read the same in every brand and stay inline where they are.
  Most trip strings differ only in that one noun — "Delete this trip?" against
  "Delete this meeting?" is the same sentence — so compose those at the call
  site from `brand.copy.noun`, whose four capitalized forms exist precisely so
  no `capitalize()` helper has to guess. A key earns its place in `BrandCopy`
  when the brands would want a different *sentence*, not a different noun inside
  one. The failure being avoided is turning every component into an indirection
  with no payoff.
- **A token is named for its role, never for its picture.** `--shadow-raised`,
  not `--shadow-postcard`; `panel-edge`, not `edge-perf`. A component that names
  a motif asks for something a second brand has no answer to.
- **`npx shadcn add` needs a follow-up.** It writes new `:root` tokens into
  `src/index.css`, where they would sit *after* the brand import and silently
  override the selected brand. Move them into **every** brand's `theme.css`, in
  both presentations, and add the bridge line to `base.css`.
  `tokens.contract.test.ts` fails until you do.
- Styling via Tailwind utilities and the tokens in `src/base.css`; use `@/…`
  imports in new files. **Read `frontend/DESIGN.md` before UI work** — it carries
  the token table, the spacing and type scales, the travel-motif inventory, the
  component-choice table, the review loop, and the frozen-card-renderer
  constraint.
- **`--accent` is shadcn's hover/active surface, not a brand colour.** Every
  `ghost` and `outline` button and every menu item is `hover:bg-accent`. The
  app's second brand colour is `--brand-accent`, used by name and sparingly.
- New components need a gallery entry in `frontend/src/dev/gallery/registry.tsx`;
  `coverage.test.ts` fails without one. Add new *states* of an existing
  component too — nothing mechanical catches those.
- Prefer named exports and explicit `type`/`interface` declarations, matching
  the existing style.

## Testing conventions

- Vitest, with test files co-located alongside the code they cover.
- Add tests for any new `src/lib/` logic. A feature isn't done until
  `npm test` passes.

## Definition of done

Before considering work complete, run in **both** `frontend/` and `backend/`:

```bash
npm run lint
npm test
npm run build
```

All must pass. GitHub Actions runs the same three commands on deploy, so a
failure here is a failed deploy.

**Visual QA.** If you changed anything that renders, look at it — none of the
three commands above can. With the dev server running:

```bash
npm run capture -- /ui                    # plus each affected route
VITE_BRAND=office npm run capture -- /ui  # against an office dev server
```

That writes light and dark captures at 390px and 1440px to `.captures/`, and
reports any API request made on load. If you touched `CardGrid.tsx` or
`App.css`, add `--pdf` and run the export regression checklist (print, PNG,
thumbnail) in `frontend/DESIGN.md`. "It compiles" is not visual QA.

**Review every brand the change can affect.** A change inside `src/brand/<id>/`
is that brand's alone; the others need only be confirmed unchanged. Anything
else — a component, `base.css`, a shared utility — affects all of them, and the
matrix doubles. Pass `VITE_BRAND` to `capture` to match the server you started,
or one brand's captures overwrite the other's and you review the same brand
twice. And run the build for **every** brand before calling it done:

```bash
VITE_BRAND=travel npm run build && VITE_BRAND=office npm run build
```

CI does this on every PR, but a build is the only thing that exercises a
brand's CSS graph, copy, and suggestion data at all.

If you touched the stored card shape, the two contract tests
(`backend/src/lib/cardPayload.contract.test.ts` and
`frontend/src/lib/savedCard.contract.test.ts`) must be updated together — they
are the only thing linking the duplicated types across the two packages.

## OpenSpec workflow

Substantive changes should go through OpenSpec: a proposal, design, specs, and
task list under `openspec/changes/`. Agent commands/skills are available for
propose, apply, update, sync, archive, and explore. Treat the specs as the
source of intent for what the app should do.

## Gotchas

- No root `package.json` — don't run `npm` at the repo root.
- The dev server is pinned to port 5173 with `strictPort`, because Cognito's
  redirect URI is registered as exactly `http://localhost:5173/auth/callback`.
  If it fails to start, free the port rather than letting it move.
- `.opencode/node_modules/`, `.claude/`, and `.pi/` are tooling, not app code;
  leave them alone unless intentionally changing the agent setup.
- Single `main` branch. Pushing to it auto-deploys **dev**; prod is a manual,
  reviewer-gated `workflow_dispatch`.
- `terraform destroy` is now a data-loss operation. The DynamoDB table and
  Cognito user pool carry `prevent_destroy`; recreating the pool would change
  every user's `sub` and orphan their saved cards.
- Local development runs against the **deployed dev** API, pool, and table —
  not a copy. Cards saved locally are real dev rows.
- A Gmail plus-alias is the same Google account and yields the same `sub`, so
  it cannot be used to test multi-user behaviour. Use `scripts/dev-user.sh` to
  create test identities in dev instead.
- **Dev's Cognito app client carries `ALLOW_ADMIN_USER_PASSWORD_AUTH`; prod
  must never get it.** It is gated on `var.environment == "dev"` in
  `infra/cognito.tf` and exists so test users can be authenticated from the
  CLI. It is IAM-authorized, not a public password login, and
  `supported_identity_providers` stays `["Google"]` so the hosted UI is
  unchanged. Do not "tidy" the conditional away.
