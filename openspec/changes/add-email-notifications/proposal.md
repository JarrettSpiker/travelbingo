## Why

`add-play-notifications` built the event pipeline and put a bell in the application header. That bell only rings for people who are already in the application, which is exactly the people who did not need telling. The events worth interrupting someone for — a trip-mate one square from winning, a trip-mate winning — happen while everyone is out doing the thing the trip is about, with the application closed. A notification that requires the recipient to already be looking is a log, not a notification.

Email is the right second channel for this application, and the choice is not arbitrary. Sign-in is Google-only, so every account already has a verified email address behind it; there is no address to collect and no new identity to manage. Browser push would need a service worker, a permission prompt that most people decline, and per-device subscription state that goes stale silently — considerably more machinery to reach fewer people. Email reaches everyone, on every device, with no prompt.

What email brings with it is a genuinely different class of risk from anything else in this repository, and that is why it is a separate change rather than a section of the previous one. Sending mail means a mail service, domain signing records in the DNS zone, a production access request that a human at AWS has to approve, bounce and complaint handling that has real consequences for the domain's reputation if neglected, and a working unsubscribe link that is a legal requirement rather than a courtesy. None of that belongs in the same review as a badge on a bell icon.

The single most important design constraint is restraint. An individual square being marked can fire dozens of times an hour in an active trip; mailing it would be indistinguishable from an attack on the recipients, and would burn the sending domain's reputation within a day. So the mark event is structurally barred from email — not merely off by default, but not offerable — and only the two rare, genuinely interesting events can ever reach an inbox.

## What Changes

- **Wins and near-misses can be delivered by email.** A member who opts in receives a message when a trip-mate wins a card or comes within one square of the trip's target. Both are rare enough to be worth an interruption every time.
- **Individual marks can never be emailed.** The event type that fires most often is barred from the email channel entirely, rather than being an option a user could switch on and regret. It remains available in the bell and in the trip's activity feed.
- **Email is off until the user turns it on, and turning it on is when their address is captured.** Nothing is sent to anyone who has not asked for it. The verified address from the user's sign-in credential is recorded at the moment they enable the channel — the moment of consent is the moment of capture — rather than being harvested from anywhere it already happens to sit.
- **Sending happens away from the play path.** A member marking a square never waits on mail being sent, and mail that cannot be sent never fails a mark or a win. Delivery is driven by the notification records the previous change already writes, so the fan-out logic is reused rather than rebuilt.
- **Every message carries a working one-click unsubscribe.** Both a link in the message and the header mail clients use for their own unsubscribe button. Following it disables email for that recipient without requiring them to sign in, because a person who wants mail to stop should not have to log in to make it stop.
- **Addresses that bounce or complain are disabled automatically.** A hard bounce or a spam complaint turns the channel off for that address without waiting for anyone to notice, because continuing to send to a bad address is what destroys a sending domain's standing.
- **The sending domain is signed.** Signing records are published in the same hosted zone the application's own domain records live in, so mail is authenticated rather than arriving as an unsigned message from an unfamiliar sender.
- **Production requires a human-approved access request.** A new mail account can only send to addresses it has individually verified until AWS grants general sending access. This is stated as a real, blocking, manual prerequisite rather than discovered on launch day.
- **Unchanged:** who may mark and when; win detection and recording; which events exist and when they fire; the in-application bell, the activity feed, and per-trip muting, all of which apply to email identically; the card renderer; the saved-card shape and both contract tests; and the signed-out experience.

## Capabilities

### New Capabilities
- `email-delivery`: Delivery of notifications to a member's verified email address — which events qualify, how the channel is enabled and the address captured, how sending is decoupled from play, how recipients unsubscribe, and how bouncing and complaining addresses are disabled.

### Modified Capabilities
- `deployment-pipeline`: Backend code deployment covers every backend function rather than a single one, since delivery runs in its own function alongside the API.
- `custom-domains`: The hosted zone gains the sending domain's signing and identity records, alongside the certificate-validation and alias records it already holds.
- `backend-api`: The rule that backend logs exclude sensitive values is extended to cover email addresses and unsubscribe tokens.

## Impact

- **Backend** (`backend/src/`): a new delivery function with its own entry point, driven by the notification records written by `add-play-notifications`; a new `lib/emailTemplates.ts` and `lib/unsubscribeToken.ts` (reusing the opaque-token pattern from `lib/shareToken.ts`); an email channel and a delivery-disabled flag on the existing notification-preferences item; a public unsubscribe route in `router.ts`, joining share and invite resolution as the third entry in its deliberately visible public list.
- **Frontend** (`frontend/src/`): an email channel toggle in the notification-preferences section of `pages/SettingsPage.tsx`, with the individual-marks option explicitly unavailable for email and said to be so; a public unsubscribe confirmation page requiring no sign-in.
- **Infra** (`infra/`): SES domain identity, signing records, and a configuration set with bounce and complaint handling; a second Lambda with its own runtime role and its event source; a change stream on the existing DynamoDB table. **The table itself keeps its `prevent_destroy` lifecycle and its key schema unchanged.**
- **CI/CD** (`.github/workflows/`): the backend deploy workflow updates both functions rather than one.
- **Manual, blocking**: an AWS support request for production sending access, which must be granted before prod can mail anyone outside a verified list.
- **Contract tests**: unchanged.
- **Out of scope**: browser push notifications and service workers; SMS or any other channel; digest or summary emails, which would need a scheduler and a batching window; per-trip email addresses; rich formatting beyond a plain, legible message; and inbound mail of any kind — the application sends and never receives.

**Depends on** `add-play-notifications` for the events, the preferences item, the per-trip muting, and the per-user notification records that drive delivery.
