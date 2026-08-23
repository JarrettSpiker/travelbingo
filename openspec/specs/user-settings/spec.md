# user-settings Specification

## Purpose
Lets a signed-in user maintain a self-scoped profile — beginning with a display name — that the application shows in place of their email wherever their identity is surfaced, without affecting any account-free capability.

## Requirements

### Requirement: A signed-in user can read their own profile
The system SHALL let an authenticated user read the profile that belongs to their own verified identity, returning the display name they have set (or an explicit absence when none is set). The profile read SHALL be scoped solely to the caller's verified identity, and the system SHALL NOT accept or honor a user identifier supplied in the request body, path, query string, or an unverified header.

#### Scenario: A user with a display name reads their profile
- **WHEN** an authenticated user who has set a display name requests their profile
- **THEN** the system SHALL return a profile carrying that display name

#### Scenario: A user with no display name reads their profile
- **WHEN** an authenticated user who has never set a display name requests their profile
- **THEN** the system SHALL return a profile that indicates no display name is set, and SHALL NOT error

#### Scenario: An unauthenticated user cannot read a profile
- **WHEN** a request to read a profile is made without valid credentials
- **THEN** the system SHALL reject it before any application logic runs, and SHALL NOT return any profile

### Requirement: A signed-in user can set and clear their display name
The system SHALL let an authenticated user set a display name on their own profile, and SHALL let them clear it by submitting an empty value. The profile write SHALL be scoped solely to the caller's verified identity. A submitted display name SHALL be validated before storage: it SHALL be bounded in length, and a value that violates the bound or is otherwise malformed SHALL be rejected with a client-error response and SHALL NOT be stored, silently corrected, or partially applied. A read after a successful write SHALL reflect the most recently stored value.

#### Scenario: A user sets a display name
- **WHEN** an authenticated user submits a valid display name
- **THEN** the system SHALL store it on the caller's own profile, and a later read SHALL return it

#### Scenario: A user clears their display name
- **WHEN** an authenticated user submits an empty display name
- **THEN** the system SHALL record that no display name is set, and a later read SHALL indicate none is set

#### Scenario: An invalid display name is rejected unchanged
- **WHEN** an authenticated user submits a display name that exceeds the length bound or is otherwise malformed
- **THEN** the system SHALL reject it with a client-error response and SHALL NOT change the stored profile

#### Scenario: A profile write cannot target another user
- **WHEN** a request to write a profile carries a user identifier that differs from the verified credential
- **THEN** the system SHALL ignore that identifier and write only the caller's own profile

### Requirement: The display name is shown in place of the email where the user's identity is surfaced
The system SHALL show a signed-in user's display name, when one is set, wherever the application surfaces that user's own identity to them. The email SHALL remain the fallback whenever no display name is set, so identity is always shown. Surfacing the display name SHALL NOT cause any network request for a signed-out visitor.

#### Scenario: A user who set a display name sees it in the account menu
- **WHEN** a signed-in user who has set a display name views the account menu
- **THEN** the menu SHALL show their display name rather than their email

#### Scenario: A user with no display name still sees their email
- **WHEN** a signed-in user who has not set a display name views the account menu
- **THEN** the menu SHALL show their email and SHALL NOT appear blank

#### Scenario: The account menu reflects a change without a full reload
- **WHEN** a signed-in user saves or clears a display name on the settings page
- **THEN** the account menu SHALL reflect the new value without requiring the user to reload the page

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
