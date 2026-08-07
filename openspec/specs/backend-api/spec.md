# backend-api Specification

## Purpose
Defines the HTTP API that backs the account features: how the browser reaches it, how every request is authenticated and authorized, how untrusted payloads are validated, and how the data behind it is stored and bounded.
## Requirements
### Requirement: The API is served same-origin through the existing distribution
The system SHALL serve the API under an `/api/` path prefix on the same host as the application, routed by the existing CloudFront distribution to the API backend. The system SHALL NOT require cross-origin request configuration for the application to call its own API. API responses SHALL NOT be cached by the distribution, and the API SHALL receive the request headers it needs to authenticate the caller.

#### Scenario: The browser calls the API same-origin
- **WHEN** the application calls an API endpoint
- **THEN** the request SHALL go to the same host that served the application, and SHALL NOT require a cross-origin preflight

#### Scenario: API responses are never cached at the edge
- **WHEN** any API endpoint returns a response
- **THEN** the distribution SHALL NOT cache it, so that no user can be served another user's response

### Requirement: Application error responses are not rewritten into the app shell
The system SHALL serve the application shell for client-side application routes that do not correspond to a stored file, while leaving API responses untouched. An API error SHALL reach the caller with its own status code and body, and SHALL NOT be replaced by the application shell or reported as a success.

#### Scenario: An unknown application route loads the app
- **WHEN** a visitor requests an application route that is not a stored file, such as a share link path
- **THEN** the system SHALL serve the application shell so the client can render that route

#### Scenario: An API error is delivered intact
- **WHEN** an API endpoint returns a not-found, unauthenticated, or forbidden response
- **THEN** the caller SHALL receive that status and a machine-readable body, and SHALL NOT receive the application shell or a success status

#### Scenario: A missing static asset is not disguised as the app
- **WHEN** a request is made for a static asset that does not exist
- **THEN** the system SHALL NOT return the application shell in its place

### Requirement: Every request is authenticated before it reaches application code
The system SHALL verify the caller's credentials — signature, issuer, audience, and expiry — before any application logic runs, for every endpoint except those explicitly designated public. An unauthenticated request to a protected endpoint SHALL be rejected without invoking application code.

#### Scenario: An unauthenticated request to a protected endpoint
- **WHEN** a request without valid credentials is made to a protected endpoint
- **THEN** the system SHALL reject it with an unauthenticated response before any application logic executes

#### Scenario: Public endpoints are explicitly designated
- **WHEN** an endpoint is intended to be reachable without an account, such as resolving a share link
- **THEN** that endpoint SHALL be individually designated as public, rather than authentication being disabled broadly

### Requirement: The caller's identity is derived only from verified credentials
The system SHALL determine the calling user's identity solely from the verified credential presented with the request. The system SHALL NOT accept a user identity supplied in a request body, path parameter, query string, or unverified header.

#### Scenario: A request tries to assert a different user
- **WHEN** a request carries a user identifier in its body, path, or query that differs from the verified credential
- **THEN** the system SHALL ignore the supplied value and act only as the verified user

### Requirement: Every resource access is authorized server-side through one shared check
The system SHALL authorize every read and write of a stored resource against the calling user's membership of that resource, using a single shared authorization routine rather than checks written per endpoint. The routine SHALL take the roles permitted for the operation, so that additional roles can be introduced without changing call sites. Absence of a membership SHALL be reported identically to absence of the resource.

#### Scenario: An operation the caller has no membership for
- **WHEN** a user requests an operation on a resource they hold no membership for
- **THEN** the system SHALL respond exactly as it would if the resource did not exist, revealing nothing about its existence

#### Scenario: An operation the caller's role does not permit
- **WHEN** a user holds a membership whose role does not permit the requested operation
- **THEN** the system SHALL refuse the operation

### Requirement: Untrusted payloads are validated before storage
The system SHALL validate every client-supplied card payload before storing it, bounding the number of grid slots, the length of every text field, and the overall payload size, and constraining colors, fonts, and emoji counts to the same rules the client applies. An invalid payload SHALL be rejected with a client-error response rather than silently corrected or partially stored.

