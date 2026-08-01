## 1. Bootstrap configuration (infra/bootstrap/, local state)

- [x] 1.1 Create `infra/bootstrap/` with local state; add IAM OIDC identity providers for `app.terraform.io` and `token.actions.githubusercontent.com`
- [x] 1.2 Add roles `travelbingo-tfc-dev` / `travelbingo-tfc-prod` (trust `app.terraform.io:sub` = `organization:<org>:project:<project>:workspace:<env>`; permissions to manage S3 + CloudFront for that environment)
- [x] 1.3 Add roles `travelbingo-gha-dev` / `travelbingo-gha-prod` (trust `repo:JarrettSpiker/travelbingo:environment:<env>`; permissions = S3 put/get/list on the env bucket + CloudFront invalidation on the env distribution)
- [x] 1.4 Output all four role ARNs
- [x] 1.5 Add `infra/bootstrap/README.md` documenting the one-time local apply

## 2. HCP Terraform integration (manual prerequisites + code)

- [ ] 2.1 (manual) Create HCP org/project; workspaces `travelbingo-dev` and `travelbingo-prod` (Remote, VCS-linked to the repo, branch `main`, working directory `infra`, tag `travelbingo`)
- [ ] 2.2 (manual) Dev workspace Auto-apply ON; prod Auto-apply OFF
- [x] 2.3 Add a `cloud` backend block (organization + `workspaces { tags = ["travelbingo"] }`) to `infra`
- [ ] 2.4 (manual) Set workspace Terraform Variables: `bucket_name`, `environment`, `name_prefix`, `cloudfront_price_class`
- [ ] 2.5 (manual) Enable AWS dynamic provider credentials on each workspace, pointing at the `tfc-<env>` role ARN

## 3. Multi-environment infra config

- [x] 3.1 Add `var.name_prefix`; ensure all resources are fully parameterized by environment
- [x] 3.2 Remove reliance on the gitignored `terraform.tfvars` (values now in HCP workspace variables)
- [ ] 3.3 Migrate existing dev state into HCP (`terraform login && terraform init -migrate-state`); confirm dev workspace vars match the existing bucket so nothing is recreated
- [ ] 3.4 (manual) First prod apply in the HCP UI creates the prod bucket/distribution

## 4. GitHub Actions app pipeline

- [ ] 4.1 (manual) Create GitHub Environments `dev` (no approval) and `prod` (required reviewers)
- [ ] 4.2 (manual) Add GitHub Environment configuration variables — on each environment set `AWS_ROLE_ARN`, `S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID` (resolved per environment by the reusable workflow)
- [x] 4.3 Add `.github/workflows/_deploy.yml` (input: environment) → lint/test/build, OIDC assume role, `s3 sync`, CloudFront invalidation
- [x] 4.4 Add `.github/workflows/deploy-dev.yml` (push to `main` → calls `_deploy` with `dev`; `environment: dev`)
- [x] 4.5 Add `.github/workflows/deploy-prod.yml` (`workflow_dispatch`, `environment: prod` → calls `_deploy` with `prod`)

## 5. Verification

- [ ] 5.1 Push a change → dev infra auto-applies in HCP and dev app auto-deploys in Actions; confirm the dev CloudFront URL serves the new build
- [ ] 5.2 Manual prod apply in HCP creates prod infra; manual prod dispatch deploys the app; confirm the prod CloudFront URL serves
- [ ] 5.3 Confirm no static AWS credentials exist in GitHub secrets or HCP workspace variables
- [x] 5.4 From `frontend/`: `npm run lint && npm test && npm run build` all pass
