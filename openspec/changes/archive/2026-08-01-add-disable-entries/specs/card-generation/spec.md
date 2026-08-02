## ADDED Requirements

### Requirement: Disabled entries are excluded from the card
The system SHALL exclude disabled entries from the generated card. Disabled entries SHALL NOT be selected for the live card or the randomized card, and SHALL NOT count toward the card's capacity or the pool's size when determining whether the pool fits within capacity.

#### Scenario: Disabled entry omitted from the live card
- **WHEN** the entry pool contains a disabled entry
- **THEN** the live card SHALL NOT display that entry

#### Scenario: Disabled entry omitted from the randomized card
- **WHEN** the user randomizes a card whose entry pool contains a disabled entry
- **THEN** the randomized card SHALL NOT display that entry

#### Scenario: Disabled entries do not count toward capacity
- **WHEN** the pool's enabled entries fit within the card's capacity, even though counting disabled entries too would exceed capacity
- **THEN** the card SHALL display every enabled entry

## MODIFIED Requirements

### Requirement: Guaranteed inclusion of mandatory entries when the pool exceeds capacity
The system SHALL include every enabled mandatory entry on the card whenever the pool has more enabled entries than the card's capacity, filling any remaining entry slots from the rest of the enabled pool. Mandatory status SHALL NOT change which entries appear when the pool's enabled entries already fit within capacity. Disabled entries are never included, even when marked mandatory.

#### Scenario: Mandatory entries included over non-mandatory ones
- **WHEN** the pool has more enabled entries than capacity and at least one enabled entry is marked mandatory
- **THEN** the card SHALL include all enabled mandatory entries (up to capacity) before filling any remaining slots with non-mandatory entries

#### Scenario: Mandatory entries guaranteed on randomize too
- **WHEN** the user triggers randomization with a pool whose enabled entries exceed capacity, some marked mandatory
- **THEN** the resulting card SHALL still include all enabled mandatory entries (up to capacity), with only the remaining slots and positions randomized

#### Scenario: Mandatory status has no effect within capacity
- **WHEN** the pool's enabled entries fit within the card's capacity, regardless of how many are marked mandatory
- **THEN** every enabled entry SHALL appear on the card exactly as it would if none were marked mandatory

#### Scenario: More entries are mandatory than capacity allows
- **WHEN** more enabled entries in the pool are marked mandatory than the card's capacity
- **THEN** the system SHALL display as many of the enabled mandatory entries as fit (up to capacity) and SHALL NOT error or fail to display a card

#### Scenario: Disabled mandatory entry is not guaranteed
- **WHEN** a mandatory entry is disabled
- **THEN** it SHALL NOT appear on the card despite being marked mandatory
