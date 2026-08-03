## 1. Raise the account quota (blocks everything; AWS-side wait)

- [ ] 1.1 Record the starting point: `aws lambda get-account-settings --query 'AccountLimit'`. The blocker is `UnreservedConcurrentExecutions` (50 at the time of writing), **not** the nominal `ConcurrentExecutions` of 1000
- [ ] 1.2 (manual) Request an increase for **Lambda → Concurrent executions** (quota code `L-B99A9384`) in Service Quotas, us-east-1. Ask for 1000; the justification is a production web API with a per-function reservation
- [ ] 1.3 (manual) Wait for AWS to grant it. This is a support-ticket turnaround, typically hours to a couple of days — nothing below can proceed until it lands
- [ ] 1.4 Confirm `UnreservedConcurrentExecutions` now exceeds `100 + 10`; if AWS granted less than requested, pick a reservation that still leaves 100 unreserved

## 2. Restore the reservation

- [ ] 2.1 (manual) Set `lambda_reserved_concurrency = 10` on the `travelbingo-dev` HCP workspace
- [ ] 2.2 Trigger a dev run and confirm the plan changes only `aws_lambda_function.api`, with no replacement
- [ ] 2.3 (manual) Set `lambda_reserved_concurrency = 10` on the `travelbingo-prod` workspace, then apply prod manually
- [ ] 2.4 Leave the `-1` default in `infra/variables.tf` alone — it is the correct fallback for an account that has not been granted the quota, and a fresh environment should not fail its first apply

## 3. Verify

- [ ] 3.1 `aws lambda get-function-concurrency --function-name travelbingo-dev-api` returns `10`, and the same for `travelbingo-prod-api`. The apply succeeding is not by itself proof the reservation took
- [ ] 3.2 Re-check `aws lambda get-account-settings`: unreserved must still be at or above 100, or AWS would have rejected the change
- [ ] 3.3 Confirm the API still serves traffic — `curl -i https://dev.travelbingo.ca/api/shares/doesnotexist` returns a JSON 404. A reservation of 0 rather than 10 would silently throttle every request instead
- [ ] 3.4 Update the abuse/cost risk note in `openspec/changes/add-user-accounts/design.md` (or the archived copy, if that change has been archived by then) to drop the "not currently set" caveat
- [ ] 3.5 Update `infra/README.md` if it still describes the reservation as absent
