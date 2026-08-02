# card-entry-input Specification

## Purpose

Capture and manage the user's pool of text entries (including marking entries as mandatory), plus the card title and free-space content that feed card generation.

## Requirements

### Requirement: Manage a pool of text entries
The system SHALL let a user add, edit, and remove individual text entries (words or phrases) that make up the pool used to build the bingo card. There is no minimum or maximum number of entries required.

#### Scenario: Add an entry
- **WHEN** the user submits a new non-empty text entry
- **THEN** the entry is added to the pool and displayed in the current entry list

#### Scenario: Edit an entry
- **WHEN** the user edits an existing entry's text to a new non-empty value that doesn't duplicate another entry in the pool
- **THEN** the entry's text is updated in place and the updated text is used on the card

#### Scenario: Edit to a duplicate value
- **WHEN** the user edits an entry's text to a value that matches another existing entry (ignoring case and surrounding whitespace)
- **THEN** the system SHALL reject the edit and display a message that the entry already exists, leaving the original text unchanged

#### Scenario: Remove an entry
- **WHEN** the user removes an entry from the pool
- **THEN** the entry is no longer displayed and is excluded from the card

### Requirement: Disable an entry without deleting it
The system SHALL let the user disable an individual entry without deleting it. New entries SHALL be enabled by default. Disabled entries SHALL remain in the pool but SHALL NOT appear on the generated card (see the card-generation capability). Disabling an entry SHALL NOT remove it: re-enabling it SHALL restore the entry with its text and mandatory flag unchanged.

#### Scenario: New entry is enabled by default
- **WHEN** the user adds a new entry
- **THEN** the entry SHALL be enabled

#### Scenario: User disables an entry
- **WHEN** the user disables an entry
- **THEN** the entry SHALL remain in the entry list but SHALL NOT appear on the generated card

#### Scenario: User re-enables a disabled entry
- **WHEN** the user re-enables a disabled entry
- **THEN** the entry SHALL become eligible for the card again, with its text and mandatory flag unchanged

### Requirement: Mark an entry as mandatory
The system SHALL let the user mark or unmark an individual entry as mandatory. Mandatory entries are guaranteed to appear on the card whenever the pool exceeds the grid's capacity (see the card-generation capability for selection behavior). A disabled entry is not eligible for the card regardless of its mandatory flag (see the "Disable an entry without deleting it" requirement), and only enabled mandatory entries are counted toward the grid's capacity for the warning below.

#### Scenario: Mark an entry mandatory
- **WHEN** the user marks an entry as mandatory
- **THEN** the system SHALL record that entry as mandatory and reflect the marked state in the entry list

#### Scenario: Unmark a mandatory entry
- **WHEN** the user unmarks a previously-mandatory entry
- **THEN** the system SHALL treat it as an ordinary (non-mandatory) entry going forward

#### Scenario: Mandatory entries exceed grid capacity
- **WHEN** more enabled entries are marked mandatory than the grid's capacity
- **THEN** the system SHALL display a warning that not all mandatory entries can appear on the card

### Requirement: Duplicate entry rejection
The system SHALL prevent the same text entry (case-insensitive, trimmed) from being added to the pool more than once. A disabled entry still occupies the pool for this purpose.

#### Scenario: Duplicate text submitted
- **WHEN** the user submits an entry whose text matches an existing entry in the pool (ignoring case and surrounding whitespace)
- **THEN** the system SHALL reject the addition and display a message that the entry already exists

#### Scenario: Disabled entry still blocks duplicates
- **WHEN** the user submits an entry whose text matches a disabled entry in the pool (ignoring case and surrounding whitespace)
- **THEN** the system SHALL reject the addition and display a message that the entry already exists

### Requirement: Card title input
The system SHALL let the user provide a title for the card, which is used as the printed heading.

#### Scenario: Title provided
- **WHEN** the user enters a title
- **THEN** the title is used as the heading on the card and on the printable version

#### Scenario: Title left blank
- **WHEN** the user has not entered a title
- **THEN** the card SHALL display with no heading

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
