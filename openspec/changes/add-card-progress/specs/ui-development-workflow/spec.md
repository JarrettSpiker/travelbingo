## MODIFIED Requirements

### Requirement: The card renderer's visual output is protected from incidental restyling
The card renderer produces user data — its output is consumed by the on-screen preview, printed output, exported images, and saved-card thumbnails. The system SHALL fail its automated checks when the card renderer's markup or stylesheet acquires styling that is derived from the application's own theme, so that restyling the application cannot silently change what users have already saved and exported. The renderer's allowlisted set of styling hooks SHALL cover every layer the renderer draws, including the layer that indicates recorded progress, so that adding to the renderer is a deliberate act recorded in the allowlist rather than an unnoticed one. The automated checks SHALL additionally fail when the card's stylesheet stops forcing its progress marks to be painted in printed output, since a mark that silently disappears from paper is indistinguishable from a card that was never played.

#### Scenario: Card renderer acquires application theme styling
- **WHEN** the card renderer's markup or stylesheet is modified to reference the application's design tokens, or to use styling hooks outside its own allowlisted set
- **THEN** the automated checks SHALL fail

#### Scenario: Card stylesheet loses its print rules
- **WHEN** the card's stylesheet no longer defines its card classes or its print rules
- **THEN** the automated checks SHALL fail

#### Scenario: A new renderer layer is added without being allowlisted
- **WHEN** the card renderer begins drawing a styling hook that is not in its allowlisted set, including one belonging to the progress-marking layer
- **THEN** the automated checks SHALL fail, identifying the hook that is not allowlisted

#### Scenario: Print rules stop painting progress marks
- **WHEN** the card's stylesheet no longer forces its progress marks to be painted in printed output
- **THEN** the automated checks SHALL fail

### Requirement: Visual review is part of the definition of done
The project's definition of done SHALL include a visual review step for any change that alters rendered output. The step SHALL require reviewing the affected screens in both light and dark presentation, and SHALL additionally require the print and export checks when the card renderer or its stylesheet was touched. Those print and export checks SHALL confirm that a card carrying no progress is unaffected, and — when the change concerns the progress-marking layer — that a card carrying progress renders its marks correctly in printed output, in exported images, and in saved-card thumbnails.

#### Scenario: A change alters rendered output
- **WHEN** a change modifies anything that is rendered
- **THEN** the change SHALL NOT be considered complete until the affected screens have been visually reviewed in both light and dark presentation

#### Scenario: A change touches the card renderer
- **WHEN** a change modifies the card renderer or its stylesheet
- **THEN** the change SHALL NOT be considered complete until printed output, exported images, and saved-card thumbnails have been confirmed correct — unaffected for a card carrying no progress, and showing the expected marks for a card carrying progress

#### Scenario: A change touches the progress-marking layer
- **WHEN** a change modifies how recorded progress is drawn on a card
- **THEN** the change SHALL NOT be considered complete until a card carrying progress has been reviewed in printed output, in an exported image, and as a saved-card thumbnail
