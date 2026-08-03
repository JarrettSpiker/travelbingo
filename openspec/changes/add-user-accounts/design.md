## Context

The app has never had a server. Cards are generated in the browser and shared by encoding their whole state into a `?card=` URL (`frontend/src/lib/cardUrl.ts`), and `AGENTS.md` states the client-side-only, nothing-persisted constraint as a hard architectural rule. Hosting is a private S3 bucket behind CloudFront, provisioned by HCP Terraform across `dev` and `prod`, with GitHub Actions deploying via OIDC and no static credentials anywhere.

Accounts require identity, compute, and storage — three things the project has deliberately avoided. This document records the decisions that keep that addition narrow, so the original constraint survives where it still earns its place. See `proposal.md` for motivation, and the `deployment-pipeline` and `custom-domains` capabilities for the hosting baseline.

## Goals / Non-Goals

**Goals:**
- Sign in with Google, save cards, get them back, and share a revocable copy by link.
- Keep card generation pure, in-browser, and account-free. The app must be fully usable signed out.
- Keep the `?card=` mechanism permanently, unchanged, as the account-free sharing path.
- Stay inside the existing AWS account, HCP Terraform workspaces, and OIDC deploy pattern; add no new vendor.
- Scale to zero: idle cost effectively unchanged.
- Model authorization so that future shared card pools are additive, not a migration.

**Non-Goals:**
- No collaborative or real-time editing; no shared card pools yet (only the data model anticipates them).
- No email/password auth, no email sending, no SES.
- No custom Cognito domain (`auth.travelbingo.ca`); the `*.amazoncognito.com` prefix domain is used.
- No WAF, no per-PR preview environments, no component/DOM tests (no jsdom, no Testing Library).
- No per-user card *state* (crossing off squares) — anticipated by the key design, not built here.
- No removal or deprecation of `?card=`.

## Decisions

