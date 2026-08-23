## MODIFIED Requirements

### Requirement: Settings are unavailable and inert without an account
The system SHALL restrict the settings page and every profile read and write, and every notification-preference read and write, to authenticated users. A signed-out visitor SHALL NOT see a settings entry point and SHALL NOT be able to reach the settings page, and the application SHALL make zero profile and zero notification-preference requests while the visitor is signed out. Profile data, the display name, and notification preferences SHALL NOT be required by any card-generation, sharing, or other account-free capability.

#### Scenario: A signed-out visitor never requests a profile
- **WHEN** a signed-out visitor loads and uses the application
- **THEN** the application SHALL make no profile request and SHALL NOT render any settings surface

#### Scenario: A signed-out visitor never requests notification preferences
- **WHEN** a signed-out visitor loads and uses the application
- **THEN** the application SHALL make no notification-preference request

#### Scenario: Settings do not gate account-free use
- **WHEN** a signed-out or signed-in user builds, edits, randomizes, prints, or exports a card
- **THEN** that capability SHALL work without reading or writing any profile or notification preference

## ADDED Requirements

### Requirement: A signed-in user manages their notification preferences from settings
The system SHALL present a signed-in user's notification preferences on the settings page alongside their profile, letting them choose which kinds of play event notify them and which of their trips are muted. Reading and writing these preferences SHALL be scoped solely to the caller's verified identity, and the system SHALL NOT accept or honor a user identifier supplied in the request body, path, query string, or an unverified header. A user who has never set preferences SHALL be shown the defaults that are in effect for them rather than an empty or undefined state.

#### Scenario: A user opens settings for the first time
- **WHEN** a signed-in user who has never set notification preferences opens the settings page
- **THEN** the page SHALL show the defaults currently in effect for them, and SHALL NOT appear blank or unset

#### Scenario: A user changes a preference
- **WHEN** a signed-in user changes which kinds of event notify them and saves
- **THEN** the system SHALL store the change on the caller's own preferences, and a later read SHALL return it

#### Scenario: A user mutes a trip from settings
- **WHEN** a signed-in user mutes one of their trips from the settings page
- **THEN** the system SHALL record that trip as muted for that user only, leaving their other trips unaffected

#### Scenario: A preference write cannot target another user
- **WHEN** a request to write notification preferences carries a user identifier that differs from the verified credential
- **THEN** the system SHALL ignore that identifier and write only the caller's own preferences
