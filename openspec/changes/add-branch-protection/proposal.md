## Why

The repository is private today, so `main` is protected by nothing but the fact that one person can push to it. That is adequate while the audience is one trusted maintainer. It stops being adequate the moment the repo is public, because `main` is directly wired to infrastructure and cloud credentials:

- A push to `main` **auto-applies dev infrastructure** through the VCS-connected HCP workspace.
- A push to `main` **auto-deploys the dev frontend and backend** using OIDC-federated AWS roles.

So an unreviewed commit on `main` is an unreviewed change to a live AWS account. Making the repo public also invites fork pull requests, and this project's workflows assume AWS access.

There is also a prerequisite gap: **no workflow runs on pull requests at all.** `_deploy.yml` runs lint, test, and build, but only on push to `main` and on manual dispatch. There is therefore nothing a branch protection rule could require as a status check — the check has to exist before it can be enforced.

This change exists so the work is captured now, while the reasoning is fresh, rather than being remembered under time pressure on the day the repo is flipped public.

## What Changes

- Add `.github/workflows/ci.yml`, running lint, test, and build for **both** `frontend/` and `backend/` on pull requests targeting `main`. It performs no deploy, assumes no AWS role, and requests no `id-token` permission.
- Protect `main`: require a pull request, require the CI checks to pass, block force pushes and branch deletion, and apply the rules to administrators.
- Require approval before workflows run for fork pull requests, so an outside contributor cannot cause a privileged workflow to execute.
- Enable secret scanning with push protection (free on public repositories).
- Document the pre-publication checklist, including the audit of what is already committed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment-pipeline`: gains requirements covering how changes reach the default branch. The capability already specifies what happens *after* a push to `main` (dev auto-deploys, prod is review-gated) but says nothing about what may *become* a commit on `main`. Three requirements are added: the default branch is protected, changes are verified before merge, and workflows triggered by untrusted contributors require approval.

## Impact

- **New:** `.github/workflows/ci.yml`.
- **GitHub repository settings:** branch protection (or a ruleset) on `main`, Actions fork-PR approval policy, secret scanning. These are console settings, not Terraform — see design.md for why.
- **Workflow:** direct pushes to `main` stop working, including for the maintainer. Every change goes through a pull request from then on.
- **No application code, no infrastructure code.** `infra/`, `backend/`, and `frontend/` source are untouched.
- **Not addressed here:** the AWS-side blast radius if a deploy role were ever misused. The OIDC trust conditions and per-environment role scoping already in `infra/bootstrap/` remain the control for that.
