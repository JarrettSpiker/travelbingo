## MODIFIED Requirements

### Requirement: Untrusted payloads are validated before storage
The system SHALL validate every client-supplied payload before storing it. For a card payload this SHALL bound the number of grid slots, the length of every text field, and the overall payload size, and SHALL constrain colors, fonts, and emoji counts to the same rules the client applies. For any other client-supplied payload the system SHALL bound the length of every text field and the overall payload size. An invalid payload SHALL be rejected with a client-error response rather than silently corrected or partially stored.

#### Scenario: An oversized or malformed payload is submitted
- **WHEN** a request carries a payload that violates any bound or format rule
- **THEN** the system SHALL reject it with a client-error response and SHALL NOT store any part of it

#### Scenario: A payload that is not a card is submitted
- **WHEN** a request carries a client-supplied payload of a kind other than a card
- **THEN** its text fields and overall size SHALL be bounded and validated before storage, by the same rule rather than by a parallel one

### Requirement: The API bounds its own resource consumption
The system SHALL limit the rate at which the API accepts requests, SHALL cap the concurrency of the backend compute, and SHALL apply a stricter rate limit to endpoints reachable without an account. Backend logs SHALL be retained for a bounded period, and SHALL NOT record credentials, share tokens, card contents, feedback message text, or a feedback submitter's contact address.

#### Scenario: Request rate exceeds the configured limit
- **WHEN** requests arrive faster than the configured limit
- **THEN** the system SHALL throttle them rather than scaling compute without bound

#### Scenario: Logs exclude sensitive values
- **WHEN** the backend logs a request
- **THEN** the log SHALL NOT contain the authorization credential, a share token, the text of a user's card, the text of a feedback submission, or a contact address supplied with one
