# card-url-sharing Specification

## Purpose

Encode the current card's exact state into a URL and reconstruct that state when the URL is opened, so a card can be saved and shared with no backend or persistence layer.

## Requirements

### Requirement: Export the current card as a URL
The system SHALL let the user generate a URL that encodes the current card's exact state: the entries and blanks in their displayed grid positions, the title, the free-space text, whether the free space is turned on, the color scheme (including the title color), the font scheme, and the emoji scheme (the chosen edge/border emojis). The encoded payload SHALL carry a schema version so it can be decoded forward-compatibly.

#### Scenario: User exports a URL
- **WHEN** the user triggers the export action
- **THEN** the system SHALL generate a URL encoding the current card's state — including the free-space on/off state, title color, font scheme, and chosen edge/border emojis — and make it available to the user (e.g. copied to the clipboard and/or displayed for manual copying)

### Requirement: Restore exact card state from an exported URL
The system SHALL, when loaded with an exported card URL, reconstruct the identical card: the same entries in the same grid positions (including any blank positions), the same title, free-space text, free-space on/off state, color scheme (including the title color), font scheme, and emoji scheme (the same chosen edge/border emojis, arranged identically) — regardless of whether the exported card reflected the live (insertion-order) arrangement or a randomized one.

#### Scenario: Opening an exported URL
- **WHEN** a user opens a URL previously produced by the export action
- **THEN** the displayed card, entry list, title, free-space text, free-space on/off state, colors, fonts, and edge/border emojis SHALL match exactly what was exported

### Requirement: Handle missing or invalid card data in the URL gracefully
The system SHALL start with the normal empty/default state when the URL has no card data, and SHALL do the same (rather than erroring) when card data is present but malformed. When the URL contains an older payload that lacks newer fields, the system SHALL decode it using sensible defaults for the missing fields (including defaulting the emoji scheme to no emojis) rather than treating it as invalid.

#### Scenario: No card data in the URL
- **WHEN** the app loads with no card data in the URL
- **THEN** the system SHALL start with an empty entry pool and the default title, free-space text, colors, fonts, and no edge/border emojis

#### Scenario: Malformed card data in the URL
- **WHEN** the app loads with card data in the URL that cannot be parsed
- **THEN** the system SHALL start with the normal/default state rather than showing an error or a broken page

#### Scenario: Older URL format missing newer fields
- **WHEN** the app loads a URL whose payload predates a field such as the free-space toggle, title color, font scheme, or emoji scheme
- **THEN** the system SHALL apply the default value for each missing field (no edge/border emojis when the emoji scheme is absent) and SHALL still restore the rest of the card's state
