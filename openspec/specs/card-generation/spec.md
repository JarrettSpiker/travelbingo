# card-generation Specification

## Purpose

Build a single live bingo card from the current entry pool on a 5x5 grid, with on-demand randomization and guaranteed inclusion of mandatory entries when the pool exceeds grid capacity.

## Requirements

### Requirement: Live single card from the entry pool
The system SHALL render a single bingo card that reflects the current entry pool at all times, with no minimum number of entries required before a card is shown.

#### Scenario: Card updates as an entry is added
- **WHEN** the user adds an entry to the pool
- **THEN** the card SHALL update to include that entry, without any explicit generate action

#### Scenario: Card updates as an entry is edited or removed
- **WHEN** the user edits or removes an entry in the pool
- **THEN** the card SHALL update to reflect the change

### Requirement: Blank cells for an unfilled grid
The system SHALL fill the card's entry slots with entries from the pool and leave any remaining slots blank when the pool has fewer entries than the card's capacity, rather than blocking display of the card. Capacity is 24 entries when a free space is present and 25 entries when it is not.

#### Scenario: Fewer entries than capacity
- **WHEN** the entry pool has fewer entries than the card's capacity
- **THEN** the card SHALL display the available entries and leave the remaining entry slots blank

#### Scenario: No entries
- **WHEN** the entry pool is empty
- **THEN** the card SHALL display with all entry slots blank

### Requirement: Standard 5x5 grid with free center space
The system SHALL render a 5x5 grid. By default the center cell SHALL be a free space using the user-specified free space content (or the default "FREE" if none was specified). The user may turn the free space off; when it is off, all 25 cells hold entries or blanks and no cell is treated as a free space (see the card-entry-input capability for the toggle control). The card's entry capacity is 24 cells when a free space is present and 25 cells when it is not, regardless of how many entries are in the pool.

#### Scenario: Free space present
- **WHEN** the card is displayed with the free space turned on
- **THEN** the center cell of the 5x5 grid SHALL display the specified (or default) free space content

#### Scenario: Free space turned off
- **WHEN** the user turns the free space off
- **THEN** the grid SHALL use all 25 cells as entry slots (no special center cell), giving the card a 25-entry capacity

### Requirement: Randomize card content
The system SHALL let the user trigger randomization of the card's arrangement at any time, repeatable without limit.

#### Scenario: User randomizes the card
- **WHEN** the user triggers randomization
- **THEN** the system SHALL produce a new random arrangement of entries (and blank cells, if the pool has fewer entries than the card's capacity) in the grid, replacing the current arrangement

#### Scenario: Randomizing with more entries than capacity
- **WHEN** the entry pool has more entries than the card's capacity and the user triggers randomization
- **THEN** the system SHALL select a random subset of entries equal to the card's capacity from the pool to display on the card

#### Scenario: Editing the pool after randomizing
- **WHEN** the user adds, edits, or removes an entry after having randomized the card
- **THEN** the card SHALL return to reflecting the live entry pool (insertion order with trailing blanks), rather than keeping the stale randomized arrangement

### Requirement: Guaranteed inclusion of mandatory entries when the pool exceeds capacity
The system SHALL include every mandatory entry on the card whenever the pool has more entries than the card's capacity, filling any remaining entry slots from the rest of the pool. Mandatory status SHALL NOT change which entries appear when the pool already fits within capacity.

#### Scenario: Mandatory entries included over non-mandatory ones
- **WHEN** the pool has more entries than capacity and at least one is marked mandatory
- **THEN** the card SHALL include all mandatory entries (up to capacity) before filling any remaining slots with non-mandatory entries

#### Scenario: Mandatory entries guaranteed on randomize too
- **WHEN** the user triggers randomization with a pool that exceeds capacity, some entries marked mandatory
- **THEN** the resulting card SHALL still include all mandatory entries (up to capacity), with only the remaining slots and positions randomized

#### Scenario: Mandatory status has no effect within capacity
- **WHEN** the pool fits within the card's capacity, regardless of how many are marked mandatory
- **THEN** every entry SHALL appear on the card exactly as it would if none were marked mandatory

#### Scenario: More entries are mandatory than capacity allows
- **WHEN** more entries in the pool are marked mandatory than the card's capacity
- **THEN** the system SHALL display as many of the mandatory entries as fit (up to capacity) and SHALL NOT error or fail to display a card