- **Cognito with Google as the only identity provider.** Rationale: it removes password storage entirely, which is the largest security liability for a public hobby app, and it avoids SES completely — no domain verification, no DKIM records, no sandbox-exit ticket. Cognito is Terraform-native, stays in the existing AWS account, introduces no new vendor bill, and is free under 10k MAU. Trade-off: someone without a Google account cannot sign up. Accepted; a second social provider can be added later without changing the data model.
- **API Gateway HTTP API + Lambda + DynamoDB.** Rationale: scale-to-zero matches a project whose current bill is pennies, and it fits the existing Terraform + GitHub Actions OIDC pattern with no new deploy mechanism. Aurora Serverless v2 was rejected because it never scales below 0.5 ACU (~$45–90/month idle). Supabase was rejected because it would split the data plane across a second vendor with its own billing and IaC.
- **Same-origin `/api/*` through the existing CloudFront distribution.** Rationale: no CORS configuration, no cross-site cookie handling, and it reuses the certificate and DNS records already in place. `Managed-CachingDisabled` is mandatory — an edge-cached `/api/cards` or share response would be a cross-user data leak. `Managed-AllViewerExceptHostHeader` is also mandatory: it forwards `Authorization` while suppressing the viewer `Host` header, which API Gateway routing requires.
- **API Gateway routes are declared with the `/api` prefix.** Rationale: CloudFront `origin_path` can prepend but never strip a prefix, so the alternative is a second CloudFront Function purely to rewrite the URI. Declaring `GET /api/cards` keeps console paths and browser paths identical.
- **Explicit routes, not a `$default` route.** Rationale: per-route authorizer control is what allows `GET /api/shares/{token}` to be public while everything else requires a verified JWT.
- **Replace `custom_error_response` with a CloudFront Function.** The existing rule maps 404 → `/index.html`, but the bucket policy grants only `s3:GetObject` with no `s3:ListBucket`, so S3 returns **403** for a missing key. The SPA fallback has therefore never worked; nothing noticed because the app has no routes. `custom_error_response` is also distribution-wide and cannot be scoped to a cache behavior, so once the API shares the distribution it would rewrite API errors into `200 + index.html` — turning authorization denials into apparent successes. A viewer-request function attaches per-behavior, so it fixes the 403 bug and leaves `/api/*` untouched. Rejected alternatives: adding `403 → /index.html` (would silently convert every 401/403 from the authorizer into a 200 page of HTML) and granting `s3:ListBucket` (still distribution-wide, so genuine API 404s would become 200s).
- **Authorization lives in one Lambda helper, not in Cognito.** Cognito answers "who is this", never "may they read card X". Cognito groups are the wrong tool — they are per-app roles, are capped per user, and are stamped into every token, so one group per shared resource does not scale. Identity-pool IAM with a `dynamodb:LeadingKeys` condition was rejected specifically because a leading-key condition can only express "your own partition", which breaks the moment sharing exists. All checks funnel through `backend/src/auth.ts`.
- **Caller identity comes only from the verified JWT `sub`.** Never from a request body, header, or path parameter. API Gateway's JWT authorizer validates signature, issuer, audience, and expiry before the Lambda runs.
- **Missing membership returns 404, not 403.** Returning 403 for "exists but not yours" leaks the existence of other users' card IDs. Both cases return an identical `not_found` response.
- **Single DynamoDB table with a first-class membership item.** Membership is stored as its own record from day one even though `owner` is the only role, so "my cards" is a single query and future shared pools are additive rather than a migration. A single table means a new entity type is a new key prefix with zero Terraform, IAM, or deploy change — which is the deciding factor given that card state and shared pools are anticipated. Trade-off: the table is not self-describing, so the access-pattern map below is a required, maintained artifact.
- **`title` is denormalized onto the membership item.** Rationale: keeps "my cards" a single Query with no N+1 `BatchGetItem` on the hottest read path. Rename becomes a two-item `TransactWriteItems`, which makes drift impossible.
- **Share tokens are 128 bits of entropy, written conditionally.** `randomBytes(16).toString("base64url")` (22 chars), written with `attribute_not_exists(PK)` and retried once on conflict. Guessing is infeasible, so throttling on the public route is a cost control rather than a secrecy control.
- **Share links do not expire.** Revocation is the control; a link handed to a friend that silently dies is bad UX. The table's TTL is configured on an `expiresAt` attribute that is simply not set, so optional expiry can be added later without a migration. If it ever is, the read path must also check `expiresAt`, because TTL deletion is best-effort and can lag by up to 48 hours.
- **The Google OAuth client id and secret are HCP Terraform sensitive workspace variables.** Rationale: they sit alongside every other per-environment value (`bucket_name`, `domain_name`), are write-only in the HCP UI, and never enter git or GitHub. Note the secret lands in Terraform state regardless of the mechanism, because `aws_cognito_identity_provider.provider_details` holds it; HCP state is encrypted and access-controlled.
- **The Lambda execution role is created in `infra/bootstrap/`, not the main config.** Rationale: this is the difference between the TFC roles needing `iam:PassRole` on one ARN with a `PassedToService` condition, versus needing `iam:CreateRole` + `iam:PutRolePolicy` — which would make roles assumable by a VCS-triggered auto-apply workspace effectively admin-equivalent, since they could attach arbitrary inline policies to roles they create. Bootstrap already exists to own exactly this class of resource.
- **Terraform provisions the Lambda with a placeholder; GitHub Actions ships the code.** Mirrors the documented split for the frontend ("Terraform only provisions the hosting; it does not build or upload the app") and keeps backend bugfixes off the manual prod-apply path. Requires `lifecycle { ignore_changes = [...] }` on the code attributes.
- **A separate reusable workflow, `_deploy-backend.yml`.** Rationale: different working directory, artifact, and AWS calls, and the existing frontend deploy path should carry zero regression risk. Concurrency stays declared only in the callers — a reusable workflow sharing a concurrency group with its caller causes GitHub to detect a deadlock and cancel the run.
- **`backend/` is an independent package; still no root `package.json`.** npm workspaces was rejected because it hoists `node_modules` and would break `_deploy.yml`'s `cache-dependency-path: frontend/package-lock.json`, violating a documented invariant for a type-sharing benefit a contract test buys more cheaply. The rule becomes: two independent packages, run npm from inside one of them.
- **Add `react-router`.** `/s/<token>` is a path, and OAuth authorization-code + PKCE requires a registered redirect URI on a distinct path so the callback handler cannot race the editor's `?card=` import. The alternative is hand-rolled `pathname` switching plus `popstate` handling, which is a router written worse and would fight the token-scrubbing `history.replaceState`. Cost: ~15 KB gzipped.
- **`App.tsx` becomes the element for `/`, otherwise unchanged.** Its nine `useState` hooks, its module-scope `decodeCardFromUrl()`, and its handlers are untouched. Containment is what keeps this reviewable in a repo with no component tests.
- **All auth effects live in `AuthProvider`, never in `App.tsx`.** The provider renders children immediately at `status: "loading"`, so it never gates first paint and signed-out users make zero network calls on load. Every decision it makes (is the token expired, should it refresh, is the stored session shape valid) lives in pure, tested functions in `frontend/src/lib/`.
- **Refresh token in `localStorage`; access and ID tokens in memory.** This keeps sign-in surviving a reload. See the XSS risk below — this is a knowingly accepted trade-off, not an oversight.
- **Build-time `VITE_*` config from GitHub Environment variables.** The Cognito domain and public SPA client id are visible in any network trace, so they are non-secret by design and fit the existing "configuration variables, never secrets" pattern. A single `frontend/src/config.ts` validates them once at startup so a misconfigured deploy fails loudly.

