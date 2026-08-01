# Infrastructure

Provisions static hosting for the frontend on AWS: an S3 bucket (private,
accessed only via CloudFront) and a CloudFront distribution in front of it.
There is no compute and no database — the app is entirely client-side (see
`../openspec/changes/add-bingo-card-generator/design.md` for why).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/install) >= 1.5.0
- AWS credentials with permission to manage S3 and CloudFront, available
  via the standard AWS credential chain (env vars, `~/.aws/credentials`,
  or an SSO profile).

## Usage

```bash
cd infra
terraform init
terraform plan -var="bucket_name=<globally-unique-bucket-name>"
terraform apply -var="bucket_name=<globally-unique-bucket-name>"
```

Or set variables in a `terraform.tfvars` file (gitignored) instead of
passing `-var` flags each time.

## Deploying the built frontend

Terraform provisions the hosting; it does not build or upload the app.
After `terraform apply`:

```bash
cd ../frontend
npm run build
aws s3 sync dist/ "s3://$(terraform -chdir=../infra output -raw bucket_name)" --delete
aws cloudfront create-invalidation \
  --distribution-id "$(terraform -chdir=../infra output -raw cloudfront_distribution_id)" \
  --paths "/*"
```

## Destroying

```bash
terraform destroy -var="bucket_name=<same-bucket-name-used-above>"
```

This deletes the S3 bucket and CloudFront distribution. Since the app is
stateless, there's nothing else to clean up.
