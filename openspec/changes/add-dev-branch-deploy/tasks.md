## 1. Add the dev branch as a dev-environment trigger

- [x] 1.1 In `.github/workflows/deploy-dev.yml`, change `on.push.branches` from `[main]` to `[main, dev]`. Leave `workflow_dispatch`, `permissions`, `concurrency`, and the `backend` → `dev` job wiring untouched
- [x] 1.2 Update the header comment (currently "on every push to main") so it says pushes to `main` **and** `dev`
- [x] 1.3 Confirm no other workflow references the dev branch trigger — `_deploy.yml` and `_deploy-backend.yml` are reusable `workflow_call`s and are unaffected; `deploy-prod.yml` stays `workflow_dispatch`-only

## 2. Verify the cloud authorization path needs no change

- [x] 2.1 Confirm `infra/bootstrap/gha-roles.tf` keys the OIDC `sub` claim on `environment:${env}`, not on a git branch — so a `dev`-branch run that sets `environment: dev` is admitted by the existing trust with **no** Terraform change
- [x] 2.2 Confirm no infra, IAM, or HCP Terraform edit is part of this change. If review concludes one *is* needed, stop and update the proposal/design — the "no infra change" property is the point of this change

## 3. Clear the GitHub Environment gate

- [ ] 3.1 (manual) Settings → Environments → `dev` → "Deployment branches": if it is restricted to `main`, switch to "All branches" (or add `dev`). A restriction pinned to `main` blocks a `dev`-branch run at the `environment:` step before any AWS call
- [ ] 3.2 (manual) Confirm `dev` has no required reviewers configured (a manual gate here would defeat an auto-deploy trigger)

## 4. End-to-end verification

- [ ] 4.1 Create the `dev` branch off the current `main` (it does not need to exist yet for the trigger; the branch filter just has to match the pushed ref)
- [ ] 4.2 Push a trivial, non-destructive change to `dev` and confirm a `deploy-dev` run fires from the `dev` ref (check the run's triggering branch in the Actions UI)
- [ ] 4.3 Confirm the run assumes the dev role via OIDC, ships the backend, then the frontend, and invalidates CloudFront — i.e. behaves identically to a `main`-triggered run
- [ ] 4.4 Push a second change to `main` while a `dev` run is in flight and confirm the existing `deploy-dev` concurrency group serializes them (neither is cancelled; last to finish is what dev serves)

## 5. Rollback (only if needed)

- [ ] 5.1 Remove `dev` from `on.push.branches` in `deploy-dev.yml`. No cloud resources were created, so there is nothing else to undo
