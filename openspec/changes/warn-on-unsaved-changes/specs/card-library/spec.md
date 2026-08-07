## MODIFIED Requirements

### Requirement: A signed-in user can list and open their saved cards
The system SHALL show a signed-in user the cards saved to their account as a browsable grid of visual previews, each identified by title and last-updated time, and SHALL let them open one back into the editor. Each preview SHALL render a thumbnail image of the card as it was last saved; when no thumbnail exists the system SHALL show a placeholder rather than failing. From each card in the grid the user SHALL be able to manage that card's share links directly, without opening the editor (see `card-share-links`). An opened card SHALL be reconstructed exactly: the same entries in the same grid positions including blanks, the same title, free-space text and on/off state, colors, fonts, and edge/border emojis. Opening a saved card while the editor holds unsaved changes SHALL be governed by the `unsaved-changes-guard` capability, which defines the confirmation presented before the editor's contents are replaced.

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
- **WHEN** a user opens a saved card from their library while the editor holds unsaved changes
- **THEN** the system SHALL confirm with the user before replacing the editor's contents, as defined by the `unsaved-changes-guard` capability

#### Scenario: User manages share links from the library
- **WHEN** a signed-in user invokes the per-card share action on a card in the grid
- **THEN** the system SHALL let them create, view, copy, and revoke share links for that card without leaving the library view
