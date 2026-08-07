## MODIFIED Requirements

### Requirement: A signed-in user can list and open their saved cards
The system SHALL show a signed-in user the cards saved to their account as a browsable grid of visual previews, each identified by title and last-updated time, and SHALL let them open one back into the editor. Each preview SHALL render a thumbnail image of the card as it was last saved; when no thumbnail exists the system SHALL show a placeholder rather than failing. From each card in the grid the user SHALL be able to manage that card's share links directly, without opening the editor (see `card-share-links`). An opened card SHALL be reconstructed exactly: the same entries in the same grid positions including blanks, the same title, free-space text and on/off state, colors, fonts, and edge/border emojis.

#### Scenario: User lists saved cards
- **WHEN** a signed-in user opens their library
- **THEN** the system SHALL show a grid of their saved cards, each with a thumbnail preview, title, and last-updated time, and SHALL NOT show any card belonging to another user

#### Scenario: A card has no thumbnail yet
- **WHEN** a saved card predates thumbnail generation (for example, saved before this feature existed)
- **THEN** the system SHALL show a placeholder preview for that card and SHALL NOT treat the missing thumbnail as an error

#### Scenario: User opens a saved card
- **WHEN** a signed-in user opens a card from their library
- **THEN** the editor SHALL display a card identical to the one that was saved, in every respect the save captured

#### Scenario: Opening a saved card would discard unsaved work
- **WHEN** a user opens a saved card while the editor holds unsaved changes
- **THEN** the system SHALL confirm with the user before replacing the editor's contents

#### Scenario: User manages share links from the library
- **WHEN** a signed-in user invokes the per-card share action on a card in the grid
- **THEN** the system SHALL let them create, view, copy, and revoke share links for that card without leaving the library view

### Requirement: A signed-in user can rename and delete their saved cards
The system SHALL let the owner of a saved card change its title and delete it. Deleting a card SHALL also remove every record associated with it, including its membership records, its stored thumbnail (if any), and any share links minted from it.

#### Scenario: Owner renames a card
- **WHEN** the owner changes a saved card's title
- **THEN** the new title SHALL be reflected in the library grid

#### Scenario: Owner deletes a card
- **WHEN** the owner deletes a saved card
- **THEN** the card SHALL no longer appear in their library, its thumbnail SHALL be removed from storage, and any share link previously minted from it SHALL no longer resolve

## ADDED Requirements

### Requirement: Saving a card generates a thumbnail
The system SHALL generate a thumbnail image of the current card when a signed-in user saves it, capturing the card's title (when one was provided), its grid, its color scheme, and its font scheme at a reduced fidelity suitable for a grid preview. The thumbnail SHALL be generated entirely in the browser from the already-styled card DOM, and SHALL be stored alongside the saved card keyed by the card's identifier. Re-saving an existing card SHALL replace its thumbnail.

#### Scenario: User saves a card with a thumbnail
- **WHEN** a signed-in user saves a card
- **THEN** the system SHALL generate a thumbnail of the current card and store it so that the library grid can display it

#### Scenario: User re-saves a card
- **WHEN** a signed-in user saves a card that already has a thumbnail
- **THEN** the system SHALL replace the existing thumbnail with one reflecting the card's current state

#### Scenario: Thumbnail generation fails
- **WHEN** the system is unable to generate the thumbnail during a save (for example, the rendering step fails)
- **THEN** the save SHALL still succeed with the card's data intact, and the card SHALL appear in the library with a placeholder until it is next saved

### Requirement: Card thumbnails are private to their owner
The system SHALL make a card's thumbnail readable only to a user authorized for that card, using the same membership check that guards the card itself. Thumbnail storage SHALL NOT be publicly readable, and access SHALL be granted only via short-lived signed URLs issued after authorization. A request by any other user for a thumbnail SHALL be indistinguishable from a request for a thumbnail that does not exist.

#### Scenario: Owner views their library
- **WHEN** an authorized user views their library grid
- **THEN** the system SHALL issue short-lived signed URLs that let the browser load each card's thumbnail

#### Scenario: Another user attempts to read a thumbnail
- **WHEN** a user requests a thumbnail for a card they hold no membership for
- **THEN** the system SHALL respond exactly as it would for a non-existent thumbnail, revealing nothing about whether the card exists
