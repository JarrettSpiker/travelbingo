## Context

`main` is directly wired to a live AWS account: the VCS-connected HCP dev workspace auto-applies infrastructure on push, and `deploy-dev.yml` deploys the backend and frontend using OIDC-federated roles from `infra/bootstrap/`. Prod is already gated behind a manual, reviewer-approved dispatch. See `proposal.md` — Why.

Two facts shape the design. First, this is a **single-maintainer repository**, so any rule requiring another human to approve is a rule that blocks all work. Second, **no workflow currently runs on pull requests**, so there is no status check available to require.

## Goals / Non-Goals

**Goals:**
- Make an unreviewed commit on `main` impossible, including by the maintainer.
- Give branch protection something real to enforce, by adding PR verification first.
- Keep an outside contributor's pull request from executing anything privileged.
- Keep the maintainer able to ship without a second person.

**Non-Goals:**
- No change to how prod is gated; the manual dispatch plus required reviewer already covers it.
- No signed-commit requirement, no merge-queue, no CODEOWNERS. All are disproportionate at this size.
- No change to the AWS trust conditions or role scoping in `infra/bootstrap/`.
- Not a general public-launch checklist (licence, issue templates, support policy) beyond the security-relevant parts.

## Decisions

- **Require a pull request, but require zero approvals.** A solo maintainer cannot approve their own pull request, so requiring one approval would hard-block every change and the predictable outcome is that protection gets disabled at the first inconvenience. Zero-approval still forces every change onto a branch, through a PR, past CI, with a diff to read. The approval count becomes meaningful the moment a second contributor exists, and raising it then is a one-setting change. Rejected: requiring one approval now and using the admin bypass — that is protection that is never actually on.

- **Apply the rules to administrators.** The whole point is that a push to `main` reaches AWS. An exemption for the one account that does all the pushing would leave the property unprotected in exactly the case it is meant to cover. This is also what makes the rule real rather than decorative.

- **Add `ci.yml` before enabling required checks, not after.** Required status checks name specific jobs; naming a job that has never run leaves the branch permanently unmergeable and looks like a broken repo. The workflow must exist and have run once on a pull request before its checks can be selected. This ordering is the single most likely thing to go wrong.

- **`ci.yml` is deliberately credential-free.** No `id-token: write`, no `environment:`, no role assumption. It runs `npm ci`, lint, test, and build in `frontend/` and `backend/`. A workflow that touches AWS cannot safely run against proposed code from a stranger; keeping verification and deployment in separate workflows is what makes fork pull requests tolerable at all. This mirrors the existing split between `_deploy.yml` and `_deploy-backend.yml`.

- **Use `pull_request`, never `pull_request_target`.** `pull_request_target` runs the *base* repository's workflow with a *writable* token in the context of untrusted code, and is the standard way this class of setup is compromised. `pull_request` runs with a read-only token and no secrets for forks, which is exactly what is wanted.

- **Configure this in the GitHub UI, not Terraform.** Managing repository settings with the GitHub provider would need a GitHub token with admin scope stored somewhere, and HCP's AWS dynamic credentials do not extend to GitHub. That is a new long-lived secret and a new provider to protect the very rules meant to protect the repo — worse than the problem. These are a handful of one-time settings; the checklist lives in `tasks.md` and the requirements in the spec.

- **Enable secret scanning with push protection.** Free on public repositories, and it blocks a credential from being committed rather than reporting it afterwards. Cheap, and it fails in the right direction.

## Risks / Trade-offs

- [Every change now needs a branch and a pull request, including a one-line typo fix] → Accepted deliberately; that friction is the mechanism. `gh pr create --fill` plus auto-merge keeps it to seconds once `gh` is installed.
- [Zero required approvals means a maintainer can merge their own unreviewed code] → True, and it is a genuine weakening versus a two-person team. What is preserved is that the change is on a branch, has a diff, and has passed CI. Raising the count is one setting once there is someone to do the reviewing.
- [Required status checks can wedge the branch if a job is renamed] → Renaming a job in `ci.yml` silently leaves protection requiring a check that will never report, and every pull request hangs. Noted in `tasks.md`; the fix is to update the required-checks list in the same change that renames a job.
- [Making the repository public exposes its whole history, not just its current state] → Branch protection does nothing about what is already committed. The audit is a task here, but the real mitigation is that this project has never stored secrets in git: AWS access is OIDC-federated, the Google client secret lives in HCP, and `VITE_*` values are non-secret by design. That should be confirmed rather than assumed.
- [Fork approval is a manual step that will feel like friction on a popular repo] → Accepted; at this size the volume is near zero, and the alternative is letting a stranger's code trigger workflows in a repo wired to an AWS account.

## Migration Plan

Order matters, because two of these steps can lock the repository if done early.

1. Add `ci.yml` and merge it **while direct pushes still work**.
2. Open a throwaway pull request so the checks report once and become selectable.
3. Enable branch protection, selecting those checks.
4. Set the fork-approval policy and enable secret scanning.
5. Audit the history for anything that should not be public.
6. Only then make the repository public.

Rollback: every step is a settings toggle, reversible in the UI. `ci.yml` is additive and safe to leave in place regardless.

## Open Questions

- None blocking. Whether to add CODEOWNERS, signed commits, or a merge queue can be revisited if a second contributor appears; all are additive.
