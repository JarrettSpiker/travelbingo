## Why

Today the frontend is deployed by hand (`npm run build`, `aws s3 sync`, and a CloudFront invalidation) from a laptop against a single `travelbingo-dev` bucket/distribution. There is no CI, no production environment, and Terraform state is local — so deploys depend on one machine and one person, with no review gate for releasing to users. We want a repeatable pipeline: every push to `main` deploys a dev environment, and a production environment is deployed only via a manual, review-gated action.

## What Changes

- Add a second environment (`prod`) alongside the existing `dev`; each is its own private S3 bucket + CloudFront distribution in the same AWS account.
- Adopt HCP Terraform with **remote execution**: state leaves the laptop; the dev workspace auto-applies on push to `main`, the prod workspace requires a manual apply.
- Authenticate HCP Terraform to AWS via **dynamic provider credentials** (short-lived, OIDC-federated); no static AWS keys.
- Build and deploy the frontend via **GitHub Actions**: push to `main` → lint/test/build → sync to the dev bucket → invalidate dev; a manual `workflow_dispatch` against the `prod` GitHub Environment (required reviewers) does the same for prod.
- Authenticate GitHub Actions to AWS via **GitHub OIDC** roles (short-lived); no stored AWS credentials.
- Add `infra/bootstrap/` (local state) that provisions the two AWS OIDC identity providers and four deploy roles, applied once with administrator credentials.
- One-time manual setup (HCP Terraform org/project/workspaces, GitHub Environments, VCS/App connection, local admin credentials) is required and is not created by code.

## Capabilities

### New Capabilities
- `deployment-pipeline`: automated, gated, two-environment deployment of the client-side frontend to AWS S3 + CloudFront, with infrastructure managed by HCP Terraform using dynamic credentials.

### Modified Capabilities
<!-- none -->

## Impact

- **Infra (new):** `infra/bootstrap/` (OIDC providers + roles, local state); a `cloud` backend block in `infra`; `infra/main.tf` gains `name_prefix` and full environment parameterization; the gitignored `terraform.tfvars` is retired (values move to HCP workspace variables).
- **CI (new):** `.github/workflows/deploy-dev.yml`, `deploy-prod.yml`, and a reusable `_deploy.yml`.
- **State migration (manual, one-time):** the existing local `travelbingo-dev` state is pushed into the HCP dev workspace so resources are adopted, not recreated.
- **Manual prerequisites:** HCP Terraform org/project/workspaces, GitHub Environments, GitHub repo variables, the HCP GitHub App VCS connection, and local administrator AWS credentials for the bootstrap apply (detailed in `design.md`).
- No change to the app itself, the client-side-only constraint, or the share-URL contract.
