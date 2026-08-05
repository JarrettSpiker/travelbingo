# card-library Specification

## Purpose
Defines the saved-card library available to a signed-in user: saving the current card to their account, listing what they have saved, opening a saved card back into the editor, renaming it, and deleting it.
## Requirements
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

### Requirement: Opening a saved card is durable across a page reload
The system SHALL reflect the identity of the saved card currently open in the editor in the page's URL, so that a reload, back/forward navigation, or bookmark restores that same card rather than presenting an empty editor. When the editor is loaded and the in-memory navigation handoff is absent but the URL identifies a saved card, the system SHALL fetch that card by its id and load it into the editor, reconstructing it exactly as the library's "open" action does. The system SHALL NOT make any API request on a plain editor load that has no card id in the URL, and SHALL NOT make any API request for a signed-out visitor. A card id present in the URL is not a capability: access to the card's data SHALL still be gated by the same owner-membership check that guards every saved-card read, and a request for another user's card SHALL be indistinguishable from a request for a card that does not exist. When the user leaves the saved card for a fresh, empty editor (for example, via the editor's "back" navigation), the system SHALL clear the card id from the URL so it does not linger as a pointer to a card the user is no longer editing.

#### Scenario: User reloads a saved card they are viewing
- **WHEN** a signed-in user who opened a saved card reloads the page
- **THEN** the editor SHALL re-fetch that card by its id and SHALL display it identical to how it appeared before the reload, rather than an empty editor

#### Scenario: Open card identity is in the URL from the first open
- **WHEN** a signed-in user opens a saved card from their library
- **THEN** the editor's URL SHALL identify that card, so that the reload behavior above applies immediately and the location is bookmarkable

#### Scenario: Reload with no card in the URL
- **WHEN** any visitor loads the editor with no card id in the URL
- **THEN** the system SHALL NOT make any API request on load and SHALL present the empty editor

#### Scenario: Signed-out visitor with a card id in the URL
- **WHEN** a signed-out visitor loads the editor with a card id in the URL
- **THEN** the system SHALL NOT fetch the card, SHALL NOT reveal the card's contents, and SHALL prompt the visitor to sign in

#### Scenario: A user reloads a card id belonging to another user
- **WHEN** a signed-in user loads the editor with a card id they hold no membership for
- **THEN** the system SHALL respond exactly as it would for a non-existent card, revealing nothing about whether that card exists

#### Scenario: User leaves the saved card for a fresh editor
- **WHEN** a user who had a saved card open navigates to a fresh, empty editor
- **THEN** the system SHALL remove the card id from the URL, so a subsequent reload no longer reopens that card

#### Scenario: Reloading does not silently discard unsaved edits without notice
- **WHEN** a user reloads while the editor holds changes that have not been saved
- **THEN** the system SHALL restore the saved card as last persisted and SHALL NOT attempt to preserve the unsaved edits (out of scope), and the editor's existing dirty-state affordances continue to apply on top of the restored saved card

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
