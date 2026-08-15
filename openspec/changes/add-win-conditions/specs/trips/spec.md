## MODIFIED Requirements

### Requirement: A signed-in user can create a trip and becomes its administrator
The system SHALL let a signed-in user create a trip by providing a title, choosing a play mode (cooperative or competitive), optionally choosing a win condition, and optionally a start date and end date. The creating user SHALL become the trip's administrator for the trip's lifetime. A signed-out user SHALL NOT be able to create a trip.

#### Scenario: User creates a trip
- **WHEN** a signed-in user creates a trip with a title, a mode, and no dates
- **THEN** the system SHALL create the trip with that user as its administrator and SHALL reflect the trip in the user's trips

#### Scenario: Trip with a date range
- **WHEN** a signed-in user creates a trip with a start date and an end date
- **THEN** the system SHALL store both dates with the trip

#### Scenario: Trip with a chosen win condition
- **WHEN** a signed-in user creates a trip and chooses a win condition
- **THEN** the system SHALL store that win condition with the trip

#### Scenario: Trip created without a win condition
- **WHEN** a signed-in user creates a trip without choosing a win condition
- **THEN** the system SHALL create the trip and SHALL treat its win condition as a line

#### Scenario: Signed-out user attempts to create a trip
- **WHEN** a signed-out user attempts to create a trip
- **THEN** the system SHALL refuse and SHALL prompt them to sign in, and SHALL NOT create anything

### Requirement: A trip's title, dates, and play mode are validated
The system SHALL require a non-empty title within a bounded length. When dates are supplied, each SHALL be a well-formed calendar date and the end date SHALL NOT precede the start date. The play mode SHALL be one of the supported modes. When a win condition is supplied, it SHALL be one of the supported win conditions. A payload violating any of these SHALL be rejected in full rather than partially stored or silently corrected.

#### Scenario: Title is empty or too long
- **WHEN** a trip is created or edited with an empty title or a title exceeding the length bound
- **THEN** the system SHALL reject it and SHALL NOT store the trip

#### Scenario: End date precedes start date
- **WHEN** a trip is created or edited with an end date that precedes its start date
- **THEN** the system SHALL reject it

#### Scenario: Unsupported play mode
- **WHEN** a trip is created with a play mode other than cooperative or competitive
- **THEN** the system SHALL reject it

#### Scenario: Unsupported win condition
- **WHEN** a trip is created or edited with a win condition outside the supported set
- **THEN** the system SHALL reject it and SHALL NOT store the change

### Requirement: The trip administrator manages the trip
The trip administrator SHALL be able to change the trip's title, dates, and win condition, and to delete the trip. The trip's play mode SHALL remain fixed for the trip's lifetime, because changing it would change which cards each member may play. The administrator SHALL NOT be removed from the trip while they remain its only administrator. Deleting a trip SHALL remove every record associated with it, including all members, trip cards, and outstanding invite links.

#### Scenario: Administrator edits the trip
- **WHEN** the administrator changes the trip's title or dates
- **THEN** the change SHALL be reflected to all members

#### Scenario: Administrator changes the win condition
- **WHEN** the administrator changes the trip's win condition
- **THEN** the change SHALL be reflected to all members and SHALL apply to subsequent play

#### Scenario: Play mode cannot be changed
- **WHEN** the administrator attempts to change the trip's play mode after creation
- **THEN** the system SHALL refuse

#### Scenario: Non-administrator attempts to edit the trip
- **WHEN** a member attempts to change the trip's title, dates, win condition, or mode, or to delete the trip
- **THEN** the system SHALL refuse

#### Scenario: Administrator deletes the trip
- **WHEN** the administrator deletes a trip
- **THEN** the trip, all of its members, all of its trip cards, and all of its outstanding invite links SHALL be removed
