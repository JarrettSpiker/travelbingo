## Why

Each environment is reachable only via its default `*.cloudfront.net` URL. We want stable, branded URLs — prod at `travelbingo.ca` and dev at `dev.travelbingo.ca` — served over HTTPS with managed certificates.

## What Changes

- Re-introduce per-environment custom-domain support (previously removed): each CloudFront distribution gains an alias, an ACM certificate (DNS-validated), and a Route53 alias record.
- Prod → `travelbingo.ca`; dev → `dev.travelbingo.ca`. Both records live in the single `travelbingo.ca` hosted zone created by Route53 domain registration (dev is a subdomain, not a separate registration).
- Terraform **references** the registered hosted zone via a data source; it does not create or manage the zone itself.
- ACM certificates are provisioned via the default AWS provider (the infrastructure is pinned to `us-east-1`, which CloudFront requires for certificates).
- Custom domains are **optional per workspace**: a workspace without `domain_name`/`hosted_zone_name` still deploys with the default `*.cloudfront.net` URL.
- Expand the HCP Terraform (`tfc`) deploy roles in `infra/bootstrap/` with ACM and Route53 permissions. GitHub Actions roles and workflows are unchanged.

## Capabilities

### New Capabilities
- `custom-domains`: each environment is served over a custom HTTPS domain backed by a managed ACM certificate and a Route53 alias record.

### Modified Capabilities
<!-- none -->

## Impact

- **Infra (modified/new):** `infra/variables.tf` adds `domain_name` and `hosted_zone_name`; `infra/main.tf` adds `local.use_custom_domain` and switches the CloudFront `aliases` / `viewer_certificate`; `infra/dns.tf` is restored (hosted-zone data source, ACM certificate, DNS validation records, alias A record).
- **Bootstrap (modified):** `infra/bootstrap/tfc-roles.tf` adds `acm:*` and `route53:*` permissions.
- **Manual prerequisites:** register `travelbingo.ca` in Route53; add `domain_name` + `hosted_zone_name` to each HCP workspace; re-apply `infra/bootstrap`.
- **Dev environment:** in-place update (adds alias and swaps the certificate), with a brief CloudFront redeploy. No resource recreation.
- **No GitHub workflow changes** (deploys only sync S3 and invalidate by distribution ID) and **no app changes**.
