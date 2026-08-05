## MODIFIED Requirements

### Requirement: A signed-in user can save the current card
The system SHALL let a signed-in user save the current card to their account, capturing the card's exact state: the entries and blanks in their displayed grid positions, the title, the free-space text and on/off state, the color scheme, the font scheme, and the emoji scheme. The saved card SHALL additionally capture the **full entry pool** as it existed at save time — every entry's text together with its mandatory and enabled flags — including entries beyond the grid's capacity (which never appeared on the rendered card) and including disabled entries. The on-grid arrangement (`slots`) SHALL continue to be captured so the rendered card can be reproduced exactly. Saving a card that was itself opened from the library SHALL update that card rather than creating a duplicate. The system SHALL record the payload's schema version with the saved card.

#### Scenario: User saves a new card
- **WHEN** a signed-in user saves a card that did not come from their library
- **THEN** the system SHALL create a new saved card owned by that user and confirm the save

#### Scenario: User re-saves a card opened from the library
- **WHEN** a signed-in user saves a card they previously opened from their library
- **THEN** the system SHALL update that existing saved card and SHALL NOT create a second entry

#### Scenario: Signed-out user attempts to save
- **WHEN** a signed-out user triggers the save action
- **THEN** the system SHALL prompt them to sign in rather than failing silently, and SHALL NOT lose the card they were editing

#### Scenario: Pool larger than the grid is saved in full
- **WHEN** a signed-in user saves a card whose entry pool has more enabled entries than the grid's capacity
- **THEN** the system SHALL persist every entry in the pool — including those not selected for the rendered card — with each entry's mandatory and enabled flags intact

#### Scenario: Disabled entries are saved
- **WHEN** a signed-in user saves a card whose pool contains a disabled entry
- **THEN** that entry SHALL be persisted as part of the pool with its text, mandatory flag, and disabled state, so that re-enabling it after reopening restores it unchanged

## ADDED Requirements

### Requirement: Opening a saved card restores the full entry pool
The system SHALL restore a saved card's full entry pool when it is opened in the editor, including every entry that exceeded the grid's capacity at save time, each with its mandatory and enabled flags exactly as they were saved. The rendered grid SHALL still be reconstructed from the saved on-grid arrangement (`slots`), so the card looks identical to how it was saved. For a saved card that predates the full-pool field, the system SHALL fall back to deriving the entry pool from the saved grid (today's behavior), and SHALL NOT treat the missing field as an error.

#### Scenario: User opens a card whose pool exceeded the grid
- **WHEN** a signed-in user opens a saved card whose entry pool was larger than the grid's capacity when it was saved
- **THEN** the editor's entry list SHALL contain every entry from the saved pool, including those that did not appear on the rendered card, and each entry's mandatory and enabled flags SHALL match what was saved

#### Scenario: Mandatory and enabled flags are preserved on open
- **WHEN** a signed-in user opens a saved card whose entries had mandatory and/or disabled states
- **THEN** those flags SHALL be reflected in the editor exactly as they were at save time

#### Scenario: Legacy card without the full pool
- **WHEN** a signed-in user opens a saved card that was saved before the full entry pool was captured
- **THEN** the system SHALL derive the entry pool from the saved grid and SHALL NOT error, and any entries that were not on the rendered grid at save time remain unavailable until the user re-adds them

#### Scenario: Rendered grid is unchanged
- **WHEN** a saved card is opened
- **THEN** the rendered card SHALL match the saved on-grid arrangement — the same entries in the same grid positions including blanks — regardless of how the entry pool is restored
