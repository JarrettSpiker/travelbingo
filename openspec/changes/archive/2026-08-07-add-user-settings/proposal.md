## Why

A signed-in user is identified everywhere by their email — in the account menu today, and (once trips land) next to every card they add to a shared trip. Email is a poor public label: it's long, it's personal, and it is not what a user wants shown to a group of acquaintances on a road trip. Users need to set a display name once and have it used in place of their email wherever their identity is surfaced.

This change adds the first of those settings — a display name — on a dedicated settings page, backed by the profile record the table already has a key for but no code has ever written.

## What Changes

- A **signed-in-only `/settings` page** where a user views and edits their display name, with inline validation matching the backend's rules (length bound; empty is allowed and clears the name).
- A **new backend resource**: the per-user profile, stored at the existing `USER#<sub>` / `PROFILE` key that `keys.ts` already declares but nothing writes today. New authenticated endpoints `GET /api/me/profile` and `PUT /api/me/profile` read and update the caller's own profile.
- **The account menu shows a display name when one is set**, falling back to the email from the ID token when it is not — so identity is still shown with no extra request until the user opts in.
- **The profile is loaded once per signed-in session**, not per page, and stored in the auth context alongside the email. The signed-out, zero-requests-on-load invariant is untouched: only an authenticated session fetches the profile.
- **Validation rejects rather than corrects**, matching `cardPayload.ts`: an oversized or malformed display name is a client error, never silently stored.
- **Unchanged:** the editor, the frozen card renderer, sign-in/sign-out/session behavior, the saved-card shape, and the contract tests. Settings are strictly additive — the app is fully usable signed out, and a signed-out visitor still makes zero API requests.

## Capabilities

### New Capabilities
- `user-settings`: A signed-in user can view and update a self-scoped profile — beginning with a display name — that is shown in place of their email wherever their identity is surfaced. The profile is authorized by the caller's own verified identity (not the card membership model) and is never required for any non-account capability.

### Modified Capabilities
<!-- None. The existing backend-api requirements already cover the properties the new endpoints must satisfy — every request authenticated, identity derived only from verified credentials, untrusted payloads validated before storage, and a single table whose entities are distinguished by key prefixes. The profile is a new key prefix under an existing partition shape, so it introduces no new requirement there. -->

## Impact

- **Backend** (`backend/src/`): first use of the existing `profileKey` in `lib/keys.ts`; a new `routes/profile.ts` (`getProfile`, `updateProfile`) keyed by the caller's own `sub` via `getUserId`; a new `lib/profilePayload.ts` validator (`parseDisplayName`) with a co-located test; two routes registered in `router.ts`. No change to `auth.ts`'s membership authorization — the profile is self-scoped to the verified identity.
- **Infra** (`infra/`): two new authenticated API Gateway HTTP API route keys (`GET /api/me/profile`, `PUT /api/me/profile`), both behind the existing Cognito authorizer. No new compute, storage, table, GSI, or identity change.
- **Frontend** (`frontend/src/`): a new account-gated `SettingsPage` at `/settings`; an API client for the two endpoints; the profile loaded once after auth resolves and held in `AuthProvider` context; `AuthMenu` reads the display name (falling back to email); a "Settings" navigation entry shown only when signed in; a gallery entry for the new component.
- **Specs:** one new capability spec (`user-settings`). No existing spec's requirements change.
- **Out of scope:** notification preferences for trips and any other future settings — the spec and the settings page are structured so those land as additional fields/sections later, but none are added now. Surfacing the display name on trip members (the `add-trips` change) is a follow-up that reads the same profile field; this change establishes the field and the account-menu display only.
