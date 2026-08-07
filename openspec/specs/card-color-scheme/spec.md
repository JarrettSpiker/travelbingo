# card-color-scheme Specification

## Purpose

Let the user set, randomize, or accept defaults for the card's colors, applied to the on-screen card and the printed output.

## Requirements

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

### Requirement: Randomize card colors
The system SHALL let the user randomize the background color, cell color, text color, and title color with a single action.

#### Scenario: User randomizes colors
- **WHEN** the user triggers color randomization
- **THEN** the system SHALL choose new random values for the background color, cell color, text color, and title color, replace any previously selected values, and reflect the new values in the color controls

### Requirement: Default color scheme
The system SHALL apply a default background color, cell color, text color, and title color when the user has not customized or randomized them.

#### Scenario: No customization made
- **WHEN** the user has not changed the color controls
- **THEN** the card SHALL render using the default color scheme
