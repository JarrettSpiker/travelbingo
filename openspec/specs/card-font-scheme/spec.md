# card-font-scheme Specification

## Purpose

Lets the user choose the fonts used to render the card title and cells, so the card's typography can be customized for both screen and print.

## Requirements

### Requirement: Choose card fonts
The system SHALL let the user independently select a title font and a cell font from a fixed set of font options. The selected fonts SHALL apply to the current card immediately, including in the print layout.

#### Scenario: User selects fonts
- **WHEN** the user chooses a title font and/or a cell font
- **THEN** the card title SHALL render in the selected title font and the card cells SHALL render in the selected cell font

#### Scenario: Fonts apply to print
- **WHEN** the user prints the card after selecting fonts
- **THEN** the printed card SHALL use the selected title and cell fonts

### Requirement: Default font scheme
The system SHALL apply a default title font and cell font when the user has not changed them.

#### Scenario: No font customization made
- **WHEN** the user has not changed the font controls
- **THEN** the card SHALL render using the default title and cell fonts
