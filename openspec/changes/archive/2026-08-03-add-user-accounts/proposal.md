## Why

Cards exist only as long as the browser tab does. The `?card=` URL is the entire persistence and sharing story: it works, but it produces very long links, it cannot be revoked once sent, and there is nowhere to keep a card you want back next week. Users want to sign in, keep a library of their cards, and hand someone a short link to a copy.

This is the first change that requires a backend. The app is documented as client-side-only with no accounts, no server, and no persistence — that constraint is now being deliberately and narrowly revoked rather than quietly violated. Card generation stays pure and in-browser, and the app stays fully usable signed out.

## What Changes

- Add Google sign-in via an AWS Cognito user pool (one pool per environment, Google as the only identity provider — no passwords, no email infrastructure).
- Add a saved-card library: save the current card to your account, list saved cards, open one back into the editor, rename it, delete it.
- Add revocable share links: an owner mints an opaque token at `/s/<token>` carrying a frozen snapshot of the card. Anyone can open it with no account and receive a **copy**; the owner can revoke it.
- Add the project's first backend: API Gateway (HTTP API) → a single Node 22 Lambda → one DynamoDB table, all provisioned per environment.
- Route the API through the **existing** CloudFront distribution as an `/api/*` cache behavior, so the app stays same-origin and needs no CORS.
- Replace the distribution-wide `custom_error_response` SPA fallback with a CloudFront Function scoped to the S3 behavior. This fixes a latent bug (the current rule maps 404, but S3 returns 403 for missing keys) and prevents the fallback from rewriting API error responses.
- Add a `backend/` package beside `frontend/`, deployed by a new reusable GitHub Actions workflow using the existing OIDC pattern.
- Add client-side routing (`/`, `/cards`, `/s/:token`, `/auth/callback`) — the app previously had none.
- Rewrite the client-side-only claims in `AGENTS.md` and `README.md`, and fix two already-stale claims there that CI exists.
- **Unchanged:** the `?card=` URL mechanism, its payload schema version, and every card-generation behavior.

## Capabilities

### New Capabilities
- `user-accounts`: sign in and out with Google via Cognito; the session survives a reload; the app remains fully functional signed out.
- `card-library`: save, list, open, rename, and delete cards belonging to the signed-in user.
- `card-share-links`: mint an opaque revocable link that hands a recipient a frozen copy of a card without requiring them to have an account.
- `backend-api`: a same-origin HTTP API with server-side authorization on every request, strict payload validation, and a single-table data model whose membership records are role-based from day one.

### Modified Capabilities
- `deployment-pipeline`: the backend is now built and deployed alongside the frontend, the bootstrap configuration owns a Lambda execution role, and third-party OAuth credentials get an explicit storage rule.
- `card-url-sharing`: the account-free `?card=` mechanism is pinned as a permanent requirement that coexists with server-stored share links.

## Impact

- **Infra (new):** `infra/dynamodb.tf`, `infra/cognito.tf`, `infra/lambda.tf`, `infra/apigateway.tf`, `infra/cloudfront_function.js`.
- **Infra (modified):** `infra/main.tf` removes `custom_error_response`, adds the CloudFront Function association, the API Gateway origin, and the `/api/*` ordered cache behavior; `infra/variables.tf` and `infra/outputs.tf` gain the new inputs and outputs; `infra/versions.tf` adds the `archive` provider.
- **Bootstrap (new/modified):** `infra/bootstrap/lambda-roles.tf` creates the Lambda execution roles; `tfc-roles.tf` gains DynamoDB, Cognito, API Gateway, Lambda, logs, and a narrowly-conditioned `iam:PassRole`; `gha-roles.tf` gains `lambda:UpdateFunctionCode`.
- **Backend (new):** `backend/` — its own `package.json`, TypeScript, oxlint, Vitest, and esbuild bundle. There is still no root `package.json`.
- **Frontend (modified):** adds `react-router` and the repo's first `import.meta.env` usage; `App.tsx` becomes the element for `/` and is otherwise unchanged; card-state construction is extracted from `App.tsx` into a new pure `lib/cardState.ts` reused by all three card-loading paths.
- **CI/CD (new/modified):** `.github/workflows/_deploy-backend.yml` is added; both callers gain a backend job that the frontend job depends on. Concurrency stays declared only in the callers. Prod stays reviewer-gated.
- **Docs:** `AGENTS.md`, `README.md`, `infra/README.md`, `infra/bootstrap/README.md`, and a new `backend/README.md`.
- **Manual prerequisites:** two Google Cloud OAuth clients; HCP sensitive workspace variables for the client id/secret; a bootstrap re-apply with admin credentials; new GitHub Environment variables.
- **New running cost:** expected to be under ~$1/month, plus a recommended AWS Budgets alert. This is the first surface where a bug can cost money and the first that holds data not reproducible from git.
