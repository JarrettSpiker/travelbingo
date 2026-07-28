## ADDED Requirements

### Requirement: Export the current card as a URL
The system SHALL let the user generate a URL that encodes the current card's exact state: the entries and blanks in their displayed grid positions, the title, the free-space text, and the color scheme.

#### Scenario: User exports a URL
- **WHEN** the user triggers the export action
- **THEN** the system SHALL generate a URL encoding the current card's state and make it available to the user (e.g. copied to the clipboard and/or displayed for manual copying)

### Requirement: Restore exact card state from an exported URL
The system SHALL, when loaded with an exported card URL, reconstruct the identical card: the same entries in the same grid positions (including any blank positions), the same title, free-space text, and color scheme — regardless of whether the exported card reflected the live (insertion-order) arrangement or a randomized one.

#### Scenario: Opening an exported URL
- **WHEN** a user opens a URL previously produced by the export action
- **THEN** the displayed card, entry list, title, free-space text, and color scheme SHALL match exactly what was exported

### Requirement: Handle missing or invalid card data in the URL gracefully
The system SHALL start with the normal empty/default state when the URL has no card data, and SHALL do the same (rather than erroring) when card data is present but malformed.

#### Scenario: No card data in the URL
- **WHEN** the app loads with no card data in the URL
- **THEN** the system SHALL start with an empty entry pool and the default title, free-space text, and color scheme

#### Scenario: Malformed card data in the URL
- **WHEN** the app loads with card data in the URL that cannot be parsed
- **THEN** the system SHALL start with the normal empty/default state rather than showing an error or a broken page
