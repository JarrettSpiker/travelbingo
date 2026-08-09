## 1. Mail service access (blocks production; file this first)

- [ ] 1.1 (manual) File the AWS support request for SES production sending access for the production account. A new SES account is in the sandbox and can only send to individually verified addresses; the request is reviewed by a human on their timetable, so it is the long pole and blocks nothing else in development.
- [ ] 1.2 (manual) Verify the `scripts/dev-user.sh` test identities' addresses in the dev environment's SES sandbox, so the whole feature is exercisable in dev while 1.1 is outstanding.

## 2. Infra: sending identity and DNS

- [ ] 2.1 Add an SES domain identity for the environment's `domain_name` in `infra/`, with DKIM enabled, gated on a domain being configured — an environment with no custom domain must not be configured to send at all rather than sending unauthenticated. One identity per environment, so dev cannot send as prod.
- [ ] 2.2 Create the DKIM CNAME records and the MAIL FROM records in the hosted zone that `infra/dns.tf` already looks up by data source. The zone stays referenced, never managed — this adds record types to the existing rule, it does not change it.
- [ ] 2.3 Add an SES configuration set with an SNS destination for bounce and complaint events, and wire the sending path to use it.

## 3. Infra: the delivery function

- [ ] 3.1 Add the delivery Lambda's runtime execution role to `infra/bootstrap/` — applied locally with administrator credentials, because the remote Terraform execution role deliberately cannot create roles or attach policies. Scope it narrowly: read the table's stream, read and update `NOTIFPREFS` items, `ses:SendEmail` through the configuration set, and subscribe to the bounce/complaint topic.
- [ ] 3.2 Grant the remote Terraform execution role permission to pass **only** that named role to Lambda, matching how the existing API function's role is handled.
- [ ] 3.3 Enable a DynamoDB stream on the existing table in `infra/dynamodb.tf` with a new-image view. Do not touch the table's key schema, its `prevent_destroy` lifecycle, or its PITR setting.
- [ ] 3.4 Add the second Lambda in `infra/lambda.tf` and its event source mapping, with a **filter pattern on the sort-key prefix** so the function is invoked only for `NOTIF#` inserts and never for card saves, trip edits, or progress updates. Add the SNS subscription for bounce and complaint events as its second trigger.
- [ ] 3.5 `terraform plan` against dev shows the SES resources, the DNS records, the stream, the function, and the mappings — and no destructive diff to the table or the user pool.

## 4. Backend shared logic

- [ ] 4.1 Create `backend/src/lib/unsubscribeToken.ts` reusing the opaque-token pattern from `backend/src/lib/shareToken.ts`: 16 random bytes base64url from `deps.randomBytes`, minted per recipient rather than per message and stored on their preferences item. Co-locate its test.
- [ ] 4.2 Extend the notification-preferences shape and its validator in `backend/src/lib/notificationPayload.ts` with `emailEnabled` (default `false`), `emailAddress?`, `emailDisabledReason?` (`"bounced" | "complained" | "unsubscribed"`), and the unsubscribe token. The validator must reject an `emailAddress` supplied by the client outright — the address comes only from the verified credential. Extend `notificationPayload.test.ts`.
- [ ] 4.3 Create `backend/src/lib/emailTemplates.ts`: plain-text and minimal-HTML bodies for the win and near-miss messages, naming the member, the trip, and a link to it. No card entries, no marked-square text, no tracking pixel, no click wrapping. Export the `List-Unsubscribe` and `List-Unsubscribe-Post` header values. Co-locate `emailTemplates.test.ts` asserting the bodies contain no card contents and that both headers are present.
- [ ] 4.4 Define the eligible-type allowlist in one place — `victory` and `one_away` only — and have both the delivery function and the preferences surface read it, so `progress_marked` is structurally undeliverable rather than merely defaulted off.

## 5. Backend API changes

- [ ] 5.1 On the enable-email path in `backend/src/routes/notifications.ts`, write `emailAddress` from the verified JWT `email` claim, minting an unsubscribe token if the user has none. Never read the address from the request body, and never from the `TRIP#`/`MEMBER#` roster item, whose `email` is documented as display-only and captured at join time.
- [ ] 5.2 Add `resolveUnsubscribe` and register `GET /api/unsubscribe/{token}` in `backend/src/router.ts` as `public: true` — the third entry in that deliberately short list. It sets `emailEnabled: false` and `emailDisabledReason: "unsubscribed"`, grants no read access to anything, and returns an identical response for an unknown token so the endpoint cannot be used to discover whether an address is registered.
- [ ] 5.3 Add the corresponding route to `infra/apigateway.tf` **without** the Cognito authorizer, paralleling `GET /api/shares/{token}` and `GET /api/invites/{token}`.
- [ ] 5.4 Extend `backend/src/routes/notifications.test.ts`: enabling email captures the credential's address; a body-supplied address is ignored; disabling stops delivery; re-enabling refreshes the address; an unknown unsubscribe token returns the same response as a valid one; a valid token disables email and returns no trip, card, profile, or notification data.

