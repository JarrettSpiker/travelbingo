# user-accounts Specification

## Purpose
Defines how a user signs in to and out of an account, how that session is represented and persisted in the browser, and the guarantee that the entire application remains usable without ever signing in.
## Requirements
### Requirement: Users sign in with Google
The system SHALL let a user sign in with a Google account through a hosted identity provider, using the OAuth 2.0 authorization-code flow with PKCE. The system SHALL NOT store or handle user passwords, and SHALL NOT require any email to be sent for signup, verification, or account recovery. Each deployment environment SHALL use its own isolated user directory.

#### Scenario: User signs in
- **WHEN** a signed-out user triggers the sign-in action
- **THEN** the system SHALL redirect them to Google, and on successful authentication SHALL return them to the app in a signed-in state showing their identity

#### Scenario: User declines or authentication fails
- **WHEN** the user cancels at the identity provider, or the callback carries an error
- **THEN** the system SHALL return the user to the app in the signed-out state with an explanatory message, and SHALL NOT leave the app in a broken or partially-authenticated state

#### Scenario: Environments have separate user directories
- **WHEN** a user signs in to the dev environment
- **THEN** that account SHALL exist only in the dev user directory, and SHALL NOT grant access to any data in the prod environment

### Requirement: The signed-in session survives a page reload
The system SHALL persist enough of the session for the user to remain signed in across page reloads and new tabs, and SHALL renew short-lived credentials without requiring the user to sign in again. Short-lived access credentials SHALL NOT be written to persistent browser storage.

#### Scenario: Session survives a reload
- **WHEN** a signed-in user reloads the page
- **THEN** the system SHALL restore the signed-in state without redirecting the user to the identity provider again

#### Scenario: Stored session data is unusable
- **WHEN** the persisted session data is missing, malformed, expired, or otherwise fails validation on read
- **THEN** the system SHALL treat the user as signed out and continue to operate normally, and SHALL NOT error or fail to render

### Requirement: Signing out ends the session
The system SHALL provide a sign-out action that clears the persisted session, discards in-memory credentials, and revokes the session at the identity provider.

#### Scenario: User signs out
- **WHEN** a signed-in user triggers sign-out
- **THEN** the system SHALL return to the signed-out state, retain no session data in browser storage, and SHALL NOT be able to call authenticated endpoints without signing in again

### Requirement: The application is fully functional signed out
The system SHALL make every card capability that does not inherently require an account — building, editing, randomizing, rendering, printing, and PNG export — available to signed-out users. Loading the app while signed out SHALL NOT issue any request to the account backend, and an unavailable backend SHALL NOT degrade any of those capabilities. Authentication SHALL NOT block first paint.

#### Scenario: Signed-out user builds and exports a card
- **WHEN** a user who has never signed in uses the app
- **THEN** they SHALL be able to add entries, randomize, apply themes and emojis, print, and export a PNG, with no prompt to sign in

#### Scenario: Backend is unavailable
- **WHEN** the account backend cannot be reached
- **THEN** all card generation, rendering, and export capabilities SHALL continue to work, and the failure SHALL surface only when the user attempts an account action

#### Scenario: Authentication never gates first paint
- **WHEN** the app is loading and the session state has not yet been resolved
- **THEN** the editor SHALL render and be interactive, rather than showing a blocking loading state
