## ADDED Requirements

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
