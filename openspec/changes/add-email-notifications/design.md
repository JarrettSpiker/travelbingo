## Context

`add-play-notifications` established the event pipeline this change delivers. Its shapes are the input here:

- `USER#<sub>` / `NOTIF#<isoTs>#<rand>` — one item per recipient per event, carrying `type`, `tripId`, `tripTitle`, `actorId`, `tripCardId`, `expiresAt`. Written only for members subscribed to that type in that trip, never for the actor.
- `USER#<sub>` / `NOTIFPREFS` — per-type toggles and `mutedTripIds`, with `progress_marked` off by default.
- Emission runs after the mark is durably written and never fails it.

The repo's own precedents constrain the rest:

- `backend/src/lib/shareToken.ts` and `routes/shares.ts` define the opaque-token capability pattern: 16 random bytes base64url, a collision-retried conditional put, and a **public** route (`GET /api/shares/{token}`) marked `public: true` in `backend/src/router.ts`'s deliberately visible list of exactly two such routes.
- `infra/dynamodb.tf` carries `prevent_destroy` and PITR on the table, with a comment that new entity types cost no Terraform change.
- `infra/lambda.tf` provisions one Lambda whose execution role comes from the separately-applied `infra/bootstrap/`, which owns every runtime role — and the remote execution role deliberately cannot create roles or attach policies.
- `openspec/specs/custom-domains/spec.md` establishes that the hosted zone is referenced by data source and never managed, with records created inside it.
- `AGENTS.md`: backend logs must not record credentials, share tokens, or card contents.

See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals**
- Deliver only `victory` and `one_away` by email, and make `progress_marked` structurally undeliverable rather than merely defaulted off.
- Keep sending entirely off the play request path, so no member ever waits on mail and no mail failure can lose a mark or a win.
- Reuse the fan-out from `add-play-notifications` rather than recomputing recipients.
- Capture the recipient's address at the moment they consent, not before.
- Ship a working one-click unsubscribe that needs no sign-in, and automatic disablement on bounce or complaint.
- Name the AWS production-access request as a blocking manual prerequisite up front.

**Non-Goals**
- Browser push, SMS, or any third channel.
- Digests, batching, or quiet hours. Each qualifying event is one message.
- Receiving mail. There is no inbound path and no reply address that reaches a person.
- Rich templates, tracking pixels, or open/click analytics.
- Changing which events exist, when they fire, who they fan out to, or how muting works — all inherited unchanged.
- Any change to the card renderer, the saved-card shape, or the two contract tests.

## Decisions

### Decision: Delivery is driven by the change stream on the notification records

Enable a DynamoDB stream on the existing table (new-image view) and attach a second Lambda with an event source mapping. It reacts to newly inserted `USER#<sub>` / `NOTIF#` items, and for each one decides whether to send.

This is the decision the whole change hangs on, and the reasoning is worth stating plainly. The alternative — calling SES inline in the API Lambda at the end of `markTripCardSlot` — would put up to 49 sequential `SendEmail` calls inside a request a member is waiting on, in a handler whose entire job is to add one number to a set. Even at the realistic scale (wins and near-misses only, so a handful of recipients) it couples a member's mark to a third-party service's availability, and it means retrying a transient SES failure would mean retrying the mark.

The stream inverts that. Emission stays exactly as `add-play-notifications` wrote it — the API Lambda's last act is still a batch write it does not wait on results from — and delivery becomes a separate, independently retried, independently deployable concern. The recipient computation is not duplicated: **the notification item is the fan-out**, so anyone who should be told already has a row, and the delivery function only has to decide the channel.

It also gives failure isolation in the direction that matters: a broken template or a throttled SES cannot make the game unplayable, and a Lambda-level failure in delivery is retried by the event source mapping without any custom queue.

**Alternative considered:** SQS between the API Lambda and a consumer. Rejected — it is the same number of moving parts as the stream, plus a queue to provision, plus an explicit enqueue call on the play path that can itself fail. The stream is a property of a table that already exists.

**Alternative considered:** a scheduled sweep of unsent notifications. Rejected — it needs a "sent" flag and its own consistency story, and it turns a real-time alert into something up to a poll interval late, which for "one square away" is the whole value.

**Cost of the decision to state honestly:** the delivery function sees *every* write to the table, not only notifications, and filters. That is a real inefficiency, mitigated by an event-source filter pattern on the sort-key prefix so the function is not invoked for card saves at all.

### Decision: `progress_marked` is structurally barred from email

