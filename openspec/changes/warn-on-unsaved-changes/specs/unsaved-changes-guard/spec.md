## Purpose

Ensures a user never loses the card they are building to a stray click or a reload. The editor tracks whether its current card has changes the user has not saved, and — while it does — it intercepts any navigation that would discard those changes (in-app links, opening another card, back/forward, reload, and tab close) with a confirmation that lets the user save first, leave anyway, or stay.

## ADDED Requirements

### Requirement: The editor reflects whether the current card has unsaved changes
The editor SHALL consider the current card to have unsaved changes whenever its current state differs from a baseline, where state comprises the entries (text, mandatory flag, and enabled flag), the rendered grid arrangement, the title, the free-space text and on/off state, and the color, font, and emoji schemes. The baseline SHALL be the card the editor was opened with (an empty editor when no card was opened), and SHALL be refreshed to match the editor's current state immediately after every successful save. A card that was just opened from the library, a card that was just saved, and an untouched empty editor SHALL NOT be considered to have unsaved changes.

#### Scenario: A freshly opened card is not dirty
- **WHEN** a signed-in user opens a card from their library into the editor
- **THEN** the editor SHALL NOT consider that card to have unsaved changes, and SHALL NOT block navigation, until the user edits it

#### Scenario: An untouched empty editor is not dirty
- **WHEN** the editor is loaded empty and the user has not interacted with it
- **THEN** the editor SHALL NOT consider the card to have unsaved changes, and SHALL NOT block navigation

#### Scenario: Editing marks the card as having unsaved changes
- **WHEN** the user adds, edits, removes, enables/disables, or flags an entry, changes the title or free-space, or changes the color, font, or emoji scheme of a card
- **THEN** the editor SHALL consider the card to have unsaved changes until it is saved

#### Scenario: Randomizing marks the card as having unsaved changes
- **WHEN** the user randomizes the card's grid arrangement
- **THEN** the editor SHALL consider the card to have unsaved changes, because the arrangement that would be saved has changed

#### Scenario: A successful save clears the unsaved-changes state
- **WHEN** the user saves a card and the save succeeds
- **THEN** the editor SHALL no longer consider the card to have unsaved changes, and subsequent navigation SHALL proceed without a confirmation

### Requirement: Navigation away from a dirty editor is confirmed before leaving
Whenever the editor holds unsaved changes, the system SHALL intercept any navigation that would leave the editor and present a confirmation before that navigation proceeds. This SHALL cover every in-app navigation away from the editor, including following the header wordmark, a navigation link, or the account menu's library entry; opening another saved card; and in-app history navigation (browser back/forward). When the editor has no unsaved changes, navigation SHALL proceed without any confirmation.

#### Scenario: A header navigation link is intercepted while there are unsaved changes
- **WHEN** a user with unsaved changes in the editor follows a header link (such as "My cards")
- **THEN** the system SHALL present the unsaved-changes confirmation instead of leaving immediately, and SHALL keep the editor's contents until the user chooses

#### Scenario: Opening another saved card is intercepted while there are unsaved changes
- **WHEN** a user with unsaved changes opens a different saved card from their library
- **THEN** the system SHALL present the unsaved-changes confirmation before replacing the editor's contents

#### Scenario: Back or forward navigation is intercepted while there are unsaved changes
- **WHEN** a user with unsaved changes triggers in-app back or forward navigation
- **THEN** the system SHALL present the unsaved-changes confirmation rather than navigating away

#### Scenario: Navigation while clean proceeds without a prompt
- **WHEN** a user whose editor has no unsaved changes follows any navigation away from the editor
- **THEN** the system SHALL NOT present any confirmation and SHALL navigate immediately

#### Scenario: Choosing to stay cancels the navigation
- **WHEN** a user dismisses the unsaved-changes confirmation by choosing to stay
- **THEN** the system SHALL abort the pending navigation and SHALL leave the editor and all of its changes intact

### Requirement: The confirmation lets a signed-in user save before leaving
The unsaved-changes confirmation SHALL offer the user the choice to stay, to leave without saving, and — when the user is signed in — to save the card and then leave. Choosing to save SHALL save the editor's current card and, only on a successful save, proceed with the pending navigation and mark the card clean. If the save fails, the system SHALL NOT proceed with the navigation, SHALL keep the editor's contents and changes, and SHALL surface the failure so the user can retry the save or choose to leave without saving.

#### Scenario: Saving then leaving proceeds after a successful save
- **WHEN** a signed-in user chooses to save and leave from the confirmation, and the save succeeds
- **THEN** the system SHALL complete the pending navigation and SHALL mark the card as no longer having unsaved changes

#### Scenario: A failed save keeps the user on the editor
- **WHEN** a signed-in user chooses to save and leave, and the save fails
- **THEN** the system SHALL NOT navigate away, SHALL keep the editor's contents unchanged, and SHALL inform the user that the save failed so they can retry or leave without saving

#### Scenario: Leaving without saving discards the changes and navigates
- **WHEN** a user chooses to leave without saving from the confirmation
- **THEN** the system SHALL proceed with the pending navigation and the unsaved changes SHALL be discarded

### Requirement: Signed-out users are warned but cannot save from the confirmation
Because saving to the library requires an account, the unsaved-changes confirmation for a signed-out user SHALL offer only to leave without saving or to stay, and SHALL NOT offer to save the card from within the confirmation. The signed-out confirmation SHALL still be presented whenever navigation would discard unsaved changes, so a signed-out user never loses a card they are building silently.

#### Scenario: The signed-out confirmation omits the save option
- **WHEN** a signed-out user with unsaved changes triggers navigation away from the editor
- **THEN** the confirmation SHALL present a leave-without-saving choice and a stay choice, and SHALL NOT present a save choice

#### Scenario: A signed-out user is still warned before losing work
- **WHEN** a signed-out user who has built a card triggers navigation that would discard it
- **THEN** the system SHALL present the confirmation, so the user has the chance to stay and print or export the card rather than losing it

### Requirement: Reload, tab close, and external navigation warn when there are unsaved changes
While the editor holds unsaved changes, the system SHALL arm the browser's unload guard so that a page reload, closing the tab or window, or navigating to an external location prompts the user before the document is unloaded. When the editor has no unsaved changes, the guard SHALL be disarmed, so reloads and tab close are not interrupted. If the user proceeds past the warning, the existing reload behavior (restoring the last saved card and not preserving the unsaved edits) SHALL apply unchanged.

#### Scenario: Reload with unsaved changes warns
- **WHEN** a user reloads the page while the editor holds unsaved changes
- **THEN** the browser SHALL prompt the user to confirm before unloading the document

#### Scenario: Tab close with unsaved changes warns
- **WHEN** a user closes the tab or window while the editor holds unsaved changes
- **THEN** the browser SHALL prompt the user to confirm before closing

#### Scenario: Reload with no unsaved changes does not warn
- **WHEN** a user reloads the page and the editor has no unsaved changes
- **THEN** the browser SHALL NOT prompt, and the reload SHALL proceed normally