## Data model and access patterns

Single table, `PK`/`SK`, no GSIs. Every access pattern below is served by the key schema alone.

```
CARD#<cardId>   META            ownerId, title, slots[], hasFreeSpace, freeSpaceText,
                                colorScheme, fontScheme, emojiScheme, payloadVersion,
                                createdAt, updatedAt
USER#<sub>      CARD#<cardId>   role, title, updatedAt          <- title denormalized
CARD#<cardId>   MEMBER#<sub>    role, createdAt
CARD#<cardId>   SHARE#<token>   createdAt                       <- owner-facing pointer
SHARE#<token>   META            cardId, ownerId, snapshot{}, createdAt [, expiresAt]
USER#<sub>      PROFILE         email, googleSubject, createdAt, lastSeenAt
```

| Access pattern | Operation |
|---|---|
| List my cards | `Query PK = USER#<sub> AND begins_with(SK, "CARD#")` |
| Authorize a card operation | `GetItem PK = USER#<sub>, SK = CARD#<cardId>` |
| Load a card | `GetItem PK = CARD#<cardId>, SK = META` |
| List a card's share links | `Query PK = CARD#<cardId> AND begins_with(SK, "SHARE#")` |
| Resolve a share token | `GetItem PK = SHARE#<token>, SK = META` |
| Cascade-delete a card | `Query PK = CARD#<cardId>` then `BatchWriteItem` |

This table is a maintained artifact: any new entity type or query must be added here in the same change that introduces it.

## Manual Prerequisites (created by you, not by code)

- **Google Cloud:** create two OAuth 2.0 Web clients (dev and prod) and configure the consent screen. Authorized redirect URI for each: `https://<cognito_domain_prefix>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`. The prefix is chosen by us, so there is no chicken-and-egg — but Cognito domain prefixes are globally unique per region, and `describe-user-pool-domain` returns an empty description both when a prefix is free and when another account owns it, so availability is only truly confirmed at apply time. The prefix is therefore a variable (`cognito_domain_prefix`, defaulting to `travelbingo-<env>`): if an apply fails on a collision, change the workspace variable and edit the redirect URI in the Google client, with no code change.
- **Consent screen:** while it remains in "Testing" only explicitly listed test users can sign in (capped at 100), so it must be published before prod. Publishing requires no Google verification review, because `openid`, `email`, and `profile` are all non-sensitive scopes.
- **HCP workspace variables:** set `google_oauth_client_id` and `google_oauth_client_secret` (marked **sensitive**) on `travelbingo-dev` and `travelbingo-prod`, plus `lambda_execution_role_arn` once bootstrap has been applied.
- **Bootstrap re-apply:** re-run `infra/bootstrap` with administrator credentials so the Lambda execution roles exist and the TFC/GHA roles pick up their new permissions before any application resource is applied.
- **GitHub Environment variables** (`dev` and `prod`, after the first apply produces the outputs): `LAMBDA_FUNCTION_NAME`, `VITE_COGNITO_DOMAIN`, `VITE_COGNITO_CLIENT_ID`, `VITE_APP_ORIGIN`.
- **AWS Budgets:** an alert at ~$5/month. This is the first surface where a bug can generate cost.

## Risks / Trade-offs

