## MODIFIED Requirements

### Requirement: A signed-in user can save the current card
The system SHALL let a signed-in user save the current card to their account, capturing the card's exact state: the entries and blanks in their displayed grid positions, the title, the free-space text and on/off state, the color scheme, the font scheme, and the emoji scheme. Saving a card that was itself opened from the library SHALL update that card rather than creating a duplicate. The system SHALL record the payload's schema version with the saved card.

#### Scenario: User saves a new card
- **WHEN** a signed-in user saves a card that did not come from their library
- **THEN** the system SHALL create a new saved card owned by that user and confirm the save

#### Scenario: User re-saves a card opened from the library
- **WHEN** a signed-in user saves a card they previously opened from their library
- **THEN** the system SHALL update that existing saved card and SHALL NOT create a second entry

#### Scenario: Signed-out user attempts to save
- **WHEN** a signed-out user triggers the save action
- **THEN** the system SHALL prompt them to sign in rather than failing silently, and SHALL NOT lose the card they were editing
