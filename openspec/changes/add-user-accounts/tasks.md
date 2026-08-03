## 1. Bootstrap IAM (blocks everything; requires local admin credentials)

- [x] 1.1 Add `infra/bootstrap/lambda-roles.tf`: `travelbingo-lambda-{dev,prod}` roles trusted by `lambda.amazonaws.com`, with an inline policy granting DynamoDB item operations on that environment's table and `logs:CreateLogStream`/`logs:PutLogEvents` on its log group (no `logs:CreateLogGroup` — the main config creates it so retention is enforced)
- [x] 1.2 Extend `infra/bootstrap/tfc-roles.tf` with `dynamodb:*` (env table), `cognito-idp:*`, `apigateway:*`, `lambda:*` (env function), and `logs:*` (env log groups)
- [x] 1.3 Add `iam:PassRole` to the tfc roles, scoped to the single `travelbingo-lambda-<env>` ARN with an `iam:PassedToService = lambda.amazonaws.com` condition — and **no** `iam:CreateRole` or `iam:PutRolePolicy`
- [x] 1.4 Extend `infra/bootstrap/gha-roles.tf` with `lambda:UpdateFunctionCode`, `lambda:GetFunction`, `lambda:GetFunctionConfiguration` on the env function; add `function_name` to `local.envs`
- [x] 1.5 Add a `lambda_execution_role_arns` output to `infra/bootstrap/outputs.tf`
- [x] 1.6 (manual) Re-apply `infra/bootstrap` with administrator credentials
- [x] 1.7 Update `infra/bootstrap/README.md` with the new roles and the re-apply requirement

## 2. Manual prerequisites (you)

