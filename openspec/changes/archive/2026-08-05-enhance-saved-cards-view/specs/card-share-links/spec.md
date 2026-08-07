## MODIFIED Requirements

### Requirement: The owner of a saved card can mint a share link
The system SHALL let the owner of a saved card create a share link identified by an opaque, unguessable token. The link SHALL carry a snapshot of the card taken at the moment the link was created. The system SHALL let the owner see the share links that exist for a card, and SHALL let the owner create, view, copy, and revoke share links both from within the editor and directly from the card's entry in the library grid.

#### Scenario: Owner creates a share link
- **WHEN** the owner of a saved card creates a share link
- **THEN** the system SHALL generate a link containing an unguessable token and make it available to the owner to copy

#### Scenario: Owner manages share links from the library
- **WHEN** the owner invokes the per-card share action on a card in the saved-cards grid
- **THEN** the system SHALL let them create, view, copy, and revoke that card's share links without opening the editor

#### Scenario: Non-owner attempts to create a share link
- **WHEN** a user who does not own the card attempts to create a share link for it
- **THEN** the system SHALL refuse, responding exactly as it would for a card that does not exist
