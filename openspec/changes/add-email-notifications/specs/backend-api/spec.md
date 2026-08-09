## MODIFIED Requirements

### Requirement: The API bounds its own resource consumption
The system SHALL limit the rate at which the API accepts requests, SHALL cap the concurrency of the backend compute, and SHALL apply a stricter rate limit to endpoints reachable without an account. Backend logs SHALL be retained for a bounded period, and SHALL NOT record credentials, share tokens, unsubscribe tokens, email addresses, or card contents.

#### Scenario: Request rate exceeds the configured limit
- **WHEN** requests arrive faster than the configured limit
- **THEN** the system SHALL throttle them rather than scaling compute without bound

#### Scenario: Logs exclude sensitive values
- **WHEN** the backend logs a request
- **THEN** the log SHALL NOT contain the authorization credential, a share token, an unsubscribe token, an email address, or the text of a user's card

#### Scenario: A delivery failure is logged without the recipient's address
- **WHEN** the backend logs a failure to deliver a message
- **THEN** the log SHALL identify the failure without recording the recipient's email address or their unsubscribe token
