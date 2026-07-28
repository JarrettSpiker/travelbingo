## ADDED Requirements

### Requirement: Customize card colors
The system SHALL let the user independently set the card's background color, cell color, and text color. The chosen colors SHALL apply to the current card immediately, including in the print layout.

#### Scenario: User sets custom colors
- **WHEN** the user selects a background color, cell color, and text color
- **THEN** the card SHALL render using those colors

### Requirement: Randomize card colors
The system SHALL let the user randomize the background color, cell color, and text color with a single action.

#### Scenario: User randomizes colors
- **WHEN** the user triggers color randomization
- **THEN** the system SHALL choose new random values for the background color, cell color, and text color, replace any previously selected values, and reflect the new values in the color controls

### Requirement: Default color scheme
The system SHALL apply a default background color, cell color, and text color when the user has not customized or randomized them.

#### Scenario: No customization made
- **WHEN** the user has not changed the color controls
- **THEN** the card SHALL render using the default color scheme
