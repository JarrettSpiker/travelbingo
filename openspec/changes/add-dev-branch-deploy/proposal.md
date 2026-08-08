## Why

Today the dev environment only deploys from `main` (`deploy-dev.yml` triggers on `push: branches: [main]`). That leaves no way to get a work-in-progress change onto dev for testing without committing it to `main`. The pending `add-branch-protection` change makes that worse: once `main` becomes pull-request-only, every change — including throwaway experiments an operator wants to see running on dev — has to go through a reviewed merge before it can reach the dev environment.

A long-lived `dev` integration branch that also deploys to the dev environment fixes this: push to `dev` to get live feedback against dev's API and data, keep `main` as the reviewed trunk. Both branches deploy to the same dev environment; last push wins.

## What Changes

- Add `dev` to the `push` branch trigger in `.github/workflows/deploy-dev.yml`, so the dev backend and frontend redeploy on pushes to `dev` **and** to `main` (plus the existing `workflow_dispatch`).
- No new workflow, no new environment, no new AWS role, no concurrency change. The existing `deploy-dev` concurrency group already serializes runs against the same dev S3 bucket and Lambda, so a `main` push and a `dev` push cannot race.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `deployment-pipeline`: the requirement that the dev environment redeploys "on every push to the default branch" is broadened to cover pushes to the default branch **and** to a long-lived `dev` integration branch. The dev branch is an additional trigger for the same dev environment, not a new environment.

## Impact

- **Changed:** `.github/workflows/deploy-dev.yml` — one branch added to an existing `on.push.branches` list.
- **Workflow:** a push to `dev` now deploys the dev environment with no human intervention, exactly as a push to `main` already does. Anyone with write access to the `dev` branch can move the dev environment.
- **No application code, no infrastructure code.** `infra/`, `backend/`, and `frontend/` source are untouched.
- **Not addressed here:** HCP Terraform's dev workspace remains VCS-connected to the default branch and auto-applies infra only on push to `main`. A `dev`-branch push that depends on an infrastructure change will not get that infra applied — see design.md. Protecting the `dev` branch itself is also out of scope.
