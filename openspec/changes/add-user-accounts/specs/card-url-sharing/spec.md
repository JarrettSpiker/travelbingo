## ADDED Requirements

### Requirement: URL sharing remains available without an account
The system SHALL keep the encoded-URL export and import mechanism available to every user, signed in or not, independently of any account, backend, or stored share link. Its availability SHALL NOT depend on the account backend being reachable, and a URL exported before server-side sharing existed SHALL continue to open correctly. Server-side share links are an additional mechanism offered alongside this one, never a replacement for it.

#### Scenario: Signed-out user exports and opens a card URL
- **WHEN** a user who is not signed in exports a card URL and later opens it
- **THEN** the system SHALL reconstruct the card exactly, without requiring an account and without contacting the account backend

#### Scenario: Account backend is unavailable
- **WHEN** the account backend cannot be reached
- **THEN** exporting and opening encoded card URLs SHALL continue to work unaffected

#### Scenario: Previously exported URLs keep working
- **WHEN** a user opens a card URL that was exported before server-side share links existed
- **THEN** the system SHALL reconstruct the card exactly as before, with no change to how the payload is encoded or decoded

#### Scenario: Both sharing mechanisms are offered distinctly
- **WHEN** a signed-in user is offered both the encoded card URL and a server-side share link
- **THEN** the system SHALL present them as distinct actions, so the user can tell which one requires an account and which one can be revoked
