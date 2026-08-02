# card-suggestions Specification

## Purpose

Help users get started by offering curated starter content — suggested cells grouped into categories and ready-made theme presets — loaded from bundled data and applied with a few clicks, so a new user can reach a complete, good-looking card without authoring every entry or tuning schemes by hand.

## Requirements

### Requirement: Open the suggestions dialog
The system SHALL provide a "See suggestions" control that opens a dialog presenting the available suggested content. The dialog SHALL make both suggested cells and suggested themes reachable from it.

#### Scenario: User opens suggestions
- **WHEN** the user activates the "See suggestions" control
- **THEN** a dialog SHALL open showing the suggested content, and the user SHALL be able to dismiss it

### Requirement: Suggested cells grouped by category
The system SHALL present suggested cells grouped into named categories (for example, Travel, Sports). The user SHALL first choose a category, then see the cells available within that category, and SHALL be able to select individual cells from it.

#### Scenario: Browse a category's cells
- **WHEN** the user chooses a category in the suggestions dialog
- **THEN** the cells belonging to that category SHALL be shown and selectable

#### Scenario: Switch categories
- **WHEN** the user chooses a different category
- **THEN** the cells shown SHALL change to those of the newly chosen category

### Requirement: Add selected suggested cells to the pool
The system SHALL append the user's selected suggested cells to the entry pool rather than replacing it. Any selected cell whose text duplicates an existing entry (case-insensitive, trimmed) SHALL be skipped, and the user SHALL be informed which cells were skipped as duplicates. Non-duplicate selected cells SHALL be added as ordinary (non-mandatory, enabled) entries.

#### Scenario: Selected cells are appended
- **WHEN** the user selects one or more cells from a category and confirms adding them
- **THEN** those cells SHALL be added to the entry pool and displayed in the entry list, and the card SHALL update to reflect the larger pool

#### Scenario: Duplicate cells are skipped
- **WHEN** a selected cell matches an entry already in the pool (ignoring case and surrounding whitespace)
- **THEN** that cell SHALL NOT be added again, and the user SHALL be told it was skipped as a duplicate

#### Scenario: Added cells are ordinary entries
- **WHEN** suggested cells are added to the pool
- **THEN** they SHALL be enabled and non-mandatory, like entries added manually

### Requirement: Suggested theme presets
The system SHALL offer suggested themes, where each theme is a preset bundle of a color scheme, a font scheme, and an emoji scheme. Applying a theme SHALL set all three schemes at once. The user SHALL be able to apply a theme without adding any suggested cells.

#### Scenario: Apply a theme
- **WHEN** the user applies a suggested theme
- **THEN** the card's color scheme, font scheme, and emoji scheme SHALL all be set to that theme's values, and the card and the customization controls SHALL reflect the new values

#### Scenario: Theme does not change entries
- **WHEN** the user applies a suggested theme
- **THEN** the entry pool SHALL be unchanged

### Requirement: Suggestion content loaded from bundled data
The system SHALL load the suggested cells and suggested themes from data files bundled with the app at build time, not via a network call. The data SHALL be authored separately from the component and logic code so it can be edited easily.

#### Scenario: Suggestions are available offline
- **WHEN** the app runs with no network access
- **THEN** the suggested cells and themes SHALL still be available and usable

### Requirement: Handle missing or malformed suggestion data gracefully
The system SHALL continue to function when the suggestion data is empty, incomplete, or malformed. The user SHALL be able to use the rest of the app; malformed or missing parts SHALL degrade gracefully (for example, an empty category list or an unavailable section) rather than causing the app to fail.

#### Scenario: Empty suggestion data
- **WHEN** the bundled suggestion data contains no categories or no themes
- **THEN** the suggestions dialog SHALL open without error and SHALL show the available (possibly empty) content

#### Scenario: Malformed suggestion data
- **WHEN** part of the bundled suggestion data cannot be interpreted
- **THEN** the system SHALL skip the unusable parts and SHALL still present any usable content, without showing an error page or breaking the rest of the app
