## MODIFIED Requirements

### Requirement: The application is fully functional signed out
The system SHALL make every card capability that does not inherently require an account — building, editing, randomizing, rendering, printing, and PNG export — available to signed-out users. Loading the app while signed out SHALL NOT issue any request to the account backend, and an unavailable backend SHALL NOT degrade any of those capabilities. Authentication SHALL NOT block first paint.

#### Scenario: Signed-out user builds and exports a card
- **WHEN** a user who has never signed in uses the app
- **THEN** they SHALL be able to add entries, randomize, apply themes and emojis, print, and export a PNG, with no prompt to sign in

#### Scenario: Backend is unavailable
- **WHEN** the account backend cannot be reached
- **THEN** all card generation, rendering, and export capabilities SHALL continue to work, and the failure SHALL surface only when the user attempts an account action

#### Scenario: Authentication never gates first paint
- **WHEN** the app is loading and the session state has not yet resolved
- **THEN** the editor SHALL render and be interactive, rather than showing a blocking loading state
