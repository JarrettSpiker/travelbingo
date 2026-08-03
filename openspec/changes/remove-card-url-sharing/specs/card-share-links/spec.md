## MODIFIED Requirements

### Requirement: Anyone with the link receives a copy, with no account required
The system SHALL let any visitor open a share link without signing in, and SHALL present them the card as an independent copy. Changes the recipient makes SHALL NOT affect the owner's saved card. A signed-in recipient SHALL be able to save that copy to their own library as a new card of their own.

#### Scenario: Signed-out recipient opens a share link
- **WHEN** a visitor with no account opens a share link
- **THEN** the system SHALL display the shared card and let them edit, print, and export it as an image, without prompting them to sign in

#### Scenario: Recipient edits the shared card
- **WHEN** a recipient modifies the card they received from a share link
- **THEN** the owner's saved card SHALL be unchanged

#### Scenario: Signed-in recipient keeps a copy
- **WHEN** a signed-in recipient saves a card they opened from a share link
- **THEN** the system SHALL create a new card owned by the recipient, leaving the owner's card untouched
