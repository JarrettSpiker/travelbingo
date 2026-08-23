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
The system SHALL provide an Export control that opens a menu of export options. Selecting the PDF option from this menu SHALL open the browser's native print dialog with the current card formatted for printing. The PNG option in the same menu is covered by the "Export the card as a PNG image" requirement.

#### Scenario: User initiates print
- **WHEN** the user opens the Export menu and chooses the PDF option
- **THEN** the browser's print dialog SHALL open showing the print-formatted card, allowing the user to print or save as PDF via standard browser functionality

### Requirement: Export the card as a PNG image
The system SHALL let the user export the current card as a downloadable PNG image that captures the card's title (when one was provided), its cells, its color scheme, and its font scheme. The exported PNG SHALL reflect the same fixed-size cells with text scaled down to fit as the card shows on screen and in print. The PNG SHALL be generated entirely in the browser with no network call. Selecting the PNG option from the Export menu SHALL produce the image and download it as a file.

#### Scenario: User exports a PNG
- **WHEN** the user opens the Export menu and chooses the PNG option
- **THEN** the system SHALL generate a PNG of the current card and download it to the user's device

#### Scenario: PNG reflects the card's styling
- **WHEN** a card that has a title, a color scheme, and a font scheme is exported as a PNG
- **THEN** the resulting image SHALL display the title (if one was provided) and SHALL use the current card's colors and fonts

#### Scenario: Long entry text fits in the PNG
- **WHEN** a card is exported as a PNG and one of its cells contains entry text longer than typical
- **THEN** that cell in the image SHALL remain the same fixed size as the other cells, with its text rendered at a smaller size so it fits within the cell

#### Scenario: PNG filename is derived from the title
- **WHEN** the user exports a PNG for a card that has a title
- **THEN** the downloaded file SHALL have a `.png` extension and a name derived from the card's title

#### Scenario: PNG export without a title
- **WHEN** the user exports a PNG for a card that has no title
- **THEN** the image SHALL render without a title heading and the downloaded file SHALL fall back to a default name with a `.png` extension

#### Scenario: PNG export failure is handled gracefully
- **WHEN** the system is unable to generate the PNG image (for example, the rendering step fails)
- **THEN** the system SHALL inform the user that the export could not be completed rather than leaving the export action with no visible result

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

### Requirement: Export a card being played as an image carrying its progress
The system SHALL let a member of a trip export any of its trip cards as a downloadable image, and that image SHALL carry the card's recorded progress alongside its title, cells, colour scheme, and font scheme. The image SHALL be generated entirely in the browser with no network call, exactly as the editor's image export is, and SHALL be produced by the same export path so the two cannot diverge. Export SHALL be available to every member who can see the card, not only to the member entitled to modify its progress.

#### Scenario: Member exports a trip card carrying progress
- **WHEN** a member opens the export control on a trip card that has marked squares and chooses the image option
- **THEN** the system SHALL generate an image of that card showing its marked squares and download it to the member's device

#### Scenario: Exported progress matches what is on screen
- **WHEN** a trip card is exported as an image
- **THEN** the marked squares in the image SHALL be exactly those shown as marked on screen, in the same positions

#### Scenario: Exporting a card with no progress
- **WHEN** a member exports a trip card on which nothing has been marked
- **THEN** the resulting image SHALL show the card with no marks, equivalent to the image the same card produced before marking existed

#### Scenario: A member exports a card assigned to someone else
- **WHEN** a member exports a trip card that is assigned to a different member
- **THEN** the system SHALL produce the image, because export follows visibility rather than the right to modify progress

#### Scenario: Trip card image filename is derived from its title
- **WHEN** a member exports a trip card that carries a title
- **THEN** the downloaded file SHALL have an image file extension and a name derived from that card's title, falling back to a default name when the card has no title

#### Scenario: Trip card export failure is handled gracefully
- **WHEN** the system is unable to generate the image for a trip card
- **THEN** the system SHALL inform the member that the export could not be completed rather than leaving the export action with no visible result
