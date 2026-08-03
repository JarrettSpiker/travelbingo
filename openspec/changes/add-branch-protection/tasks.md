## 1. Add pull-request verification (must land before protection is enabled)

- [ ] 1.1 Add `.github/workflows/ci.yml`: triggered on `pull_request` targeting `main`, with `permissions: contents: read` and **no** `id-token`, no `environment:`, and no role assumption
- [ ] 1.2 Give it two jobs, `frontend` and `backend`, each running `npm ci` → `npm run lint` → `npm test` → `npm run build` in its own working directory with `cache-dependency-path` set to that package's lockfile
- [ ] 1.3 Use `pull_request`, never `pull_request_target` — the latter runs with a writable token in the context of untrusted code, which is the standard way this setup gets compromised
- [ ] 1.4 Pick job names deliberately; branch protection will reference them by name, and renaming one later silently wedges every pull request
- [ ] 1.5 Merge `ci.yml` **while direct pushes to `main` still work**

## 2. Prove the checks report

- [ ] 2.1 Open a throwaway pull request and let it run to completion. A required check that has never reported cannot be selected, and selecting a name that never reports leaves the branch permanently unmergeable
- [ ] 2.2 Note the exact check names as GitHub displays them

## 3. Protect the branch

- [ ] 3.1 (manual) On `main`: require a pull request before merging, with **0 required approvals** — a solo maintainer cannot approve their own PR, and a rule that blocks all work is a rule that gets switched off
- [ ] 3.2 (manual) Require the status checks from 2.2, and require branches to be up to date before merging
- [ ] 3.3 (manual) Block force pushes and branch deletion
- [ ] 3.4 (manual) **Include administrators.** A push to `main` applies infrastructure and deploys to AWS; exempting the account that does all the pushing would leave the property unprotected in precisely the case it exists for
- [ ] 3.5 Verify by attempting a direct push to `main` and confirming it is rejected

## 4. Contain untrusted contributions

- [ ] 4.1 (manual) Settings → Actions → set fork pull request workflows to **require approval for all outside collaborators**
- [ ] 4.2 (manual) Confirm the default `GITHUB_TOKEN` permissions are read-only, with write granted per-workflow where needed
- [ ] 4.3 (manual) Enable secret scanning and **push protection** (free once public), so a committed credential is blocked rather than reported after the fact
- [ ] 4.4 Confirm `deploy-dev.yml` and `deploy-prod.yml` are unreachable from a fork pull request — they trigger on push to `main` and `workflow_dispatch` only, and neither is available to a fork

## 5. Pre-publication audit

- [ ] 5.1 Search the full history, not just the working tree, for anything that must not be public: `git log -p | grep -iE 'aws_secret|client_secret|BEGIN .*PRIVATE KEY|AKIA'`
- [ ] 5.2 Confirm the expected answer holds — AWS access is OIDC-federated with no static keys, the Google client secret lives only in HCP, and `VITE_*` values are non-secret by design. Confirm rather than assume; this is the one thing branch protection cannot fix after the fact
- [ ] 5.3 Check `infra/terraform.tfstate*` and `infra/bootstrap/terraform.tfstate*` — local state files are present in the working tree and state can contain secrets. Confirm whether they are tracked in git, and deal with them if so
- [ ] 5.4 Review `AGENTS.md`, `README.md`, and `infra/README.md` for anything account-specific worth removing (account ids, personal email addresses)

## 6. Go public

- [ ] 6.1 (manual) Flip the repository to public
- [ ] 6.2 Confirm branch protection, required checks, and fork approval all survived the transition — some settings differ between private and public repositories
- [ ] 6.3 Open one real pull request end to end and confirm the flow is workable before relying on it