The delivery function handles exactly two types. `progress_marked` is not an option the user can enable for email; the preferences shape has no email toggle for it, the settings page says so in words, and the delivery function drops it.

Making it a default rather than a rule would be a mistake of a specific kind: the cost of someone switching it on is not borne by them alone. A five-member trip marking a hundred squares over a weekend is four hundred messages from one sending domain, which is how a domain's reputation is destroyed — and once destroyed, the *wins* stop arriving too. The noisy option is barred to protect the quiet ones.

The type is unaffected in the bell and the activity feed, where volume costs nothing and the user can scroll past.

### Decision: The address is captured at opt-in, from the verified credential

The `USER#<sub>` / `NOTIFPREFS` item grows:

```
emailEnabled: boolean          <- false until explicitly turned on
emailAddress?: string          <- the verified `email` claim, written at opt-in
emailDisabledReason?: "bounced" | "complained" | "unsubscribed"
```

The address is written from the JWT's verified `email` claim on the request that enables the channel — never from a request body, and never from `TRIP#`/`MEMBER#`'s `email` attribute, which `add-trips` documented as display-only and which is a per-trip copy captured at join time. Taking it from the credential on the enabling request means the address is current, verified by the identity provider, and recorded at the moment the user asked to be mailed. That last point is the one that matters: consent and capture are the same action, so there is never a stored address belonging to someone who has not asked to hear from us.

If a user's Google address changes, re-enabling refreshes it. A stale address that bounces disables itself (below).

**Alternative considered:** looking the address up from Cognito at send time. Rejected — it puts an identity-provider call inside the delivery path, and it would let mail be sent to an address the user never consented to being mailed at.

### Decision: Unsubscribe is a public capability token, following the share-link pattern

Every message carries a `List-Unsubscribe` header (with `List-Unsubscribe-Post` for one-click) and a visible link. Both point at a new **public** route:

```
GET /api/unsubscribe/{token}
```

The token is minted per recipient, not per message, and stored on their preferences item — 16 random bytes base64url from the same generator `lib/shareToken.ts` uses, where the unguessable token *is* the capability. Resolving it sets `emailEnabled: false` and `emailDisabledReason: "unsubscribed"`, and the frontend renders a plain confirmation page.

**No sign-in.** A person who wants mail to stop must not be made to authenticate first — that is the behaviour that gets a sender reported as spam rather than merely unsubscribed. This makes it the third entry in `router.ts`'s public list, which is deliberately short and deliberately visible; adding to it is a decision, and this is the justification.

The token disables one thing and grants nothing: it cannot read a trip, a card, or a profile, and it reveals nothing about whose it is. An unknown token returns the same confirmation as a known one, so the endpoint cannot be used to test whether an address is registered.

### Decision: Bounces and complaints disable the address automatically

An SES configuration set publishes bounce and complaint events to SNS, consumed by the same delivery function through a second trigger. A **hard** bounce or any complaint sets `emailEnabled: false` with the corresponding `emailDisabledReason`. Soft bounces are ignored — a full mailbox is temporary.

This is not optional hygiene. Continuing to send to an address that has hard-bounced, or to someone who pressed "report spam", is precisely what moves a sending domain onto a blocklist, at which point every member stops receiving wins regardless of their preferences. Automatic disablement is what keeps one bad address from costing everyone the feature.

The user sees the disabled state and its reason on the settings page and can re-enable, which re-captures the address from their current credential — the correct recovery when the bounce was caused by a changed address.

### Decision: SES identity and signing records live in the existing hosted zone

Terraform provisions an SES domain identity for the environment's domain, with DKIM enabled, and creates the resulting CNAME signing records plus the MAIL FROM records in the hosted zone the `custom-domains` capability already looks up by data source. The zone is still referenced, never managed — the existing rule holds unchanged, this change only adds record types to it.

Per-environment identities, so dev cannot send as prod. Where an environment has no `domain_name`, the mail feature is simply not configured, mirroring how the custom domain itself is optional.

**Production access is a blocking manual prerequisite.** A new SES account is in the sandbox: it can only send to addresses individually verified within it. Dev can live there indefinitely — the `scripts/dev-user.sh` identities can be verified by hand. Prod cannot, and the AWS support request that lifts it is reviewed by a human on their timetable. It is called out as a `(manual)` task with everything downstream of it depending on it, so it is filed early rather than discovered on launch day.

### Decision: The delivery function is a second Lambda, deployed by the same workflow

`infra/lambda.tf` gains a second function with its own execution role, created — like the existing one — in `infra/bootstrap/`, because the remote Terraform execution role deliberately cannot create roles or attach policies and may only pass a specific named role. Its permissions are the narrow set it needs: read the stream, read and update `NOTIFPREFS` items, and `ses:SendEmail`.

