# Infrastructure

Provisions static hosting for the frontend on AWS: an S3 bucket (private,
accessed only via CloudFront) and a CloudFront distribution in front of it.
There is no compute and no database — the app is entirely client-side.

State and execution live in **HCP Terraform** (Remote execution), with one
workspace per environment. Per-environment values come from **HCP workspace
variables**, not a local `terraform.tfvars` (Remote VCS runs cannot take
`-var-file`). AWS authentication uses **dynamic provider credentials** (no
static AWS keys).

## Layout

- `main.tf`, `variables.tf`, `outputs.tf`, `versions.tf` — the application
  infrastructure (S3 + CloudFront), parameterized by environment.
- `backend.tf` — the HCP Terraform `cloud` backend block. **Edit this** to set
  your HCP organization name before migrating state.
- `bootstrap/` — separate, local-state config that provisions the AWS OIDC
  identity providers and deploy roles once, with administrator credentials. See
  `bootstrap/README.md`.

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

`bucket_name` is required; the rest have defaults if omitted. `domain_name` /
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

## Deploying the built frontend

GitHub Actions builds and deploys the app (lint, test, build, `s3 sync`,
CloudFront invalidation) — see `../.github/workflows/`. Terraform only
provisions the hosting; it does not build or upload the app. To deploy by hand
instead:

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

This deletes the S3 bucket and CloudFront distribution for that environment.
The OIDC providers and deploy roles live in `bootstrap/`; destroy them
separately if tearing everything down.
