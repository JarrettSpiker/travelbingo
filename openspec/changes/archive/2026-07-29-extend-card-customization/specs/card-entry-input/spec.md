## ADDED Requirements

### Requirement: Toggle the center free space on or off
The system SHALL let the user turn the center free space on or off. The free space SHALL be on by default. Turning the free space off removes the special center cell (see the card-generation capability for the effect on capacity) and disables the free-space text input.

#### Scenario: Free space on by default
- **WHEN** the card is loaded with no prior free-space choice
- **THEN** the free space SHALL be on

#### Scenario: User turns the free space off
- **WHEN** the user turns the free space off
- **THEN** the center cell SHALL no longer be treated as a free space and the free-space text input SHALL be disabled

#### Scenario: User turns the free space back on
- **WHEN** the user turns the free space back on
- **THEN** the center cell SHALL resume acting as the free space and the free-space text input SHALL be re-enabled

## MODIFIED Requirements

### Requirement: Custom free space content
The system SHALL let the user specify the text shown in the center "free" space of the grid, separate from the entry pool. The free-space text input SHALL be available only while the free space is turned on.

#### Scenario: Custom free space text provided
- **WHEN** the user enters custom text for the free space
- **THEN** the card's center cell SHALL display that text

#### Scenario: Free space left blank
- **WHEN** the user has not specified free space text
- **THEN** the system SHALL default the center cell's text to "FREE"

#### Scenario: Free space text unavailable when the free space is off
- **WHEN** the free space is turned off
- **THEN** the free-space text input SHALL be disabled and its value SHALL have no effect on the card
