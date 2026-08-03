## Purpose

Defines the saved-card library available to a signed-in user: saving the current card to their account, listing what they have saved, opening a saved card back into the editor, renaming it, and deleting it.

## ADDED Requirements

### Requirement: A signed-in user can save the current card
The system SHALL let a signed-in user save the current card to their account, capturing the same state the `?card=` URL captures: the entries and blanks in their displayed grid positions, the title, the free-space text and on/off state, the color scheme, the font scheme, and the emoji scheme. Saving a card that was itself opened from the library SHALL update that card rather than creating a duplicate. The system SHALL record the payload's schema version with the saved card.

#### Scenario: User saves a new card
- **WHEN** a signed-in user saves a card that did not come from their library
- **THEN** the system SHALL create a new saved card owned by that user and confirm the save

#### Scenario: User re-saves a card opened from the library
- **WHEN** a signed-in user saves a card they previously opened from their library
- **THEN** the system SHALL update that existing saved card and SHALL NOT create a second entry

#### Scenario: Signed-out user attempts to save
- **WHEN** a signed-out user triggers the save action
- **THEN** the system SHALL prompt them to sign in rather than failing silently, and SHALL NOT lose the card they were editing

### Requirement: A signed-in user can list and open their saved cards
The system SHALL show a signed-in user the cards saved to their account, identified by title and last-updated time, and SHALL let them open one back into the editor. An opened card SHALL be reconstructed exactly: the same entries in the same grid positions including blanks, the same title, free-space text and on/off state, colors, fonts, and edge/border emojis.

#### Scenario: User lists saved cards
- **WHEN** a signed-in user opens their library
- **THEN** the system SHALL list the cards they have saved, and SHALL NOT list any card belonging to another user

#### Scenario: User opens a saved card
- **WHEN** a signed-in user opens a card from their library
- **THEN** the editor SHALL display a card identical to the one that was saved, in every respect the save captured

#### Scenario: Opening a saved card would discard unsaved work
- **WHEN** a user opens a saved card while the editor holds unsaved changes
- **THEN** the system SHALL confirm with the user before replacing the editor's contents

### Requirement: A signed-in user can rename and delete their saved cards
The system SHALL let the owner of a saved card change its title and delete it. Deleting a card SHALL also remove every record associated with it, including its membership records and any share links minted from it.

#### Scenario: Owner renames a card
- **WHEN** the owner changes a saved card's title
- **THEN** the new title SHALL be reflected in the library listing

#### Scenario: Owner deletes a card
- **WHEN** the owner deletes a saved card
- **THEN** the card SHALL no longer appear in their library, and any share link previously minted from it SHALL no longer resolve

### Requirement: Saved cards are private to their owner
The system SHALL make a saved card readable and modifiable only by a user holding a membership record for it. A request from any other user SHALL be indistinguishable from a request for a card that does not exist.

#### Scenario: A user requests another user's card
- **WHEN** a signed-in user requests a card they hold no membership for
- **THEN** the system SHALL respond exactly as it would for a non-existent card, revealing nothing about whether that card exists

### Requirement: The number of cards a user can save is bounded
The system SHALL enforce an upper bound on the number of cards a single user may save, and SHALL reject a save that would exceed it with a message explaining the limit.

#### Scenario: User reaches the save limit
- **WHEN** a user attempts to save a card beyond the per-user limit
- **THEN** the system SHALL refuse the save and explain the limit, rather than failing with a generic error
