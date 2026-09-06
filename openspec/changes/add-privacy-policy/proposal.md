## Why

Google requires a publicly reachable privacy policy URL on the OAuth consent screen, and the project's single consent screen currently has none — an unverified-looking consent screen is what every new visitor meets at sign-in. The application is in the strongest possible position to write one: a signed-out visitor sends zero network requests, and everything an account stores is enumerable. A policy that states those facts is short, honest, and cheap to keep true. The site footer was built expecting exactly this link.

## What Changes

- **A privacy policy page, published by the application at `/privacy`.** One page, rendered by the SPA, brand-invariant in path, stating in plain prose what the application does and does not do with data: the card tools run entirely in the browser; signing in is optional and uses Google; what an account stores (saved cards, trips and their members, share links, feedback); what feedback carries and never carries; that there is no analytics or advertising; and where to send privacy questions and deletion requests.
- **A footer link to it.** "Privacy Policy" joins the feedback link in the site footer, inheriting the footer's existing visibility rules.
- **Two brand-varying values, declared per brand.** The policy's contact address (`privacy@travelbingo.ca` / `privacy@officelingobingo.com`) and the site's own web address enter `BrandCopy`, because their values genuinely differ; the operating name reuses the brand's existing product name.
- **The policy carries an effective date and is bound to the behavior it describes.** Any change that alters what the application collects, stores, or shares must amend the policy in the same change — recorded as a requirement so the obligation outlives this proposal.
- **Manual steps outside the repository:** stand up the two `privacy@` mailboxes, and set the consent screen's Application Privacy Policy link to `https://travelbingo.ca/privacy`. One Google Cloud project serves both brands, and its single consent screen already carries the travel brand's name for office visitors — an accepted trade recorded in `add-office-brand` task 0.4; pointing its one privacy link at the travel domain extends the same trade rather than creating a new one.
- **Unchanged:** every existing route and its authorization; the card renderer and stored card shape; the backend, which this change does not touch at all; the footer's gating rules; and the signed-out experience of every capability — the page itself makes zero backend requests.

## Capabilities

### New Capabilities
- `privacy-policy`: The published statement of the application's data practices — where it lives, how it is reached, what it must state, which values each brand supplies, and the rule that keeps it in step with the behavior it describes.

### Modified Capabilities

*None.* Three existing requirements already govern this change and are recorded here so their absence is not read as an oversight: `brand-theming`'s "Brand-varying copy is declared and complete" already forces both brands to supply the new contact values and forbids declaring text that reads identically; `app-visual-design`'s chrome requirements already bind the page's appearance; and `user-feedback`'s discoverability requirement already binds the footer the link joins. Inventing requirements for these would restate rules that already hold.

## Impact

- **Frontend** (`frontend/src/`): a new `pages/PrivacyPage.tsx`; one route each in `routes.tsx` and `lib/routes.ts`; a link in `SiteFooter.tsx`; a new `privacy` section in `BrandCopy` (`types.ts` plus both brands' `copy.ts`); a gallery entry in `src/dev/gallery/` with its sample.
- **Backend, infra, CI/CD:** untouched.
- **Out of repository:** the two mailboxes (email routing for the registered domains); the Google consent screen field; confirmation that the published screen shows the link.
- **On existing in-flight work:** `add-email-notifications` will collect email addresses and send mail, which alters data practices — this change adds a task there obligating its policy amendment, and the new spec requirement makes that obligation binding.
- **Out of scope:** Terms of Service (Google does not require one; nothing here offers terms to accept); a cookie or consent banner (the application sets no tracking cookies and adds no third-party scripts, so there is nothing to consent to); third-party policy generators (external hosting, their own trackers, and text that would not match the system's actual practices); any analytics (adding them would contradict the policy and the capability's amendment rule).
