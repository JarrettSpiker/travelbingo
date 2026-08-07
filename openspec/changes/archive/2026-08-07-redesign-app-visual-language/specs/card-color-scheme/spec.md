## MODIFIED Requirements

### Requirement: Customize card colors
The system SHALL let the user independently set the card's background color, cell color, text color, and title color. The chosen colors SHALL apply to the current card immediately, including in the print layout. The color controls SHALL offer a curated set of suggested colors as a quick choice for each of these, while still allowing the user to choose any color.

#### Scenario: User sets custom colors
- **WHEN** the user selects a background color, cell color, text color, and title color
- **THEN** the card SHALL render using those colors, with the title rendered in the title color and the cells rendered in the text color

#### Scenario: User picks from the curated colors
- **WHEN** the user opens the control for one of the card's colors
- **THEN** the system SHALL present a curated set of colors to choose from, and choosing one SHALL apply it to the card immediately

#### Scenario: User chooses a color outside the curated set
- **WHEN** the user wants a color that is not among the curated choices
- **THEN** the system SHALL still let them select any color of their choosing
