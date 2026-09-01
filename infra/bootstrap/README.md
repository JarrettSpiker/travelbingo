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
  bucket, CloudFront invalidation, and code updates to the env Lambda).
- Backend Lambda execution roles: `travelbingo-lambda-dev`,
  `travelbingo-lambda-prod` (assumed by the backend function at runtime; scoped
  to item operations on the env DynamoDB table and writes to its own log
  stream).

> CloudFront distribution IDs are assigned by AWS and cannot be predicted at
> bootstrap time, so CloudFront permissions are account-scoped. The same applies
> to Cognito user pool IDs and API Gateway API IDs. S3, DynamoDB, Lambda, and
> CloudWatch Logs permissions are scoped to each environment's resources.

### Why the Lambda execution roles live here

The main config could create them, but then the HCP Terraform roles would need
`iam:CreateRole` and `iam:PutRolePolicy` — which would let a VCS-triggered
auto-apply workspace attach an arbitrary inline policy to a role it creates,
making it effectively an administrator. Creating them here instead means the
`travelbingo-tfc-*` roles hold exactly one IAM permission: `iam:PassRole` on the
single matching `travelbingo-lambda-*` ARN, conditioned on
`iam:PassedToService = lambda.amazonaws.com`.

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

- `tfc_role_arns.<key>` → HCP workspace dynamic provider credentials
  (`TFC_AWS_RUN_ROLE_ARN`).
- `gha_role_arns.<key>` → GitHub Environment variable `AWS_ROLE_ARN` on the
  matching environment.
- `lambda_execution_role_arns.<key>` → HCP workspace variable
  `lambda_execution_role_arn`.

…for each of the four keys: `dev`, `prod`, `office-dev`, `office-prod`.

## The `environments` map

Every environment is one entry in `var.environments`. Adding a brand is two
entries and nothing else.

⚠️ **The map keys are part of the IAM role address.** `for_each` keys appear in
the resource address (`aws_iam_role.tfc["dev"]`), so renaming one destroys and
recreates the role — and the existing ARNs are already pasted into HCP and
GitHub configuration, so a recreate breaks every running deploy. This is why the
travel entries are keyed `dev` and `prod` rather than `travel-dev` and
`travel-prod`, and why **adding a brand must show a plan of additions only.**
Check that before applying.

`github_environment` is an explicit field rather than a reuse of the key, even
though the two are equal for every entry today. They were previously equal by
coincidence — the GitHub OIDC subject came from the key while role names came
from a separate suffix — and an entry where they diverged would produce a role
nothing can assume, with no error until a deploy fails at the assume step.

## Re-run

Re-run only if you change OIDC/role configuration. It is intentionally separate
from `../` (the HCP-managed main config).

**A re-apply is required before the backend can be provisioned.** The main
config cannot create the DynamoDB table, Cognito pool, API, or Lambda until the
widened `travelbingo-tfc-*` permissions and the `travelbingo-lambda-*` execution
roles exist here. Re-apply with administrator credentials, then set
`lambda_execution_role_arn` on both HCP workspaces from the new output, and only
then let the main config apply.
