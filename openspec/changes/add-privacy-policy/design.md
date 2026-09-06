## Context

See `proposal.md` for why. The facts the policy restates are already guarantees elsewhere in the system: the signed-out zero-request rule (`user-accounts`, `user-feedback`), the feedback context set and exclusions (`user-feedback`), log exclusions (`backend-api`), and the absence of any analytics or third-party script (nothing in the codebase; CSP and the capture tool's request report verify it). The policy is a prose surface over rules the specs already hold — which is what makes keeping it true tractable.

The frontend already has everything the page needs: `AppShell` with a `narrow` reading width, a `SiteFooter` whose doc comment has expected this link since it was written, a brand seam that supplies per-brand values, and a per-page metadata mechanism (`meta.json`) that gives the page a correct `<title>` for free.

## Goals / Non-Goals

**Goals**

- A policy page that a person can read in one sitting, every claim of which is checkable against the running system.
- Zero backend, infra, or CI changes. This is a frontend-only change.

**Non-Goals**

- Legal review. The policy states what the system factually does; it is not counsel's text, and no jurisdiction-specific compliance (GDPR article numbering, CCPA categories) is attempted. A one-person project stating its practices plainly is the honest scope.
- Terms of Service, cookie banners, or consent mechanisms — see the proposal's out-of-scope list.
- An in-app account-deletion flow. None exists; the policy routes deletion requests to the contact address instead of promising automation.

## Decisions

### The policy is an SPA route, not a static asset or an external page

`/privacy` renders inside the application like every other page. Alternatives rejected: a static HTML file in the S3 bucket (would need its own copy of the chrome, its own styling decisions, and would drift from the footer that must link it); a third-party policy host (external dependency, its own trackers — which the policy itself denies having). The SPA route rides the existing deploy pipeline, inherits the brand's tokens and dark mode for free, and makes the footer link an internal route navigation. No CloudFront or Terraform change: the SPA fallback already serves client paths.

### Content lives in the page component, not `src/lib/`

The prose is JSX inside `pages/PrivacyPage.tsx`, organized as sections. It is presentation, not logic — nothing to unit-test, nothing any other module consumes — so co-locating it with the page keeps `src/lib/` pure. The only dynamic values are the three brand interpolations; everything else is literal prose.

### Three interpolations; two of them are new brand copy

- **Operating name** — `brand.name`, already declared. No new key.
- **Web address and contact address** — new `BrandCopy` section `privacy` with `siteUrl` and `contactEmail`. Their values genuinely differ between brands (`travelbingo.ca` / `privacy@travelbingo.ca` vs `officelingobingo.com` / `privacy@officelingobingo.com`), so they earn their place under the copy rule; the parity guard enforces both brands supply them with no extra work.

Alternatives rejected: deriving the address from `VITE_APP_ORIGIN` (that variable is *environment*-owned — a dev build would print `privacy@dev.travelbingo.ca`, and the office dev origin is a different hostname than the canonical site the policy should name); putting them in `meta.json` (that file's stated purpose is `<head>` metadata, and `vite.config.ts` reads it at build time — a contact address is not head data); hardcoding in the page (the shared prose would then ship the travel domain inside the office bundle, violating the brand seam that `check-bundle.mjs` exists to police).

The footer link label — "Privacy Policy" — reads identically in both brands and stays inline, per the copy rule's corollary.

### The footer link inherits the footer's existing gating, unchanged

The footer renders whenever accounts are enabled — which is every deployed environment — and the privacy link simply joins it. The one hidden state is a local build with no Cognito configuration, which has no account system at all: the policy would describe features that do not exist there, and the footer's `null` is the existing, correct answer. Signed-out visitors on deployed sites already see the footer, so the link is public. Changing the gating would modify `user-feedback`'s discoverability surface for no observable public benefit; this change touches none of it.

### The effective date is a constant in the page, advanced by hand

A `POLICY_EFFECTIVE_DATE` constant beside the prose. The spec's amendment requirement — any change to data practices amends the policy in the same change — is a rule about changes, and the date is its visible receipt. Nothing mechanical enforces "same change"; the requirement plus the visible date (stale dates are noticeable in review and in the page itself) is the enforcement the project can honestly provide.

### One consent screen link, pointing at the travel domain

A Google Cloud project has exactly one consent screen, already carrying the travel brand's name for office visitors (`add-office-brand` task 0.4). Its single Application Privacy Policy field is set to `https://travelbingo.ca/privacy`. This extends an accepted trade rather than creating a new one: an office visitor who follows the consent screen's link reads travel's contact address instead of office's. The policy content is otherwise identical, both brands' deployments do serve their own page with their own values, and the alternative — a second Google Cloud project per brand — was already judged not worth it when the stakes were the app's own name and logo.

### Section outline of the policy

Written at implementation from the spec's requirement, in this order: what the site is and who operates it (name, web address, contact); what happens signed out (everything in the browser, no requests); what signing in adds (Google as the provider, what an account stores); what feedback carries, never carries, and how long it lives; what the application does not do (no analytics, no advertising, no third-party trackers); how to ask questions or request deletion (the contact address); the effective date.

## Risks / Trade-offs

- **The policy drifts from behavior as the app grows** → the amendment requirement makes every data-practice change obligated to update it, and the effective date makes staleness visible. `add-email-notifications` gets a task to that effect in this change.
- **The contact address is published before the mailbox exists** → task ordering: the mailboxes are a manual prerequisite listed before the copy keys are filled in, and the GCP field is set after deploy.
- **A privacy policy invites legal expectations the project can't staff** → the policy states facts and promises nothing procedural (no DPO, no response-time commitment, no jurisdiction-specific rights). Scoping it down is the mitigation; drafting it up is the risk.
- **Office visitors see travel's policy URL on the consent screen** → accepted as an extension of the `add-office-brand` 0.4 trade; recorded here and in the proposal so it is a decision, not a surprise.

## Migration Plan

Purely additive frontend deploy; no data, no API, no infra. Rollback is reverting the deploy. The only irreversible step is publishing the contact address — cheap to publish, tedious to retract — which is why the mailbox prerequisite precedes it.

## Open Questions

- **Mailbox mechanism** — Route53-hosted domains have no email today. Options: a forwarding service, SES receive + S3, or paid mailboxes. Any of them satisfies the requirement; pick when creating them (task 0). Does not affect the page, the copy keys, or the consent-screen step.
