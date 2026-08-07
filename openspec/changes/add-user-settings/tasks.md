## 1. Backend profile validation

- [ ] 1.1 Update the table-layout comment at the top of `backend/src/lib/keys.ts` so the `USER#<sub>` / `PROFILE` row lists the fields actually stored (`displayName`, `createdAt`, `updatedAt`). The `profileKey` helper itself is unchanged.
- [ ] 1.2 Create `backend/src/lib/profilePayload.ts`: export `MAX_DISPLAY_NAME_LENGTH` (50) and `parseDisplayName(input)` — reject non-strings and values over the bound with `400` (via `badRequest`), trim, and return `null` for empty-after-trim so an empty value means "clear."
- [ ] 1.3 Co-locate `backend/src/lib/profilePayload.test.ts` covering: non-string, over-length, whitespace-only (clears), empty string (clears), leading/trailing whitespace trimmed, and a valid value round-trip.

## 2. Backend profile routes

- [ ] 2.1 Create `backend/src/routes/profile.ts` with `getProfile(deps, request)` and `updateProfile(deps, request)`. Both derive the caller from the verified identity (`getUserId` / the existing `requireUser` shape) and key solely off `profileKey(userId)`. `getProfile` returns `200 { displayName: string | null, updatedAt: string | null }`, returning `displayName: null` when no item exists (never 404). `updateProfile` validates with `parseDisplayName`, upserts the profile (`createdAt` on first write, `updatedAt` always refreshed), and returns the new profile document.
- [ ] 2.2 Co-locate `backend/src/routes/profile.test.ts` using the existing in-memory fake `Deps` pattern: reading with no item returns null display name (200); set then read round-trip; clear (empty) sets displayName back to null; over-length body is rejected with 400 and the stored profile is unchanged; a body/param carrying a different user id is ignored and only the caller's own profile is touched (identity-keyed authorization).
- [ ] 2.3 Register `GET /api/me/profile` and `PUT /api/me/profile` in `backend/src/router.ts`'s `ROUTES` map (neither is `public`). Keep the route-key comment style consistent with the existing entries.

## 3. Infra

- [ ] 3.1 Add the two route keys (`GET /api/me/profile`, `PUT /api/me/profile`) to the API Gateway HTTP API configuration in `infra/`, both behind the existing Cognito authorizer. No new Lambda, table, GSI, bucket, or identity change.
- [ ] 3.2 `terraform plan` against dev confirms only the two route additions; no destructive diffs to the `prevent_destroy` DynamoDB table or Cognito user pool.

## 4. Frontend types and API client

- [ ] 4.1 Create `frontend/src/lib/profileApi.ts`: a `Profile` type (`{ displayName: string | null; updatedAt: string | null }`) and `getProfile`/`updateProfile` client functions over the existing auth-gated `ApiClient` (`apiClient.ts`). Mirror `MAX_DISPLAY_NAME_LENGTH` here as a constant with a comment that it mirrors `backend/src/lib/profilePayload.ts`.
- [ ] 4.2 Confirm no profile module is imported by any signed-out code path and that profile calls only fire behind the authenticated check (preserving the zero-requests-signed-out invariant).

## 5. Frontend auth context and account menu

- [ ] 5.1 Extend `frontend/src/auth/authContext.ts` (`AuthContextValue`) with `displayName: string | null` and an updater (e.g. `setProfile(profile)` or `refreshProfile`) the settings page can call after a save.
- [ ] 5.2 In `frontend/src/auth/AuthProvider.tsx`, fetch `GET /api/me/profile` once after authentication resolves (inside the existing auth-resolution effect) and store `displayName`. Non-blocking and non-fatal: on failure or before resolution, `displayName` stays `null` (email fallback). Ensure it never fires when signed out or when `authConfig` is null.
- [ ] 5.3 Update `frontend/src/components/AuthMenu.tsx`: the trigger shows `{displayName ?? email ?? "Account"}`, and the dropdown gains a "Settings" item (alongside "My saved cards") navigating to `/settings`.

## 6. Frontend settings page and routing

- [ ] 6.1 Create `frontend/src/pages/SettingsPage.tsx` (account-gated: redirect signed-out visitors, mirroring `/cards`): a display-name input bound to the backend rules (`maxLength` = mirrored constant), Save and Clear actions, inline validation (over-length, network error), and success/error states. On a successful save/clear, update the cached profile via the context updater so the account menu reflects it without a reload. Structure the page so future settings (notification preferences) extend it as new sections without restructuring.
- [ ] 6.2 Register `/settings` in `frontend/src/routes.tsx`, guarded by the signed-in check (signed-out visitors redirect away and make zero profile requests).
- [ ] 6.3 Add a gallery entry for `SettingsPage` in `frontend/src/dev/gallery/registry.tsx` (and any new states) so `coverage.test.ts` stays green — required by the repo's definition of done.

## 7. Verification

- [ ] 7.1 Run `npm run lint && npm test && npm run build` in **both** `frontend/` and `backend/`; all must pass.
- [ ] 7.2 Visual QA via `npm run capture -- /settings` (and the account menu on `/`) in light and dark at 390px and 1440px; confirm the signed-out capture of `/` reports zero `/api/` requests and no "Settings" entry point, and that `/settings` redirects when signed out.
- [ ] 7.3 Signed-in flow in dev: set a display name and confirm the account menu updates without a reload; clear it and confirm the menu falls back to the email; reload and confirm the display name persists.
- [ ] 7.4 Confirm the frozen card renderer and `App.css` are untouched (`cardGrid.guard.test.ts` passes unchanged) and the saved-card contract tests are unchanged.
