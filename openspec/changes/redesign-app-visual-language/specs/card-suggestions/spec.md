## MODIFIED Requirements

### Requirement: Suggested theme presets
The system SHALL offer suggested themes, where each theme is a preset bundle of a color scheme, a font scheme, and an emoji scheme. Applying a theme SHALL set all three schemes at once. The user SHALL be able to apply a theme without adding any suggested cells. Suggested themes SHALL be reachable both from the suggestions dialog and directly from the card's customization controls.

#### Scenario: Apply a theme
- **WHEN** the user applies a suggested theme
- **THEN** the card's color scheme, font scheme, and emoji scheme SHALL all be set to that theme's values, and the card and the customization controls SHALL reflect the new values

#### Scenario: Theme does not change entries
- **WHEN** the user applies a suggested theme
- **THEN** the entry pool SHALL be unchanged

#### Scenario: Apply a theme from the customization controls
- **WHEN** the user applies a suggested theme from the card's customization controls, without opening the suggestions dialog
- **THEN** the system SHALL apply that theme's color, font, and emoji schemes exactly as it would from within the dialog
