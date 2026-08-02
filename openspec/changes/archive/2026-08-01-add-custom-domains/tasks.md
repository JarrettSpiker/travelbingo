## 1. Variables and conditional

- [x] 1.1 Add `domain_name` and `hosted_zone_name` variables (default `""`) to `infra/variables.tf`
- [x] 1.2 Add `local.use_custom_domain = var.domain_name != "" && var.hosted_zone_name != ""` to `infra/main.tf`

## 2. DNS and certificate resources

- [x] 2.1 Restore `infra/dns.tf`: `data "aws_route53_zone"` looked up by `hosted_zone_name` (gated on `use_custom_domain`)
- [x] 2.2 Add `aws_acm_certificate` (DNS validation, `create_before_destroy`), Route53 validation records, and `aws_acm_certificate_validation`
- [x] 2.3 Add the Route53 alias **A record** (`domain_name` → the environment's CloudFront distribution)

## 3. CloudFront distribution

- [x] 3.1 Set `aliases = local.use_custom_domain ? [var.domain_name] : []`
- [x] 3.2 Switch `viewer_certificate` to ACM (sni-only) when `use_custom_domain`, else the CloudFront default cert

## 4. Bootstrap permissions

- [x] 4.1 Add `acm:*` and `route53:*` (both on `*`) to the tfc role permissions in `infra/bootstrap/tfc-roles.tf`
- [x] 4.2 Leave the GitHub Actions roles unchanged

## 5. Manual prerequisites (you)

- [x] 5.1 (manual) Register `travelbingo.ca` in Route53 (creates the hosted zone)
- [x] 5.2 (manual) Set `domain_name` + `hosted_zone_name` on the dev and prod HCP workspaces
- [x] 5.3 (manual) Re-apply `infra/bootstrap` so tfc roles gain ACM/Route53 permissions

## 6. Apply and verify

- [x] 6.1 Apply dev (in-place update: alias + cert swap, brief redeploy)
- [x] 6.2 Apply prod (creates the distribution with the domain from the start)
- [x] 6.3 Verify `https://travelbingo.ca` and `https://dev.travelbingo.ca` serve over HTTPS
