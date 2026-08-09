## ADDED Requirements

### Requirement: Trip access is authorized through the same shared routine as card access
The system SHALL authorize every read and write of a trip, a trip's members, a trip's cards, and a trip's invites through the single shared authorization routine used for cards, parametrized by the operation's permitted roles. Trip memberships SHALL carry a role of either administrator or member. Absence of a membership SHALL be reported identically to absence of the trip, so that trip ids belonging to other users do not leak. An operation permitted only to an administrator, requested by a member, SHALL be refused. The caller's role SHALL be derived solely from the caller's membership record for that trip, and SHALL never be taken from the request body, path, query string, or headers.

#### Scenario: Non-member access is indistinguishable from a non-existent trip
- **WHEN** a user requests a trip operation without a membership in that trip
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist

#### Scenario: Insufficient role is refused
- **WHEN** a member requests an operation permitted only to the administrator
- **THEN** the system SHALL refuse the operation

#### Scenario: Identity and role come only from verified credentials
- **WHEN** a request carries a user identifier or role in its body, path, or query
- **THEN** the system SHALL ignore the supplied value and derive the caller's identity and role only from the verified credential and the caller's membership record

### Requirement: Trip data is stored as new entity types in the existing single table
The system SHALL store trips, trip memberships, trip-card snapshots, and invite records as new key-prefixed entities in the same single table used for cards, without provisioning additional tables or secondary indexes. Listing a user's trips SHALL be a single query against that user's trip-membership records. Deleting a trip SHALL cascade to its members, trip cards, and invite records, leaving no orphaned records.

#### Scenario: Listing a user's trips is a single query
- **WHEN** the system lists the trips a user has access to
- **THEN** it SHALL do so with a single query against that user's trip-membership records, without a separate lookup per trip

#### Scenario: A trip delete cascades
- **WHEN** an administrator deletes a trip
- **THEN** the system SHALL remove the trip's metadata, every membership record (both the user-facing listing row and the cascade mirror), every trip-card snapshot, and every outstanding invite

### Requirement: Trip and trip-card payloads are validated before storage
The system SHALL validate every client-supplied trip payload and trip-card snapshot before storing it, bounding the title length, rejecting malformed or out-of-order dates, constraining the play mode to the supported set, and constraining a trip-card snapshot to the same color, font, and emoji rules the client applies for cards. A trip-card snapshot SHALL be validated as a render-only card subset and SHALL NOT require the editable entry pool. An invalid trip or snapshot payload SHALL be rejected with a client-error response rather than silently corrected or partially stored.

#### Scenario: A malformed trip payload is rejected
- **WHEN** a request carries a trip payload that violates any bound or format rule
- **THEN** the system SHALL reject it with a client-error response and SHALL NOT store any part of it

#### Scenario: An invalid trip-card snapshot is rejected
- **WHEN** a request carries a trip-card snapshot whose grid, colors, fonts, or emoji counts violate the card rules
- **THEN** the system SHALL reject it and SHALL NOT add the card to the trip
