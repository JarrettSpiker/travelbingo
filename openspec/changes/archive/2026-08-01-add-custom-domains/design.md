## Context

The deployment pipeline provisions a private S3 bucket + CloudFront distribution per environment (`dev`, `prod`), managed by HCP Terraform. Each distribution currently serves only on its default `*.cloudfront.net` URL; custom-domain support was removed in an earlier simplification. This change restores it in a per-environment, HCP-managed form. See `proposal.md` for motivation and the `deployment-pipeline` capability for the hosting baseline.

## Goals / Non-Goals

**Goals:**
- Serve prod at `travelbingo.ca` and dev at `dev.travelbingo.ca` over HTTPS.
- Use managed ACM certificates validated via DNS.
- Keep custom domains optional per workspace (default CloudFront URL still works).
- Make no changes to the app or the GitHub Actions deploy pipeline.

**Non-Goals:**
- No `www.travelbingo.ca` / apex-to-www redirect (apex only).
- No wildcard certificates.
- No managing/registering the domain or hosted zone from Terraform (registration is manual via Route53).
- No region portability work; ACM stays pinned to `us-east-1` via the default provider.

## Decisions

- **One domain registration, one hosted zone.** Register only `travelbingo.ca`; `dev.travelbingo.ca` is a subdomain. Both the apex alias and the dev alias records (plus their validation records) live in the single `travelbingo.ca` hosted zone that Route53 creates at registration. Rationale: avoids a second registration and a second zone.
- **Reference the zone, don't manage it.** Use `data "aws_route53_zone"` looked up by `var.hosted_zone_name`. Rationale: the zone is created outside Terraform (by Route53 registration); importing/managing it would risk accidental deletion and adds nothing.
- **Conditional per workspace.** `local.use_custom_domain = var.domain_name != "" && var.hosted_zone_name != ""`. All DNS/ACM resources and the distribution alias/certificate are gated on it. Rationale: a workspace can still deploy without a domain; keeps the change non-breaking.
- **ACM via the default provider (us-east-1 pinned).** CloudFront requires ACM certs in us-east-1; the default provider is already us-east-1, so no aliased provider is introduced. Rationale: simplest; works with HCP dynamic provider credentials without a second provider configuration. The trade-off is that moving infra off us-east-1 would require revisiting ACM region (accepted, since the app is pinned to us-east-1).
- **DNS validation, not email.** ACM certificates use DNS validation with records created in the referenced zone. Rationale: automatable and renewable without human action.
- **Bootstrap roles widened.** The `tfc` deploy roles gain `acm:*` and `route53:*` (both account-scoped on `*`, since the hosted-zone ID is not known at bootstrap time). GitHub Actions roles are unchanged because app deploys never touch DNS or certificates.

## Manual Prerequisites (created by you, not by code)

- **Route53:** register `travelbingo.ca`. This auto-creates the hosted zone used by both environments.
- **HCP workspace variables:** set `domain_name` (`dev.travelbingo.ca` / `travelbingo.ca`) and `hosted_zone_name` (`travelbingo.ca`) on the `travelbingo-dev` and `travelbingo-prod` workspaces.
- **Bootstrap re-apply:** re-run `infra/bootstrap` so the `tfc` roles pick up the new ACM/Route53 permissions before the domain resources are applied.

## Risks / Trade-offs

- [Dev distribution undergoes an in-place update (alias + certificate swap), triggering a brief CloudFront redeploy] → Accepted; no resource is recreated and the existing `travelbingo-dev` bucket/distribution are preserved.
- [First apply with a domain is slower because ACM DNS validation takes several minutes] → Accepted; only affects the apply that introduces the certificate.
- [ACM and Route53 permissions are account-scoped in the tfc roles because the zone ID is unknown at bootstrap] → Accepted trade-off; could be tightened later by passing the hosted-zone ID into the bootstrap config.
- [Pinning ACM to us-east-1 via the default provider couples certificate region to `aws_region`] → Accepted; the app is intentionally pinned to us-east-1.

## Open Questions

- None material. (`www` support, wildcard certs, and region portability were considered and deferred as non-goals.)