The backend deploy workflow updates both functions from the same build. They share `backend/src/lib/`, so the templates, the token helper, and the preference shapes have exactly one definition. Keeping delivery in a separate function rather than a second entry point of the same one is what makes the failure isolation real: a delivery deploy cannot take the API down.

`backend/build.mjs` produces a second bundle; both are esbuild outputs from the same source tree.

### Decision: Messages are plain, and contain nothing the recipient could not already see

A message states who did what, in which trip, and links to the trip. It does **not** include the card's contents or the square that was marked. That is partly restraint about volume of detail, and partly a visibility question: in a competitive trip, the specific entries on another member's card are arguably theirs, and an email is a copy that leaves the application permanently. The link is the disclosure mechanism, and it is governed by the same trip membership check as everything else.

No tracking pixel, no click wrapping, no open analytics.

## Risks / Trade-offs

- **The sending domain's reputation is a shared, fragile resource.** → Three mitigations, all load-bearing: `progress_marked` cannot be emailed at all; bounces and complaints disable addresses automatically; and nothing is sent to anyone who has not explicitly opted in.
- **Production sending is gated on a human at AWS.** → Named as a blocking manual task with everything downstream depending on it. Dev works in the sandbox with hand-verified identities throughout, so the feature is fully testable before the request is granted.
- **The delivery function sees every table write.** → Filtered at the event source on the sort-key prefix, so it is not invoked for card saves, trip edits, or progress updates. Without that filter this would be a genuine waste.
- **A stream-driven send has at-least-once semantics.** → A retried batch can re-send a message. Accepted: a duplicate win email is mildly annoying, and the alternative — a "sent" flag written back per notification, doubling writes and creating its own consistency problem — costs more than the failure. The idempotency that matters (one win record per card) is already guaranteed upstream.
- **A public unsubscribe route is a third entry in a deliberately short list.** → Justified above: requiring sign-in to stop mail is how a sender gets reported rather than unsubscribed. The token disables one thing, grants no read access, and returns an identical response for known and unknown tokens.
- **Storing an email address is storing personal data the application previously kept only in transit.** → Captured only at explicit opt-in, only from the verified credential, removable by unsubscribing, and excluded from logs by the extended logging rule. The per-trip `MEMBER#` email captured at join is untouched and remains display-only.
- **Two Lambdas can drift in their dependencies or Node version.** → Same package, same build, same `backend/src/lib/`, deployed together by one workflow.
- **Email arriving for a trip the recipient has since left.** → The notification row was written while they were a member and was true then; the link resolves to the existing trips 404. Consistent with how the bell already handles it.

## Migration Plan

Additive and reversible. No data migration: the new preference fields are absent for every existing user, and absent means the channel is off.

1. **File the SES production-access request first.** It is the long pole and blocks nothing else in development.
2. Infra, in a separate apply from the code: SES domain identity, DKIM and MAIL FROM records in the referenced hosted zone, and the configuration set with its SNS destination. Then the second Lambda's execution role in `infra/bootstrap/` (applied locally with admin credentials, as that directory requires), then the function, the table stream, and the event source mapping with its filter in the HCP-managed configuration.
3. Backend: `lib/unsubscribeToken.ts` → `lib/emailTemplates.ts` (+tests) → the email fields on the preferences shape and its validator (+tests) → the address-capture-on-opt-in path → the public unsubscribe route in `router.ts` → the delivery function and its handler (+tests) → the bounce/complaint consumer.
4. Frontend: the email toggle and disabled-reason display on `pages/SettingsPage.tsx`, and the public unsubscribe confirmation page.
5. Deploy to dev. Verify with `scripts/dev-user.sh` identities whose addresses are verified in the SES sandbox.
6. Prod only after production access is granted.

Rollback is disabling the event source mapping — mail stops immediately, and the bell, the feed, and play are entirely unaffected. Stored addresses and tokens are inert.

## Open Questions

- **Whether a near-miss email should name the square.** More compelling, but it copies a competitor's card contents into an inbox permanently. Deliberately excluded for now.
- **Whether wins should also mail the winner.** They already know; a "congratulations" is either delightful or patronizing, and it is one line to add either way.
- **Whether to add a global quiet-hours or per-day cap.** Only two rare types can be emailed, so volume should be self-limiting. Worth revisiting if a very large trip proves otherwise.
- **Whether the reply-to should be a real monitored address.** Currently no-reply. Someone will reply anyway.
