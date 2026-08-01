## ADDED Requirements

### Requirement: Live single card from the entry pool
The system SHALL render a single bingo card that reflects the current entry pool at all times, with no minimum number of entries required before a card is shown.

#### Scenario: Card updates as an entry is added
- **WHEN** the user adds an entry to the pool
- **THEN** the card SHALL update to include that entry, without any explicit generate action

#### Scenario: Card updates as an entry is edited or removed
- **WHEN** the user edits or removes an entry in the pool
- **THEN** the card SHALL update to reflect the change

### Requirement: Blank cells for an unfilled grid
The system SHALL fill the 24 non-free cells with entries from the pool and leave any remaining cells blank when the pool has fewer than 24 entries, rather than blocking display of the card.

#### Scenario: Fewer than 24 entries
- **WHEN** the entry pool has fewer than 24 entries
- **THEN** the card SHALL display the available entries and leave the remaining non-free cells blank

#### Scenario: No entries
- **WHEN** the entry pool is empty
- **THEN** the card SHALL display with all non-free cells blank

### Requirement: Standard 5x5 grid with free center space
The system SHALL place a free space in the center cell of the card, using the user-specified free space content (or the default "FREE" if none was specified), regardless of how many entries are in the pool.

#### Scenario: Free space present
- **WHEN** the card is displayed
- **THEN** the center cell of the 5x5 grid SHALL display the specified (or default) free space content

### Requirement: Randomize card content
The system SHALL let the user trigger randomization of the card's arrangement at any time, repeatable without limit.

#### Scenario: User randomizes the card
- **WHEN** the user triggers randomization
- **THEN** the system SHALL produce a new random arrangement of entries (and blank cells, if the pool has fewer than 24 entries) in the grid, replacing the current arrangement

#### Scenario: Randomizing with more than 24 entries
- **WHEN** the entry pool has more than 24 entries and the user triggers randomization
- **THEN** the system SHALL select a random subset of 24 entries from the pool to display on the card

#### Scenario: Editing the pool after randomizing
- **WHEN** the user adds, edits, or removes an entry after having randomized the card
- **THEN** the card SHALL return to reflecting the live entry pool (insertion order with trailing blanks), rather than keeping the stale randomized arrangement

### Requirement: Guaranteed inclusion of mandatory entries when the pool exceeds capacity
The system SHALL include every mandatory entry on the card whenever the pool has more than 24 entries, filling any remaining non-free cells from the rest of the pool. Mandatory status SHALL NOT change which entries appear when the pool already fits within 24 entries.

#### Scenario: Mandatory entries included over non-mandatory ones
- **WHEN** the pool has more than 24 entries and at least one is marked mandatory
- **THEN** the card SHALL include all mandatory entries (up to grid capacity) before filling any remaining slots with non-mandatory entries

#### Scenario: Mandatory entries guaranteed on randomize too
- **WHEN** the user triggers randomization with a pool of more than 24 entries, some marked mandatory
- **THEN** the resulting card SHALL still include all mandatory entries (up to grid capacity), with only the remaining slots and positions randomized

#### Scenario: Mandatory status has no effect within capacity
- **WHEN** the pool has 24 or fewer entries, regardless of how many are marked mandatory
- **THEN** every entry SHALL appear on the card exactly as it would if none were marked mandatory

#### Scenario: More than 24 entries are mandatory
- **WHEN** more than 24 entries in the pool are marked mandatory
- **THEN** the system SHALL display as many of the mandatory entries as fit (24) and SHALL NOT error or fail to display a card
