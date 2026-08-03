## Why

The backend Lambda currently runs with **no concurrency reservation**. It was meant to carry `reserved_concurrent_executions = 10` as the hard ceiling on what a runaway loop or a scripted attack can spend, but the first dev apply failed:

> `InvalidParameterValueException: Specified ReservedConcurrentExecutions for function decreases account's UnreservedConcurrentExecution below its minimum value of [100]`

AWS refuses any reservation that would leave the account's unreserved pool below 100. This account reports **50** available despite a nominal quota of 1000 — the reduced initial limit AWS applies to newer accounts and raises over time. No reservation of any size was possible, so `lambda_reserved_concurrency` was introduced defaulting to `-1` (unreserved) to unblock the deploy.

That was the right call under time pressure, but it leaves a gap with nothing forcing anyone to revisit it: the `backend-api` capability requires that the API "cap the concurrency of the backend compute", and the deployed system does not. This change exists so that unmet requirement is tracked rather than forgotten.

## What Changes

- Request a Lambda **Concurrent executions** quota increase through AWS Service Quotas, so the account's unreserved pool comfortably exceeds `100 + reservation`.
- Once granted, set `lambda_reserved_concurrency` on the `travelbingo-dev` and `travelbingo-prod` HCP workspaces to restore the ceiling. No code change is required — the variable exists for exactly this.
- Verify the reservation is actually live on both functions, rather than assuming the apply implies it.
- Remove the "not currently set" caveat from the `add-user-accounts` design note, so the recorded mitigation again matches reality.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. The `backend-api` requirement "The API bounds its own resource consumption" already states that the system SHALL cap the concurrency of the backend compute. This change brings the deployment into compliance with that existing requirement; it does not alter any requirement. `.openspec.yaml` therefore sets `skip_specs: true`.

## Impact

- **AWS account:** a Service Quotas increase request for Lambda concurrent executions. Account-wide, not per-environment.
- **HCP Terraform:** a new `lambda_reserved_concurrency` value on both workspaces. The Terraform variable and its `-1` default already exist in `infra/variables.tf` and stay as the safe fallback.
- **`openspec/changes/add-user-accounts/design.md`:** the abuse/cost risk note is updated once the ceiling is back.
- **No application code.** `backend/` and `frontend/` are untouched.
- **Until this lands**, API Gateway stage throttling (20 rps / 40 burst, 5/10 on the public share route) and the `travelbingo-monthly` $5 budget alert are the only cost controls. Both remain in place.