#### Scenario: An oversized or malformed payload is submitted
- **WHEN** a request carries a payload that violates any bound or format rule
- **THEN** the system SHALL reject it with a client-error response and SHALL NOT store any part of it

### Requirement: Stored data uses a single table with role-based membership records
The system SHALL store all account data in a single table whose entities are distinguished by key prefixes, so that new entity types can be introduced without provisioning new storage. A user's relationship to a card SHALL be stored as its own record carrying a role, from the outset, so that listing a user's cards is a single query and additional roles or shared resources can be added without restructuring existing data.

#### Scenario: Listing a user's cards is a single query
- **WHEN** the system lists the cards a user has access to
- **THEN** it SHALL do so with a single query against that user's membership records, without a separate lookup per card

#### Scenario: A new entity type is introduced
- **WHEN** a future capability introduces a new entity type
- **THEN** it SHALL be storable as a new key prefix in the existing table, without provisioning additional storage resources

### Requirement: The API bounds its own resource consumption
The system SHALL limit the rate at which the API accepts requests, SHALL cap the concurrency of the backend compute, and SHALL apply a stricter rate limit to endpoints reachable without an account. Backend logs SHALL be retained for a bounded period, and SHALL NOT record credentials, share tokens, or card contents.

#### Scenario: Request rate exceeds the configured limit
- **WHEN** requests arrive faster than the configured limit
- **THEN** the system SHALL throttle them rather than scaling compute without bound

#### Scenario: Logs exclude sensitive values
- **WHEN** the backend logs a request
- **THEN** the log SHALL NOT contain the authorization credential, a share token, or the text of a user's card

### Requirement: Card thumbnails are stored as private objects with a key reference
The system SHALL store a saved card's thumbnail as an object in a dedicated, non-public S3 bucket, separate from the bucket that serves the application's static assets. The card's stored record SHALL carry a reference to the thumbnail object's key rather than the thumbnail bytes. Read access SHALL be granted only via short-lived presigned URLs minted by the backend, and a presigned URL SHALL be issued only after the caller's membership of that card is verified through the same shared authorization routine used for every other resource access. Writes and deletes of thumbnail objects SHALL be performed by the backend, not the browser.

#### Scenario: Thumbnails live in their own bucket
- **WHEN** the system stores a card thumbnail
- **THEN** it SHALL place it in a dedicated private bucket that is not the static-asset bucket and that is not publicly readable

#### Scenario: The browser reads a thumbnail
- **WHEN** the browser needs to display a card's thumbnail
- **THEN** the backend SHALL issue a short-lived presigned URL for that object, and only after verifying the caller is authorized for that card

#### Scenario: The browser never writes or deletes thumbnails directly
- **WHEN** a card is saved or deleted
- **THEN** the corresponding thumbnail write or delete SHALL be performed by the backend against S3, not by a direct browser-to-S3 request

### Requirement: Thumbnail payloads are validated and bounded like any untrusted input
The system SHALL treat a supplied thumbnail as untrusted and SHALL validate it before storage, bounding its decoded size and constraining it to an expected image content type. A thumbnail that violates these bounds SHALL be rejected with a client-error response and the save SHALL still succeed with the card's data intact and no thumbnail stored. The backend SHALL NOT record thumbnail bytes in logs.

#### Scenario: An oversized or malformed thumbnail is submitted
- **WHEN** a save request carries a thumbnail that exceeds the size bound or is not a valid image of the expected type
- **THEN** the system SHALL reject the thumbnail, SHALL store the rest of the card, and SHALL NOT log the thumbnail bytes

#### Scenario: A card is saved without a thumbnail
- **WHEN** a save request carries no thumbnail (for example, generation failed in the browser)
- **THEN** the system SHALL store the card without a thumbnail key, and the library SHALL show a placeholder for it

