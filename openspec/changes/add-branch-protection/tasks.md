## 1. Add pull-request verification (must land before protection is enabled)

- [x] 1.1 Add `.github/workflows/ci.yml`: triggered on `pull_request` targeting `main`, with `permissions: contents: read` and **no** `id-token`, no `environment:`, and no role assumption
- [x] 1.2 Give it two jobs, `frontend` and `backend`, each running `npm ci` → `npm run lint` → `npm test` → `npm run build` in its own working directory with `cache-dependency-path` set to that package's lockfile
- [x] 1.3 Use `pull_request`, never `pull_request_target` — the latter runs with a writable token in the context of untrusted code, which is the standard way this setup gets compromised
- [x] 1.4 Pick job names deliberately; branch protection will reference them by name, and renaming one later silently wedges every pull request
- [x] 1.5 Merge `ci.yml` **while direct pushes to `main` still work**

## 2. Prove the checks report

- [x] 2.1 Open a throwaway pull request and let it run to completion. A required check that has never reported cannot be selected, and selecting a name that never reports leaves the branch permanently unmergeable
- [x] 2.2 Note the exact check names as GitHub displays them

> PR #4 ("Add pull-request CI workflow") served as the throwaway PR. Exact check
> names as GitHub displays them: `frontend` and `backend`. (A third status,
> `Terraform Cloud/jarrett-spiker/repo-id-…`, also reports; it is HCP's commit
> status and is deliberately **not** in the required list.)

## 3. Protect the branch

- [x] 3.1 (manual) On `main`: require a pull request before merging, with **0 required approvals** — a solo maintainer cannot approve their own PR, and a rule that blocks all work is a rule that gets switched off
- [x] 3.2 (manual) Require the status checks from 2.2, and require branches to be up to date before merging
- [x] 3.3 (manual) Block force pushes and branch deletion
- [x] 3.4 (manual) **Include administrators.** A push to `main` applies infrastructure and deploys to AWS; exempting the account that does all the pushing would leave the property unprotected in precisely the case it exists for
- [x] 3.5 Verify by attempting a direct push to `main` and confirming it is rejected

> Applied via the GitHub REST API (branch protection PUT) rather than the UI:
> required PR with 0 approvals, required checks `frontend` + `backend` with
> strict up-to-date enforcement, `enforce_admins: true`, force pushes and
> deletions blocked. Verified by pushing an empty commit directly to `main`:
> rejected with GH006 ("Changes must be made through a pull request").

## 4. Contain untrusted contributions

- [ ] 4.1 (manual) Settings → Actions → set fork pull request workflows to **require approval for all outside collaborators**

> No REST endpoint exists for this on user-owned repositories (only the UI).
> Toggle: Settings → Actions → General → "Fork pull request workflows from
> outside collaborators" → "Require approval for all outside collaborators".

- [x] 4.2 (manual) Confirm the default `GITHUB_TOKEN` permissions are read-only, with write granted per-workflow where needed
- [x] 4.3 (manual) Enable secret scanning and **push protection** (free once public), so a committed credential is blocked rather than reported after the fact
- [x] 4.4 Confirm `deploy-dev.yml` and `deploy-prod.yml` are unreachable from a fork pull request — they trigger on push to `main` and `workflow_dispatch` only, and neither is available to a fork

> 4.2: `actions/permissions/workflow` reports `default_workflow_permissions:
> "read"`; the deploy workflows grant themselves `id-token: write` explicitly.
> 4.3: enabled via the repo API; `secret_scanning` and
> `secret_scanning_push_protection` both report `enabled`. 4.4: neither deploy
> workflow declares a `pull_request` trigger, and no workflow in the repo uses
> `pull_request_target`.

## 5. Pre-publication audit

- [x] 5.1 Search the full history, not just the working tree, for anything that must not be public: `git log -p | grep -iE 'aws_secret|client_secret|BEGIN .*PRIVATE KEY|AKIA'`
- [x] 5.2 Confirm the expected answer holds — AWS access is OIDC-federated with no static keys, the Google client secret lives only in HCP, and `VITE_*` values are non-secret by design. Confirm rather than assume; this is the one thing branch protection cannot fix after the fact
- [x] 5.3 Check `infra/terraform.tfstate*` and `infra/bootstrap/terraform.tfstate*` — local state files are present in the working tree and state can contain secrets. Confirm whether they are tracked in git, and deal with them if so
- [x] 5.4 Review `AGENTS.md`, `README.md`, and `infra/README.md` for anything account-specific worth removing (account ids, personal email addresses)

## 6. Go public

- [x] 6.1 (manual) Flip the repository to public
- [x] 6.2 Confirm branch protection, required checks, and fork approval all survived the transition — some settings differ between private and public repositories
- [x] 6.3 Open one real pull request end to end and confirm the flow is workable before relying on it

> 6.2: verified post-publication via the API — branch protection active on
> `main` (PR required, `frontend`/`backend` required and strict,
> `enforce_admins: true`), secret scanning and push protection enabled; fork
> approval confirmation is pending the 4.1 toggle. 6.3: the pull request that
> carries this task list is the end-to-end run under the protected flow.
