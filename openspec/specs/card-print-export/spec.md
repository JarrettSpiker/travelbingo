# card-print-export Specification

## Purpose

Render the current card in a print-optimized layout and trigger the browser's native print dialog, so the card can be printed or saved as PDF.

## Requirements

### Requirement: Print-optimized card layout
The system SHALL render the current card in a print-optimized layout sized to fit a single standard page (US Letter / A4) when printed.

#### Scenario: Card prints correctly sized
- **WHEN** a user prints the current card
- **THEN** the card SHALL render on one page, correctly sized and legible on standard paper

### Requirement: Cells stay a fixed size regardless of content
The system SHALL keep each cell a fixed size on screen and in print, regardless of how long the cell's text is; the text size SHALL scale down instead of the cell growing.

#### Scenario: Long entry text
- **WHEN** a cell contains entry text longer than typical
- **THEN** the cell SHALL remain the same fixed size as other cells, and the text SHALL render at a smaller size so it fits within the cell

### Requirement: Card title shown on the printed card
The system SHALL render the user-provided card title as a heading on the printed card, when a title was provided.

#### Scenario: Title rendered
- **WHEN** a title was entered
- **THEN** the printed card SHALL display that title as a heading

#### Scenario: No title provided
- **WHEN** no title was entered
- **THEN** the printed card SHALL render without a title heading

### Requirement: Trigger printing from the browser
The system SHALL provide a control that opens the browser's native print dialog with the current card formatted for printing.

#### Scenario: User initiates print
- **WHEN** the user clicks the print/export control
- **THEN** the browser's print dialog SHALL open showing the print-formatted card, allowing the user to print or save as PDF via standard browser functionality
