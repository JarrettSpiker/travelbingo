# card-library Specification

## Purpose
Defines the saved-card library available to a signed-in user: saving the current card to their account, listing what they have saved, opening a saved card back into the editor, renaming it, and deleting it.
## Requirements
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

### Requirement: A signed-in user can rename and delete their saved cards
The system SHALL let the owner of a saved card change its title and delete it. Deleting a card SHALL also remove every record associated with it, including its membership records, its stored thumbnail (if any), and any share links minted from it.

#### Scenario: Owner renames a card
- **WHEN** the owner changes a saved card's title
- **THEN** the new title SHALL be reflected in the library grid

#### Scenario: Owner deletes a card
- **WHEN** the owner deletes a saved card
- **THEN** the card SHALL no longer appear in their library, its thumbnail SHALL be removed from storage, and any share link previously minted from it SHALL no longer resolve

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

