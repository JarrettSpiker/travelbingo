## Context

The app is client-side-only, hosted on a private S3 bucket fronted by CloudFront. Terraform currently uses local state in a single AWS account with one `dev` environment; deploys are manual; there is no CI. GitHub repository: `JarrettSpiker/travelbingo`. See `proposal.md` for motivation. This change adds a `prod` environment, moves Terraform to HCP Terraform remote execution, and automates app builds/deploys via GitHub Actions — with zero static credentials.

## Goals / Non-Goals

**Goals:**
- Deploy the dev frontend automatically on every push to `main`.
- Deploy the prod frontend only via a manual, review-gated action.
- Run Terraform remotely in HCP Terraform with state off the laptop.
- Use short-lived credentials for every AWS hop; no long-lived AWS keys stored anywhere.
- Adopt dev's existing bucket/distribution (via state migration) rather than recreating them.

**Non-Goals:**
- No per-PR preview or ephemeral environments.
- No separate AWS accounts per environment (single account, separate resources).
- No automated release versioning or changelog generation (prod is a manual dispatch, not a tag/release-triggered flow).
- No moving the frontend build into HCP (built assets are gitignored; HCP runners cannot see `dist/`).
- No custom domains / ACM / Route53 (deferred).

## Decisions

- **Two AWS auth hops, no static keys.** Terraform → AWS via HCP **dynamic provider credentials** (OIDC issuer `app.terraform.io`; one role per environment: `travelbingo-tfc-dev`/`travelbingo-tfc-prod`). The app build/deploy → AWS via **GitHub OIDC** (issuer `token.actions.githubusercontent.com`; one role per environment: `travelbingo-gha-dev`/`travelbingo-gha-prod`). Rationale: dynamic provider credentials are required for HCP; the app deploy must run in GitHub Actions because HCP remote runners cannot see the gitignored `dist/`, so that hop necessarily uses GitHub OIDC. Both are ephemeral; no AWS access keys are stored in GitHub or HCP.
- **App build/deploy stays in GitHub Actions.** The dev/prod workflows run `lint → test → build → aws s3 sync → cloudfront create-invalidation`. Rationale: the build output is not in git and cannot be produced inside HCP; GitHub Actions is the only place that has both the repository and the built artifacts.
- **Infra runs in HCP remote; dev auto-applies, prod is manual.** The `cloud` backend targets workspaces by tag `travelbingo`; `travelbingo-dev` is VCS-connected with auto-apply on push to `main`; `travelbingo-prod` requires a human apply in the HCP UI. Rationale: matches the requested triggers; infrastructure changes are low-frequency and benefit from review.
- **Bootstrap is a separate local-state config.** `infra/bootstrap/` creates both OIDC identity providers and all four deploy roles, applied once with local administrator credentials. Rationale: remote execution and dynamic credentials require the providers and roles to pre-exist, so they cannot live in the very remote state they enable; a separate bootstrap cleanly breaks the cycle and keeps IAM role management out of the application-infra state.
- **Per-environment values live in HCP workspace variables, not committed tfvars.** HCP remote VCS runs cannot take a `-var-file` argument, so `bucket_name`, `environment`, etc. are set as Terraform Variables on each workspace. Rationale: idiomatic for remote/VCS; the trade-off (config not visible in PRs) is accepted because the values are non-secret and stable. The existing gitignored `terraform.tfvars` is removed.
- **Prod gate is a GitHub Environment with required reviewers.** The prod dispatch uses `environment: prod`. Rationale: complements the manual HCP prod infra apply and the manual dispatch with a human approval, with no extra tooling.

## Manual Prerequisites (created by you, not by code)

These cannot be created by Terraform or the workflow files and must be performed once before the pipeline works:

- **HCP Terraform:** organization; project; workspaces `travelbingo-dev` and `travelbingo-prod` (Execution Mode = Remote, VCS-connected to `JarrettSpiker/travelbingo` on branch `main`, working directory `infra`, tagged `travelbingo`). Dev workspace Auto-apply ON; prod Auto-apply OFF.
- **HCP Terraform workspace variables:** per workspace set `bucket_name` (`travelbingo-dev` / `travelbingo-prod`), `environment` (`dev`/`prod`), and `name_prefix` / `cloudfront_price_class` as needed.
- **HCP Terraform dynamic provider credentials:** on each workspace, configure AWS provider credentials (`TFC_AWS_PROVIDER_AUTH=true`, `TFC_AWS_RUN_ROLE_ARN=<tfc role ARN>`) pointing at the role the bootstrap creates.
- **GitHub:** install the HCP Terraform GitHub App on the repository (enables the VCS connection). Create Environments `dev` (no approval) and `prod` (required reviewers). Add repository variables `AWS_ROLE_GHA_DEV` and `AWS_ROLE_GHA_PROD`.
- **Local:** AWS administrator credentials and the `terraform` CLI, for the one-time `infra/bootstrap` apply and the dev state migration.
- **Not stored anywhere:** static AWS keys, or an HCP API token in GitHub. GitHub Actions never triggers HCP runs (dev = VCS auto-apply; prod = manual HCP UI apply), so `TF_API_TOKEN` is not needed.

**Order of operations:** HCP org/project + GitHub App → run `infra/bootstrap` apply (creates OIDC providers + roles) → configure HCP workspaces (variables + dynamic creds) + GitHub Environments/variables → dev state migration → first manual prod HCP apply → first prod dispatch.

## Risks / Trade-offs

- [Two OIDC identity providers and four roles increase initial setup complexity] → Accepted; justified by zero static credentials and least-privilege per environment.
- [Per-environment config lives in HCP, not in PRs] → Accepted; values are non-secret and change rarely.
- [Bootstrap requires local administrator credentials and the Terraform CLI once] → Accepted one-time cost; afterwards all applies run in HCP.
- [State migration that does not match existing resources risks recreate/destroy] → Mitigated by setting the dev workspace `bucket_name` to the existing `travelbingo-dev` before running `terraform init -migrate-state`.
- [App deploy and infra apply both fire on push to `main` and are decoupled] → Accepted; for a static app the rare case of an infra change on the same push as a dependent app change is gated by the manual prod apply.

## Open Questions

- None material. (Custom domains, per-PR previews, separate AWS accounts, and release-based prod triggers were considered and deferred as non-goals.)
