## ADDED Requirements

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

## MODIFIED Requirements

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
