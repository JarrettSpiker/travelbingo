# Infrastructure

Provisions the app's AWS infrastructure: static hosting for the frontend (a
private S3 bucket behind CloudFront), plus the account backend — a DynamoDB
table, a Cognito user pool federated to Google, a Lambda function, and an API
Gateway HTTP API served same-origin at `/api/*` through the same CloudFront
distribution.

State and execution live in **HCP Terraform** (Remote execution), with one
workspace per environment. Per-environment values come from **HCP workspace
variables**, not a local `terraform.tfvars` (Remote VCS runs cannot take
`-var-file`). AWS authentication uses **dynamic provider credentials** (no
static AWS keys).

## Layout

- `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` — hosting (S3 +
  CloudFront), parameterized by environment.
- `dynamodb.tf` — the single table holding all account data.
- `cognito.tf` — user pool, hosted domain, Google identity provider, SPA client.
- `lambda.tf` — the backend function and its log group. Terraform creates it
  with a placeholder; **GitHub Actions ships the real code**.
- `apigateway.tf` — HTTP API, JWT authorizer, routes, throttling.
- `cloudfront_function.js` — the SPA fallback, attached to the S3 behavior only
  so that API responses are never rewritten into the app shell.
- `backend.tf` — the HCP Terraform `cloud` backend block. **Edit this** to set
  your HCP organization name before migrating state.
- `bootstrap/` — separate, local-state config that provisions the AWS OIDC
  identity providers, deploy roles, and the Lambda execution roles once, with
  administrator credentials. See `bootstrap/README.md`.

## Manual prerequisites

Do these once, before the first apply of the account infrastructure:

1. **Apply `bootstrap/`** with administrator credentials. Nothing below can
   succeed until the widened deploy-role permissions and the
   `travelbingo-lambda-*` execution roles exist.
2. **Create two Google OAuth 2.0 Web clients** (one per environment) in Google
   Cloud, and configure the consent screen. The authorized redirect URI is
   `https://<cognito_domain_prefix>.auth.us-east-1.amazoncognito.com/oauth2/idpresponse`
   — by default `travelbingo-dev` / `travelbingo-prod`.

   While the consent screen is in "Testing", only explicitly listed test users
   can sign in (capped at 100), so it must be **published** before prod.
   Publishing needs no Google verification review, because `openid`, `email`,
   and `profile` are all non-sensitive scopes.

   The **Test users** list is how you grant anyone — including yourself —
   access to dev while in Testing mode. Note that a Gmail plus-alias is the
   same Google account and will not give you a second identity; see "Test
   accounts" in the root `README.md` before testing anything multi-user.

   Cognito domain prefixes are globally unique per region, and availability is
   only truly confirmed at apply time. If an apply fails on a collision, change
   the `cognito_domain_prefix` workspace variable and edit the redirect URI in
   the Google client — no code change.
3. **Set the HCP workspace variables** below, including the two sensitive ones.
4. **Create an AWS Budgets alert** at roughly $5/month. This is the first
   surface in the project where a bug can generate cost.

   Filter it to **this project's services only** — S3, CloudFront, DynamoDB,
   Lambda, API Gateway, CloudWatch, Cognito, ACM. An unfiltered budget on a
   shared AWS account is worthless here: domain registration, Route 53 across
   other domains, Lightsail, and tax together dwarf this project's spend, so
   the alert would either fire constantly or never move in response to anything
   this app did. Route 53 is deliberately excluded even though the hosted zone
   is project infrastructure, because it is shared with unrelated domains.

   The live budget is `travelbingo-monthly` (80% actual, 100% forecasted). It
   is created by hand rather than in Terraform: budgets are account-wide, not
   per-environment, so neither workspace owns it.

## HCP workspace variables

Set these as Terraform Variables on each workspace:

| Variable | dev workspace | prod workspace |
| --- | --- | --- |
| `bucket_name` | `travelbingo-dev` | `travelbingo-prod` |
| `environment` | `dev` | `prod` |
| `name_prefix` | _(empty)_ | _(empty)_ |
| `cloudfront_price_class` | `PriceClass_100` | `PriceClass_100` |
| `domain_name` | `dev.travelbingo.ca` | `travelbingo.ca` |
| `hosted_zone_name` | `travelbingo.ca` | `travelbingo.ca` |
| `lambda_execution_role_arn` | from `bootstrap` output | from `bootstrap` output |
| `google_oauth_client_id` | **sensitive** | **sensitive** |
| `google_oauth_client_secret` | **sensitive** | **sensitive** |
| `cognito_domain_prefix` | _(empty → `travelbingo-dev`)_ | _(empty → `travelbingo-prod`)_ |

`bucket_name`, `lambda_execution_role_arn`, and the two Google OAuth values are
required; the rest have defaults if omitted. Mark both Google values
**sensitive** — they must never reach the repository or GitHub. `domain_name` /
`hosted_zone_name` are optional — leave both empty to serve via the default
`*.cloudfront.net` URL. When set, register `travelbingo.ca` in Route53 first
(it creates the hosted zone that both environments reference).

## Triggers

- **dev workspace:** VCS-connected, auto-applies on push to `main`.
- **prod workspace:** VCS-connected, plans on push but requires a **manual
  apply** in the HCP UI.

## One-time state migration (dev)

The existing `travelbingo-dev` resources were created with local state. Adopt
them into HCP so they are not recreated. First set `bucket_name=travelbingo-dev`
on the dev workspace, then:

```bash
cd infra
terraform login
TF_WORKSPACE=travelbingo-dev terraform init -migrate-state
```

Confirm the plan shows no recreate/destroy before the first dev apply.

## Outputs → GitHub Environment variables

After the first apply, set these on the matching GitHub Environment (`dev` /
`prod`) as **variables**, not secrets — none of them is a secret, and all three
`VITE_*` values appear in any network trace:

| Terraform output | GitHub Environment variable |
| --- | --- |
| `lambda_function_name` | `LAMBDA_FUNCTION_NAME` |
| `cognito_domain` | `VITE_COGNITO_DOMAIN` |
| `cognito_user_pool_client_id` | `VITE_COGNITO_CLIENT_ID` |
| `site_url` (or the custom domain) | `VITE_APP_ORIGIN` |

Because the `VITE_*` values are baked in at build time, **dev and prod builds
from the same commit are no longer byte-identical**. That was already
effectively true via different buckets and domains.

## Deploying the built app

GitHub Actions builds and deploys both packages — see `../.github/workflows/`.
The backend deploys first, then the frontend that depends on it. Terraform
provisions the infrastructure; it never builds or uploads application code, and
never updates the Lambda's code. To deploy the frontend by hand instead:

```bash
cd ../frontend
npm run build
aws s3 sync dist/ "s3://<bucket_name>" --delete
aws cloudfront create-invalidation --distribution-id "<distribution_id>" --paths "/*"
```

## Destroying

Run from the HCP workspace (or locally with `TF_WORKSPACE` set):

```bash
terraform destroy
```

> ⚠️ **This is now a data-loss operation.** The DynamoDB table and the Cognito
> user pool carry `lifecycle { prevent_destroy = true }`, so a destroy will fail
> until you deliberately remove that guard. Recreating the user pool changes
> every user's `sub`, which orphans their saved cards even though the card data
> itself survives. Point-in-time recovery is enabled on the table, but there is
> no restore runbook.

This deletes the S3 bucket, CloudFront distribution, and backend resources for
that environment. The OIDC providers, deploy roles, and Lambda execution roles
live in `bootstrap/`; destroy them separately if tearing everything down.
