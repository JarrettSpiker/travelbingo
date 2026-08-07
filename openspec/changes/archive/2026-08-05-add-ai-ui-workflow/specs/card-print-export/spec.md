## ADDED Requirements

### Requirement: Printed output contains only the card
The system SHALL exclude all application chrome from printed output, so that printing produces the card alone regardless of what navigation, controls, headers, or page decoration surround it on screen. This exclusion SHALL be the default for any element that is not part of the card, rather than something each element must opt into.

#### Scenario: Editor chrome is excluded
- **WHEN** the user prints while the editor's controls, headings, and export actions are on screen
- **THEN** the printed output SHALL contain only the card, with none of those controls appearing on the page

#### Scenario: New chrome is excluded without being marked
- **WHEN** application chrome is added around the card — for example a persistent header, navigation, or a page background — and is not explicitly marked as non-printing
- **THEN** the printed output SHALL still contain only the card

#### Scenario: Page decoration does not paint
- **WHEN** the page carries a background treatment behind the card on screen
- **THEN** that background SHALL NOT appear in the printed output

### Requirement: Printed and exported output is independent of the application's display mode
The card is a document rather than application interface: its appearance is determined by the user's saved color, font, and emoji schemes. The system SHALL produce identical printed output and identical exported images for a given card regardless of whether the application is being displayed in light or dark presentation.

#### Scenario: Printing in dark presentation
- **WHEN** the same card is printed with the application displayed in light presentation, and again with it displayed in dark presentation
- **THEN** the two printed results SHALL be equivalent, reflecting only the card's own saved schemes

#### Scenario: Exporting an image in dark presentation
- **WHEN** the same card is exported as an image with the application displayed in light presentation, and again with it displayed in dark presentation
- **THEN** the two exported images SHALL be equivalent, reflecting only the card's own saved schemes

#### Scenario: Saved-card thumbnail is unaffected by display mode
- **WHEN** a card is saved while the application is displayed in dark presentation
- **THEN** the generated thumbnail SHALL reflect the card's own saved schemes, matching the thumbnail that would be generated in light presentation
