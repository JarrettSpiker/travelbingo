## 0. Prerequisites — manual, outside the repository

- [ ] 0.1 **Create the `privacy@travelbingo.ca` mailbox.** The domains are Route53-hosted with no email today; pick a mechanism (forwarding service, SES receive, paid mailbox — design.md's open question) and verify the address receives mail before it is published anywhere.
- [ ] 0.2 **Create the `privacy@officelingobingo.com` mailbox.** Same mechanism, same verification.

## 1. Brand declarations

- [ ] 1.1 Add a `privacy` section to `BrandCopy` in `frontend/src/brand/types.ts` — `contactEmail` and `siteUrl`, each with the doc comment the file's convention requires — and supply both values in `brand/travel/copy.ts` and `brand/office/copy.ts` from task 0's addresses. **Verify:** `npm test` in `frontend/` — the copy parity guard is the check that both brands declared them.

## 2. The policy page

- [ ] 2.1 Create `frontend/src/pages/PrivacyPage.tsx`: `AppShell size="narrow"`, the section outline from design.md (who operates the site → signed-out behavior → what an account stores → feedback → what the app does not do → questions and deletion → effective date), prose in JSX with only the three brand interpolations (`brand.name`, `brand.copy.privacy.siteUrl`, `brand.copy.privacy.contactEmail`), and a `POLICY_EFFECTIVE_DATE` constant rendered as the page's effective date. Follow the existing page components' heading and spacing conventions (`SettingsPage` is the closest sibling).
- [ ] 2.2 Check the prose against the spec's "states the application's actual data practices" requirement item by item, and against the system: the signed-out claims must match what `capture`'s request report shows, the feedback claims must match the `user-feedback` spec (context set, no card content, no network address, expiry), and no sentence may promise anything the system doesn't do (no deletion automation, no response-time commitment).

## 3. Routing and the footer link

- [ ] 3.1 Add `privacy: "/privacy"` to `frontend/src/lib/routes.ts` and a literal `<Route path="/privacy" element={<PrivacyPage />} />` in `routes.tsx` — literal, not built from the constant, per `lib/routes.ts`'s stated convention. **Verify:** direct load of `/privacy` serves the page (SPA fallback), signed out, and the capture tool reports zero API requests.
- [ ] 3.2 Add the link to `frontend/src/components/SiteFooter.tsx` beside the feedback button, same styling, label inline as `"Privacy Policy"` (identical across brands — the copy rule's corollary), pointing at `ROUTES.privacy`. **Verify:** footer shows both links when signed out and when signed in; a build with no Cognito config still renders no footer (gating unchanged).

## 4. Component gallery

- [ ] 4.1 Add a `PrivacyPage` sample to `frontend/src/dev/gallery/` and register it in `registry.tsx`. **Verify:** `npm test` — `coverage.test.ts` fails until the entry exists; then check the `/ui` capture so the entry is looked at, not just counted.

## 5. Definition of done — both brands

- [ ] 5.1 In `frontend/`: `npm run lint`, `npm test`, `VITE_BRAND=travel npm run build`, `VITE_BRAND=office npm run build` — all green. Backend untouched, so its three commands need no rerun for this change.
- [ ] 5.2 Visual QA with the dev server: `npm run capture -- /privacy` for both brands (`VITE_BRAND` matching the server). Check light and dark at 390px and 1440px: reading width holds on mobile, footer links legible, dark mode prose contrast. Nothing else in the app changed, so no wider sweep is owed.

## 6. Google console — manual, after deploy

- [ ] 6.1 On the OAuth consent screen of the single Google Cloud project, set **Application Privacy Policy** to `https://travelbingo.ca/privacy`. Confirm the screen is **published**, then follow the link from a fresh incognito sign-in to verify it resolves to the page.
- [ ] 6.2 Note for the record, not for action: office visitors follow the same consent-screen link and land on the travel domain's page — the accepted `add-office-brand` 0.4 trade, extended. If it ever stops being acceptable, the fix is a second Google Cloud project, not a code change.

## 7. Obligation on in-flight work

- [ ] 7.1 Append a task to `openspec/changes/add-email-notifications/tasks.md` requiring that change to amend the policy and advance the effective date before it ships — it collects email addresses and sends mail, which is exactly the data-practice change the new `privacy-policy` capability's amendment requirement binds.
