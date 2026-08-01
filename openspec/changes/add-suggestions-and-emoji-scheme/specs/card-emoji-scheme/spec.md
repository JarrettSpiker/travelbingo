## Purpose

Let the user choose a small set of emojis that decorate the card's edge/border, rendered deterministically around the grid's perimeter on screen and in print, and carried through the share URL like the color and font schemes.

## ADDED Requirements

### Requirement: Choose edge/border emojis
The system SHALL let the user choose between 1 and 5 emojis to decorate the card. The chosen emojis SHALL be rendered around the card's edge/border — the perimeter surrounding the grid. The user SHALL be able to change or clear the chosen emojis at any time. When the user has chosen no emojis, no emoji decoration SHALL appear.

#### Scenario: User chooses emojis
- **WHEN** the user enters one or more emojis (up to 5)
- **THEN** the card SHALL render those emojis around its edge/border

#### Scenario: User clears the emojis
- **WHEN** the user removes all chosen emojis
- **THEN** the card SHALL render with no emoji decoration

#### Scenario: More than five emojis entered
- **WHEN** the user enters more than 5 emojis
- **THEN** the system SHALL keep only the first 5 and SHALL render only those around the card's edge/border

#### Scenario: Default is no emojis
- **WHEN** the card is loaded and the user has not chosen any emojis
- **THEN** the card SHALL render with no emoji decoration

### Requirement: Deterministic emoji placement
The system SHALL position the chosen emojis around the card's edge/border deterministically, so that a given set of emojis always produces the same arrangement. The arrangement SHALL be reproduced identically when the card is re-rendered, re-randomized, or reopened from an exported URL.

#### Scenario: Stable arrangement across re-renders
- **WHEN** the same set of emojis is chosen and the card is rendered more than once (for example, after editing an unrelated entry)
- **THEN** the emoji arrangement around the edge/border SHALL be identical each time

#### Scenario: Identical arrangement after randomizing the card
- **WHEN** the user randomizes the entries of a card that has a chosen emoji set
- **THEN** the emoji arrangement around the edge/border SHALL remain unchanged

#### Scenario: Different emoji sets can produce different arrangements
- **WHEN** two cards have different chosen emoji sets
- **THEN** their edge/border arrangements MAY differ, each one determined only by its own emoji set

### Requirement: Emoji scheme applies to print
The system SHALL render the chosen edge/border emojis in the print layout, so a printed or save-as-PDF card shows the same emoji decoration as on screen.

#### Scenario: User prints a decorated card
- **WHEN** the user prints a card that has a chosen emoji set
- **THEN** the printed card SHALL show those emojis around the edge/border

### Requirement: Default emoji scheme
The system SHALL apply an empty emoji scheme (no emojis) when the user has not chosen any.

#### Scenario: No emoji customization made
- **WHEN** the user has not chosen any emojis
- **THEN** the card SHALL render with no emoji decoration