- [x] 2.1 (manual) Create two Google Cloud OAuth 2.0 Web clients (dev, prod) and configure the consent screen; redirect URI `https://travelbingo-<env>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
- [x] 2.2 (manual) Set `google_oauth_client_id` and `google_oauth_client_secret` (marked **sensitive**) on the `travelbingo-dev` and `travelbingo-prod` HCP workspaces
- [x] 2.3 (manual) Set `lambda_execution_role_arn` on both HCP workspaces from the 1.5 output
- [x] 2.4 (manual) Create an AWS Budgets alert at ~$5/month

## 3. Terraform application infrastructure

- [x] 3.1 Add `hashicorp/archive` to `required_providers` in `infra/versions.tf`
- [x] 3.2 Add `infra/dynamodb.tf`: single table, `PK`/`SK`, `PAY_PER_REQUEST`, TTL on `expiresAt`, point-in-time recovery, `deletion_protection_enabled` for prod, `lifecycle { prevent_destroy = true }`
- [x] 3.3 Add `infra/cognito.tf`: user pool (`prevent_destroy`), hosted domain from a `cognito_domain_prefix` variable defaulting to `travelbingo-<env>`, Google identity provider reading the sensitive variables, and a public SPA client (no secret, authorization-code + PKCE, `openid email profile`, 1h access/id tokens, 30d refresh, token revocation enabled)
- [x] 3.4 Build `local.auth_redirect_urls` — the site origin plus `http://localhost:5173` only when `environment == "dev"` — and wire it to the client's callback and logout URLs
- [x] 3.5 Add `infra/lambda.tf`: function (Node 22, arm64, `reserved_concurrent_executions`, `TABLE_NAME` env var) provisioned from an inline placeholder zip, with `lifecycle { ignore_changes = [...] }` on the code attributes, plus an explicit log group with 14-day retention
- [x] 3.6 Add `infra/apigateway.tf`: HTTP API, Cognito JWT authorizer, Lambda proxy integration, explicit routes declared **with** the `/api` prefix, `$default` stage with auto-deploy, stage throttling plus a stricter limit on `GET /api/shares/{token}`, access logs, and the `aws_lambda_permission`
- [x] 3.7 Leave `GET /api/shares/{token}` without an authorizer; every other route requires JWT
- [x] 3.8 Add `infra/cloudfront_function.js` and an `aws_cloudfront_function` resource rewriting to `/index.html` when the last path segment contains no `.`
- [x] 3.9 In `infra/main.tf`: **delete `custom_error_response`** and associate the function on the default (S3) behavior as `viewer-request`
- [x] 3.10 In `infra/main.tf`: add the API Gateway origin (`https-only`) and an `/api/*` ordered cache behavior using `Managed-CachingDisabled` and `Managed-AllViewerExceptHostHeader`, allowing all HTTP methods
- [x] 3.11 Add a response-headers policy on the default behavior setting a Content-Security-Policy and `Referrer-Policy: no-referrer`
- [x] 3.12 Add the new variables (`google_oauth_client_id`, `google_oauth_client_secret` sensitive, `lambda_execution_role_arn`, `cognito_domain_prefix`) and outputs (`dynamodb_table_name`, `lambda_function_name`, `api_gateway_endpoint`, `cognito_user_pool_id`, `cognito_user_pool_client_id`, `cognito_domain`)
- [x] 3.13 Let dev auto-apply and verify the plan is clean on a second run (watch for a perpetual diff on the Cognito client secret; add `ignore_changes` on it if so)
- [x] 3.14 (manual) Set the new GitHub Environment variables from the outputs: `LAMBDA_FUNCTION_NAME`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_APP_ORIGIN`

## 4. Backend package

- [x] 4.1 Scaffold `backend/`: `package.json` (no root package.json), `tsconfig.json` mirroring the frontend's strictness, `.oxlintrc.json` without the react plugin, `build.mjs` (esbuild, node22, `external: ["@aws-sdk/*"]`), vitest; scripts `lint`, `test`, `build`
- [x] 4.2 Add `src/lib/keys.ts` (the only module that knows the PK/SK format), `src/http.ts` (JSON responses, `HttpError`, `no-store` headers), `src/context.ts` (dependency-injection seam for `ddb`, `now`, `randomBytes`)
- [x] 4.3 Add `src/lib/cardPayload.ts` mirroring the bounds and allowlists in `frontend/src/lib/cardUrl.ts` but rejecting rather than defaulting; add tests
- [x] 4.4 Add `src/auth.ts`: `getUserId` reading only the verified JWT `sub`, and `requireCardRole(deps, userId, cardId, allowed)` returning 404 for a missing membership and 403 for an insufficient role; add tests covering all four outcomes including the cross-user 404
- [x] 4.5 Add `src/routes/cards.ts` — list, create (with the per-user cap), get, replace, rename, delete with cascade — writing the two-item transaction that keeps the denormalized title consistent; add tests
- [x] 4.6 Add `src/lib/shareToken.ts` (16 random bytes, base64url, conditional write with one retry) and `src/routes/shares.ts` (create, list, revoke, public resolve); add tests for collision retry and revoked→404
- [x] 4.7 Add `src/router.ts` and `src/index.ts`
- [x] 4.8 Add a wire-shape contract test pinning the stored card payload JSON, mirrored by the frontend test in 6.7
- [x] 4.9 Run `npm run lint && npm test && npm run build` in `backend/`

## 5. CI/CD

- [x] 5.1 Add `.github/workflows/_deploy-backend.yml`: `workflow_call` with an `environment` input, `id-token: write`, working directory `backend`, Node 22, `npm ci` → lint → test → build → zip → OIDC assume role → `aws lambda update-function-code --publish` → wait for update. **Do not declare `concurrency` here.**
- [x] 5.2 Add a `backend` job to `deploy-dev.yml` and `deploy-prod.yml`, and make the existing frontend job `needs: backend`; leave the callers' `concurrency` blocks unchanged
- [x] 5.3 Pass `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, and `VITE_APP_ORIGIN` from `vars.*` into the build step's `env:` in `_deploy.yml`
- [x] 5.4 Push and confirm the first dev backend deploy replaces the placeholder function

## 6. Frontend

