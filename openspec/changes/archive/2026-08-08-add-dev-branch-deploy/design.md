## Context

`deploy-dev.yml` is the entry point that deploys the dev environment. It triggers on `push: branches: [main]` plus `workflow_dispatch`, and fans out to the reusable `_deploy-backend.yml` then `_deploy.yml`, both called with `environment: dev`. See `proposal.md` — Why for the motivation.

Three facts about the current setup shape this design:

1. The deploy is already environment-scoped, not branch-scoped. The reusable workflows set `environment: ${{ inputs.environment }}` (always `dev` here), and the GitHub OIDC role trust in `infra/bootstrap/gha-roles.tf` keys the `sub` claim on `environment:${env}` — see `gha-roles.tf:24-28`. Branch never appears in the trust condition.
2. A single `deploy-dev` concurrency group with `cancel-in-progress: false` already serializes every dev deploy against the same S3 bucket and Lambda.
3. Infrastructure is applied by a separate channel: the VCS-connected HCP Terraform dev workspace, which auto-applies on push to the default branch. GitHub Actions never applies infra.

## Goals / Non-Goals

**Goals:**
- Make a push to `dev` deploy the dev environment with the same guarantees a push to `main` already has (OIDC, backend-before-frontend, same bucket/Lambda).
- Keep it to a workflow edit — no infra, no role-trust change, no new environment, no new workflow.

**Non-Goals:**
- No change to how prod is gated.
- No change to HCP Terraform's watched branch; infra stays auto-applied on `main` only (see Risks).
- No protection on the `dev` branch itself. Whether `dev` should require pull requests pairs with the pending `add-branch-protection` change and is deferred.
- No per-branch dev environment. `main` and `dev` deploy to the *same* dev environment; last push wins.

## Decisions

- **Add `dev` to `on.push.branches` in `deploy-dev.yml`, nothing else.** The existing file already orchestrates backend-then-frontend and carries the concurrency group, so a new trigger reuses every guarantee for free. Rejected: a separate `deploy-dev-branch.yml` — it would duplicate the orchestration and, worse, race against `deploy-dev.yml` against the same S3 bucket and Lambda *without* sharing a concurrency group. One shared `deploy-dev` group is exactly what makes two trigger branches safe.

- **The OIDC role trust needs no change.** `gha-roles.tf:24-28` matches `repo:<owner>/<repo>:environment:dev` (and the immutable-format variant). A run triggered from `dev` that sets `environment: dev` mints the identical `sub` claim as one from `main`, so the existing trust admits it. Rejected: widening the condition to also match `ref:dev` — unnecessary, and it would add a branch-based path that weakens the environment-scoped control. This is the load-bearing finding: the change is genuinely a one-line edit because authorization was designed around environments, not branches.

- **Keep `cancel-in-progress: false`.** A `dev`-branch experiment mid-deploy should not be killed by a `main` push (or vice versa). Runs serialize under the existing group; whichever finishes last is what dev serves — the same last-push-wins behavior dev already has across successive `main` pushes. Flipping it to `true` would silently abort in-flight deploys and is out of scope.

- **Leave HCP Terraform on `main`.** Reconfiguring the dev workspace to watch `dev` (or standing up a second workspace) couples infrastructure to an integration branch and risks infra drift between what `main` and `dev` believe the world looks like. The common case for a `dev`-branch push is application code; infra changes can still be merged to `main`, which auto-applies.

## Risks / Trade-offs

- [The `dev` GitHub Environment may have a deployment-branch restriction pinned to `main`] → A per-environment "deployment branches" setting can restrict which branches may use `environment: dev`; if it lists only `main`, a `dev`-branch run is blocked at the `environment:` gate before any AWS call. This is a repo setting not visible in the repo, so it must be verified in Settings → Environments → dev. Mitigation: set it to "All branches" (or add `dev`) before relying on the trigger. Captured as a task.
- [A `dev`-branch push that depends on an infrastructure change deploys app code against stale infra] → Accepted. HCP stays on `main` by design (see Decisions). The operator pushes infra changes through `main`, which auto-applies, then the `dev` branch picks them up.
- [Anyone with write access can push `dev` and move the live dev environment] → Accepted; this is the same trust model `main` has today. Protecting `dev` is a deliberate non-goal, deferred to pair with `add-branch-protection`.
- [Two trigger branches can appear to race] → Mitigated by the shared `deploy-dev` concurrency group; they serialize, last finishes, no half-written environment.

## Migration Plan

1. In `.github/workflows/deploy-dev.yml`, change `branches: [main]` to `branches: [main, dev]`.
2. Verify the `dev` GitHub Environment's deployment-branch restriction allows `dev` (see Risks).
3. Create the `dev` branch off `main` and push a trivial change; confirm a `deploy-dev` run fires, assumes the dev role, and updates the dev S3 bucket / Lambda.

Rollback: remove `dev` from the branch list. No cloud resources were created, so there is nothing else to undo.

## Open Questions

- Whether and when to protect `dev` (require PRs into it, restrict who can push). Deferrable — it depends on how the `dev` branch is actually used and on team size, and it composes with `add-branch-protection` rather than changing anything this change specifies.