## 6. Backend delivery function

- [ ] 6.1 Add a second entry point under `backend/src/` for the delivery handler and a second esbuild output in `backend/build.mjs`. It shares `backend/src/lib/` with the API function so the templates, the token helper, and the preference shapes have exactly one definition.
- [ ] 6.2 Implement the stream handler: for each inserted `NOTIF#` item, drop it unless its type is in the eligible allowlist; load the recipient's `NOTIFPREFS`; drop it unless `emailEnabled` is true and no `emailDisabledReason` is set; then send through SES with the configuration set, the unsubscribe headers, and the link. The notification item **is** the fan-out — recipients, muting, per-type preferences, actor exclusion, and membership were all resolved when it was written, so none of that is recomputed here.
- [ ] 6.3 Implement the bounce/complaint consumer on the same function: a hard bounce or any complaint sets `emailEnabled: false` with the matching `emailDisabledReason`; a soft bounce is ignored.
- [ ] 6.4 Log failures without the recipient's address or their unsubscribe token, extending the existing rule that logs exclude credentials, share tokens, and card contents.
- [ ] 6.5 Co-locate tests using the existing `backend/src/testing/fakeDdb.ts` harness plus an injected SES client in the `Deps` style: an ineligible type is dropped; a recipient with email disabled is skipped; a recipient with a `emailDisabledReason` is skipped; an eligible notification sends exactly one message carrying both unsubscribe headers; a hard bounce disables and a soft bounce does not; a complaint disables; a replayed stream record may send twice and must not write a duplicate notification, win, or mark.
- [ ] 6.6 Run `npm run lint && npm test && npm run build` in `backend/`; all must pass, and the build must emit both bundles.

## 7. CI/CD

- [ ] 7.1 Update the backend deploy workflow (`.github/workflows/_deploy-backend.yml`) to update **both** functions from the same build in the same run, failing the deploy if either update fails.

## 8. Frontend

- [ ] 8.1 Add an email channel toggle to the notification-preferences section of `frontend/src/pages/SettingsPage.tsx`. Present individual marks as available in the application only, in words, rather than as a disabled email option — the point is that it is not offerable, not that it is switched off.
- [ ] 8.2 Show the disabled state and its reason (bounced, complained, unsubscribed) when email has been disabled automatically, with an affordance to enable it again.
- [ ] 8.3 Add a public unsubscribe confirmation page reachable without sign-in, routed in `frontend/src/routes.tsx` alongside the existing public share and invite routes.
- [ ] 8.4 Add gallery entries in `frontend/src/dev/gallery/registry.tsx` for the email toggle (off, on, and each disabled reason) and the unsubscribe confirmation page.

## 9. Verification

- [ ] 9.1 `npm run lint && npm test && npm run build` pass in **both** `frontend/` and `backend/`.
- [ ] 9.2 Visual QA via `npm run capture -- /settings` and the unsubscribe route, in light and dark at 390px and 1440px. Confirm the unsubscribe page renders signed out and issues no authenticated request.
- [ ] 9.3 Confirm `npm run capture -- /` still reports zero `/api/` requests signed out.
- [ ] 9.4 Confirm the card renderer is untouched: `cardGrid.guard.test.ts` passes unchanged and `CardGrid.tsx`/`App.css` carry no diff from this change.
- [ ] 9.5 End-to-end in dev with two `scripts/dev-user.sh` identities whose addresses are verified in the sandbox: B enables email; A wins a card and B receives a signed message; check the received message authenticates (DKIM passes) and carries both the visible link and the `List-Unsubscribe` header; B's near-miss mail arrives once, not per subsequent mark; A marks many squares and B receives nothing for them; B follows the unsubscribe link while signed out and subsequent events produce no mail while B's in-application notifications continue.
- [ ] 9.6 Send to an address known to hard-bounce (SES's simulator) and confirm the channel disables itself with reason `bounced`; send to the complaint simulator and confirm reason `complained`; confirm a soft-bounce simulator address does not disable.
- [ ] 9.7 Confirm production email stays disabled until task 1.1 is granted, and that the dev environment continues to work under the sandbox restriction.
- [ ] 9.8 Confirm the saved-card contract tests are unchanged.
