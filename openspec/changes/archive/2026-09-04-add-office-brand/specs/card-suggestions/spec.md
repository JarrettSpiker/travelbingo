## MODIFIED Requirements

### Requirement: Suggestion content loaded from bundled data
The system SHALL load the suggested cells and suggested themes from data files bundled with the app at build time, not via a network call. The data SHALL be authored separately from the component and logic code so it can be edited easily.

Suggestion data SHALL be **brand-scoped**: each brand SHALL supply its own suggested cells and suggested themes, and a build SHALL bundle only the selected brand's suggestion data. The loading, normalization, and add-to-pool behaviour SHALL be identical across brands — only the content differs.

#### Scenario: Suggestions are available offline
- **WHEN** the app runs with no network access
- **THEN** the suggested cells and themes SHALL still be available and usable

#### Scenario: A brand's suggestions are shown
- **WHEN** the suggestions dialog is opened in a build for a given brand
- **THEN** it SHALL present that brand's categories and themes, and SHALL NOT present any other brand's

#### Scenario: A brand supplies no usable suggestion content
- **WHEN** a brand's suggestion data yields no categories or no themes after normalization
- **THEN** the automated checks SHALL fail, rather than the brand shipping with an empty suggestions dialog

## ADDED Requirements

### Requirement: Suggested themes stay within the persisted-card font allowlist
Every font named by a brand's suggested themes SHALL be one the persisted-card validation accepts. Applying a suggested theme and then saving the card SHALL succeed for every theme every brand offers.

#### Scenario: A brand's theme names an unaccepted font
- **WHEN** a brand's suggested theme names a font outside the set the persisted-card validation accepts
- **THEN** the automated checks SHALL fail, naming the theme and the font

#### Scenario: A user saves a card built from a suggested theme
- **WHEN** a signed-in user applies any suggested theme offered by their brand and saves the card
- **THEN** the save SHALL succeed, and SHALL NOT be rejected on account of the theme's fonts