- [The logged-out experience regresses — this is the failure that would actually damage the product] → Mitigated three ways: the SPA fallback fix is verified explicitly, `AuthProvider` renders children immediately and shape-validates stored sessions so a corrupted value yields "anonymous" rather than a crash, and anonymous users make zero API calls on load. Pinned at spec level by the new `card-url-sharing` requirement.
- [Abuse, not usage, is the real cost risk — this is the first surface where a bug can cost money] → Mitigated by API Gateway stage throttling (20 rps / 40 burst, 5/10 on the public share route), `reserved_concurrent_executions = 10`, a 200-card per-user cap, request body size validation, and 14-day log retention (CloudWatch Logs can quietly become the largest line item). An AWS Budgets alert is a manual prerequisite.
- [Revocation cannot retract a copy a recipient has already taken] → Inherent to "the recipient receives a copy". Accepted, but it must be stated in the share dialog's wording, not only in the spec.
- [Share tokens are capability URLs and can leak via history, `Referer`, or shoulder-surfing] → Mitigated by `Referrer-Policy: no-referrer`, `Cache-Control: no-store` alongside `Managed-CachingDisabled`, and a `history.replaceState` scrub immediately after the snapshot loads.
- [This is the project's first stateful surface; everything before it was reproducible from git] → Mitigated by point-in-time recovery, `deletion_protection_enabled` on prod, `lifecycle { prevent_destroy = true }`, and `payloadVersion` stored on every card so a future schema bump is readable. Accepted explicitly: there is no migration tooling and no restore runbook, and `terraform destroy` is now a data-loss operation.
- [Cognito `sub` is a partition key, so recreating the user pool orphans every membership while card data survives unreachable] → Mitigated by `prevent_destroy` on the pool and by recording `googleSubject` on the profile item as a remap escape hatch. Keying on the Google subject instead would survive a pool rebuild but requires defensively parsing a claim whose shape varies and couples the data model to one IdP; rejected.
- [A refresh token in `localStorage` is exfiltratable by any XSS] → Knowingly accepted. The stronger design — an HttpOnly `SameSite=Lax` cookie set by a backend-for-frontend, which is clean here because we are same-origin — conflicts with the native JWT authorizer, which reads only the `Authorization` header, and would require a custom Lambda authorizer while losing "verified before the Lambda runs". Compensating controls: a Content-Security-Policy as the primary XSS mitigation, 1-hour access tokens, and token revocation on sign-out.
- [`CardUrlData`, the font allowlist, and the color regex are duplicated across `frontend/` and `backend/` with no compile-time link] → The largest accepted piece of technical debt. Chosen over npm workspaces (breaks the no-root-`package.json` invariant and `_deploy.yml`'s cache path) and over a `file:` dependency (drags the frontend tree into the Lambda). Mitigated by a wire-shape contract test in each package, so divergence fails CI rather than silently corrupting data. If a third consumer appears, revisit workspaces.
- [TFC roles gain `cognito-idp:*` account-scoped because pool IDs are unknowable at bootstrap] → Continues the existing documented pattern for CloudFront and Route53. The important thing avoided is any IAM *write* permission for TFC; it receives only `iam:PassRole` on a single ARN with a service condition.
- [Dev and prod builds are no longer byte-identical from the same commit, now that `VITE_*` is baked in at build time] → Accepted; already effectively true via different buckets and domains. Documented in `infra/README.md`.
- [This roughly triples the project's surface area for a solo hobby project] → Accepted deliberately, and bounded by the non-goals above. Every future card feature now has to answer "does this need to sync to the server?"; the answer for generation features remains no.

## Migration Plan

There is no data to migrate — this change creates the first persisted state. Sequencing is what matters:

1. Apply `infra/bootstrap` with administrator credentials first. Nothing else can succeed until the Lambda execution roles exist and the TFC/GHA roles are widened.
2. Create the Google OAuth clients and set the HCP sensitive variables before applying Cognito; the identity provider resource reads them at apply time.
3. Apply dev infrastructure (auto-applies on push), then set the GitHub Environment variables from the new Terraform outputs, then run the first backend deploy so the placeholder Lambda is replaced with real code.
4. Deploy the frontend last — it depends on the API and the Cognito outputs existing.
5. Verify dev end to end, including the logged-out parity checks, before touching prod. Prod requires a manual HCP apply followed by a reviewer-gated workflow dispatch.

Rollback: the CloudFront changes are reversible in place. The DynamoDB table and Cognito pool carry `prevent_destroy`, so rolling back the application layer intentionally leaves them standing rather than destroying user data. Existing `?card=` URLs are unaffected at every stage — `SCHEMA_VERSION` stays at 4 and no encoding changes.

## Open Questions

- None material. (Email/password auth, a custom Cognito domain, shared card pools, per-user card state, a cookie-based BFF session, npm workspaces, and component tests were each considered and deferred as non-goals or accepted trade-offs above.)
