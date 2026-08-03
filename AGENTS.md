# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo.

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
  - `src/components/` — MUI v9 React components.
  - `src/theme.ts` — shared MUI theme.
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
- **Frontend:** React 19, Vite, TypeScript, MUI v9 + Emotion, React Router.
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
  print, PNG, and `?card=` sharing must never require an account, a backend, or
  a network call. A signed-out visitor makes **zero** API requests on load. If a
  new feature cannot work signed out, it is an account feature and must be
  additive, not a replacement.
- **`?card=` URL sharing is permanent.** It is not deprecated by share links and
  is not going away. New card state must still round-trip through
  `encodeCardToUrl` / `decodeCardFromUrl` in `frontend/src/lib/cardUrl.ts`.
  Bumping `SCHEMA_VERSION` breaks every link anyone has ever shared.
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
- **Auth effects live only in `frontend/src/auth/AuthProvider.tsx`**, never in
  `App.tsx`. The provider renders children immediately so authentication never
  gates first paint.

## Code conventions

- New pure logic → `src/lib/`; new UI → `src/components/`.
- Co-locate tests next to source: `foo.ts` ↔ `foo.test.ts`.
- Styling via MUI + Emotion and `src/theme.ts`; follow the patterns in
  `App.tsx` and the existing components.
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
