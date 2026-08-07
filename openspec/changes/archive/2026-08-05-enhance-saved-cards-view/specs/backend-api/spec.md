## ADDED Requirements

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
