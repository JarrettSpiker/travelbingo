# Bootstrap

One-time, local-state Terraform that provisions the AWS identity providers and
deploy roles the deployment pipeline depends on. It is **not** managed by HCP
Terraform: remote execution and dynamic provider credentials require these
resources to exist first, so they live in their own local-state config applied
with administrator credentials.

Creates:

- IAM OIDC identity providers for `app.terraform.io` (HCP Terraform) and
  `token.actions.githubusercontent.com` (GitHub Actions).
- HCP Terraform deploy roles: `travelbingo-tfc-dev`, `travelbingo-tfc-prod`
  (assumed by HCP via dynamic provider credentials; scoped to each
  environment's S3 bucket + CloudFront).
- GitHub Actions deploy roles: `travelbingo-gha-dev`, `travelbingo-gha-prod`
  (assumed by GitHub Actions via OIDC; scoped to S3 put/get/delete on the env
  bucket and CloudFront invalidation).

> CloudFront distribution IDs are assigned by AWS and cannot be predicted at
> bootstrap time, so CloudFront permissions are account-scoped. S3 permissions
> are scoped to each environment's bucket.

## Apply (once)

```bash
cd infra/bootstrap
terraform init
terraform apply \
  -var="hcp_organization_name=<your-hcp-org>" \
  -var="hcp_project_name=Default"
```

Only `hcp_organization_name` is required (defaults: `github_org=JarrettSpiker`,
`github_repo=travelbingo`, workspace/bucket names as in the main config). Use
`hcp_project_name` only if you created a custom HCP project.

After it completes, capture the role ARNs from the outputs:

- `tfc_role_arns.dev` / `tfc_role_arns.prod` → HCP workspace dynamic provider
  credentials (`TFC_AWS_RUN_ROLE_ARN`).
- `gha_role_arns.dev` / `gha_role_arns.prod` → GitHub Environment variable
  `AWS_ROLE_ARN` for the `dev` / `prod` environments.

## Re-run

Re-run only if you change OIDC/role configuration. It is intentionally separate
from `../` (the HCP-managed main config).
