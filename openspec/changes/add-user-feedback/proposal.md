## Why

There is currently no way for anyone to tell the maintainer that something is wrong. The application has no footer, no contact address, and no support surface of any kind — a person who hits a broken print layout or a confusing control has nowhere to go but closing the tab. That was tolerable while there was one site with one audience. There are now two brands with different audiences, and the second one shipped a full palette, a full copy set, and a footer-less interface that nobody outside this repository has ever commented on.

The other reason is diagnostic. Reports that arrive by word of mouth arrive without the one thing that makes them actionable: which brand, which environment, which route, which build. A feedback channel that captures its own context turns "the print is broken" into a reproducible report, and that is most of the value of building one rather than publishing an email address.

## What Changes

- **A feedback channel, reachable from a new footer.** The application gains a footer — its first — carrying a feedback entry point. The footer is brand-aware and is also the natural future home for the about and privacy links this application will eventually need.
- **Submitting requires being signed in.** This is the anti-abuse control, chosen deliberately over a public endpoint with throttling, a honeypot, and IP-derived rate limiting. Every submission carries a Cognito `sub`, which makes a per-user cap possible and makes an abusive submitter blockable. **The cost is accepted and named:** the application is fully functional signed out, so the people most worth hearing from — those who bounced off before signing in — cannot reach this channel. The footer link is nevertheless shown to signed-out visitors, explaining that sign-in is required rather than hiding the channel or presenting a dead end.
- **Feedback carries its own context, collected automatically.** Brand, environment, the route the user was on, viewport, user agent, and the build identifier. The submitter writes prose; the system supplies the facts they would otherwise be asked for and get wrong.
- **The context excludes anything sensitive.** Card content is never attached, matching the existing rule that card text is not written to logs. No plaintext IP address is stored — there is no public endpoint here to rate-limit by address, so there is no reason to keep one.
- **A contact address is optional and captured at the moment of consent.** The session's address is not harvested. A submitter who wants a reply types one and is told what it is for; a submitter who does not gets a one-way channel and no stored address. This matches the principle `add-email-notifications` establishes for the notification channel.
- **The build publishes its own identifier.** The frontend build receives the commit SHA, so a report can be tied to the exact artifact the reporter was running rather than to whatever is deployed when the report is read.
- **Feedback is read from the command line.** A `scripts/feedback.sh` selecting brand and environment the same way `scripts/dev-user.sh` does. Deliberately not a page in the application: rendering attacker-controlled text in an authenticated admin view would create an injection surface and a moderation burden, and a terminal has neither.
- **Submissions expire.** Feedback carries a TTL, so an unbounded archive of stranger-written prose does not accumulate.
- **Unchanged:** the card renderer, the stored card shape, and both contract tests; every existing route and its authorization; the signed-out experience of every card capability, none of which is affected by a footer; the brand seam's rules, which the new copy simply obeys; and all Terraform — the table's TTL is already enabled and this change adds no resource.

## Capabilities

### New Capabilities
- `user-feedback`: How a person submits feedback — who may, what a submission carries, what is never attached to one, how a contact address is consented to, how volume is bounded per account, how submissions expire, and how they are read back.

### Modified Capabilities
- `backend-api`: The payload-validation requirement currently speaks only of card payloads; it is generalized to every client-supplied payload, so a second kind of untrusted input is bounded by the same rule rather than by a parallel one. The log-exclusion rule is extended to cover feedback text and a submitter's contact address, alongside credentials, share tokens, and card contents.
- `deployment-pipeline`: The frontend build gains a build identifier, so a deployed artifact is identifiable from the browser.

**Deliberately not modified.** Three existing requirements already govern this change and are recorded here so their absence from the list is not read as an oversight: `backend-api`'s single-table requirement already carries the scenario "A new entity type is introduced", which is exactly what feedback is; `brand-theming`'s "Brand-varying copy is declared and complete" already forces every brand to supply any newly declared string, so the footer's copy needs no new rule; and `app-visual-design`'s chrome requirements already bind the footer's appearance. Inventing requirements for these would restate rules that already hold.

## Impact

- **Backend** (`backend/src/`): a new `routes/feedback.ts` and `lib/feedbackPayload.ts`; a new key prefix in `lib/keys.ts`; one authenticated route in `router.ts` — **not** an addition to its deliberately short public list, since sign-in is required.
- **Frontend** (`frontend/src/`): a new `SiteFooter` rendered by `AppShell`, and a feedback dialog; new brand-varying copy keys in both brands; a build-identifier value exposed to the application.
- **Brand content** (`frontend/src/brand/*/copy.ts`): footer and feedback strings for both brands, in each brand's own register.
- **Scripts** (`scripts/`): `feedback.sh`, selecting brand and environment as `dev-user.sh` does, since brand isolation is stack isolation and each brand's feedback lands in its own table.
- **CI/CD** (`.github/workflows/`): the commit SHA is passed to the frontend build. No new GitHub Environment variable is required — it is already available to the workflow.
- **Infra** (`infra/`): **none.** The table's TTL is already enabled on `expiresAt`, the route is authenticated so it needs no stricter throttle, and no new resource is created.
- **Contract tests**: unchanged in intent; the brand copy parity guard picks up the new keys automatically.
- **Out of scope**: feedback from signed-out visitors, in any form including a `mailto:` fallback; an in-application admin view of submissions; any reply mechanism, whether by email or through the notification bell — the address is captured so a human can reply out of band, and nothing in the application sends anything; screenshots or attachments of any kind; voting, triage state, or issue tracking; and any third-party feedback service.