- [x] 6.1 Add `react-router`; add `src/routes.tsx` with `/`, `/cards`, `/s/:token`, `/auth/callback`, and a catch-all redirect to `/`; wrap the tree in `main.tsx` — `App.tsx` becomes the element for `/` **unchanged**
- [x] 6.2 Add `src/config.ts` reading and validating the three `VITE_*` vars once at startup; add a Vite `server.proxy` for `/api`; document `frontend/.env.local` (already covered by the existing `*.local` gitignore rule)
- [x] 6.3 Add `src/lib/auth.ts` (PKCE challenge, authorize URL with `identity_provider=Google`, callback parsing, logout URL, ID-token payload decode for display only, expiry checks) and `src/lib/authSession.ts` (persist and shape-validate on read); add tests
- [x] 6.4 Add `src/auth/authContext.ts` (context + hook, **no components** — `react/only-export-components` is enabled) and `src/auth/AuthProvider.tsx` (the only new `useEffect`), rendering children immediately at `status: "loading"`; add `AuthCallbackPage`
- [x] 6.5 Add `src/lib/apiClient.ts` with injected `getAccessToken` and `fetch`, one retry after a 401 via refresh, and typed errors; add tests
- [x] 6.6 Extract `src/lib/cardState.ts` from the inline initial-state logic in `App.tsx`; add tests; have `App.tsx` use it both in its `useState` initializers and in a single `applyCardData` used by all three load paths
- [x] 6.7 Add `src/lib/savedCard.ts` converting between editor state and the stored payload via `CardUrlData`, so saved cards reuse `cardFromSlots`; add the wire-shape contract test mirroring 4.8
- [x] 6.8 Add `src/components/AuthMenu.tsx` and the save action, keeping "Copy card link" and "Create share link" visibly distinct in the `CardView` export menu
- [x] 6.9 Add `src/pages/SavedCardsPage.tsx`: list, open (confirming when the editor is dirty), rename, delete
- [x] 6.10 Add `src/components/ShareLinkDialog.tsx`: create, copy, list, revoke — with wording stating plainly that revoking cannot retract a copy already taken
- [x] 6.11 Add `src/pages/SharedCardPage.tsx`: load the snapshot, scrub the token with `history.replaceState`, offer "Save a copy" or a sign-in prompt
- [x] 6.12 Run `npm run lint && npm test && npm run build` in `frontend/`

## 7. Documentation

- [x] 7.1 Rewrite `AGENTS.md`: the client-side-only and nothing-persisted claims, the `infra/` "no compute, no database" line, a new `backend/` entry, the two-package npm rule, a new constraint that all authorization happens in `backend/src/auth.ts` from the verified JWT `sub`, and the definition of done covering both packages
- [x] 7.2 Fix the two stale `AGENTS.md` claims that no CI exists (they predate `add-cicd-deployment`)
- [x] 7.3 Update `README.md`: the "no accounts, no saved cards" line, the `frontend/` and `infra/` descriptions, a `backend/` entry, and a note that account features need `frontend/.env.local` while the editor works fully without it
- [x] 7.4 Update `infra/README.md`: remove the "no compute and no database" line, add the new workspace variables, the manual prerequisites, and the outputs → GitHub Environment variable mapping; note that dev and prod builds are no longer byte-identical
- [x] 7.5 Add `backend/README.md`

## 8. Verification

- [x] 8.1 `curl -i https://dev.travelbingo.ca/api/shares/doesnotexist` → JSON **404**, not `index.html` (proves the `custom_error_response` removal)
- [x] 8.2 `curl -i https://dev.travelbingo.ca/s/anything` → **200** + `index.html` (proves the CloudFront Function replaced the fallback, including the pre-existing 403 case)
- [x] 8.3 `curl -i https://dev.travelbingo.ca/api/cards` with no `Authorization` → **401** JSON, unmodified by CloudFront
- [x] 8.4 Request a non-existent asset path ending in `.js` → not rewritten to HTML
- [x] 8.5 Sign in with Google end to end; reload and stay signed in; sign out and return to anonymous
- [x] 8.6 Save → appears in `/cards` → open → identical grid, title, colors, fonts, emojis, free space → rename → delete
- [x] 8.7 Cross-tenant: as user B, `GET /api/cards/<user A's cardId>` → **404** (not 403, not 200)
- [x] 8.8 Share link: create → open in a private window with no account → renders → "Save a copy" prompts sign-in → revoke → same URL now 404 → a copy already taken still exists
- [ ] 8.9 Logged-out parity: with `/api` blocked in devtools, the editor, randomize, print, PNG, and `?card=` export/import all work, with no console errors and no network calls on load
- [ ] 8.10 An existing pre-change `?card=` URL still round-trips (`SCHEMA_VERSION` unchanged at 4)
- [x] 8.11 `npm run lint && npm test && npm run build` passes in **both** `frontend/` and `backend/`
- [x] 8.12 Confirm no static AWS credentials and no Google client secret exist in GitHub secrets or variables
- [ ] 8.13 Prod: manual HCP apply, then reviewer-gated `deploy-prod` dispatch; repeat 8.1–8.10 against `travelbingo.ca`
