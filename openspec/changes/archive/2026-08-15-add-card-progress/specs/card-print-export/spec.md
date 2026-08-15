## ADDED Requirements

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
