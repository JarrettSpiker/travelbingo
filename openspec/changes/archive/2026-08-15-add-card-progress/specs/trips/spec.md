## MODIFIED Requirements

### Requirement: In a competitive trip the administrator assigns cards to members
In a competitive trip, a trip card that has just been added SHALL be unassigned until the administrator assigns it to a member. The administrator SHALL be able to assign and reassign trip cards among the trip's members. Assigning a card to a user who is not a member SHALL be rejected. In a cooperative trip, assignment SHALL NOT apply: every member plays every card. Only the administrator SHALL be able to assign or reassign cards. Assignment SHALL determine which member may record progress on a card: in a competitive trip only the assignee may do so and an unassigned card is playable by nobody, while in a cooperative trip every member may record progress on every card. Assignment SHALL NOT give the administrator the right to record progress on a card assigned to another member.

#### Scenario: A newly added card is unassigned
- **WHEN** a member adds a card to a competitive trip
- **THEN** the trip card SHALL be unassigned until the administrator assigns it

#### Scenario: Administrator assigns a card
- **WHEN** the administrator assigns an unassigned trip card to a member
- **THEN** that card SHALL be recorded as assigned to that member

#### Scenario: Administrator reassigns a card
- **WHEN** the administrator reassigns a trip card from one member to another
- **THEN** the card SHALL be recorded as assigned to the new member

#### Scenario: Assigning to a non-member is rejected
- **WHEN** the administrator attempts to assign a trip card to a user who is not a member of the trip
- **THEN** the system SHALL reject it

#### Scenario: Non-administrator cannot assign
- **WHEN** a member attempts to assign or reassign a trip card
- **THEN** the system SHALL refuse

#### Scenario: Cooperative trips have no assignment
- **WHEN** a card is added to a cooperative trip
- **THEN** assignment SHALL NOT apply, and every member SHALL play every card

#### Scenario: Assignment decides who may record progress
- **WHEN** a trip card in a competitive trip is assigned to a member
- **THEN** only that member SHALL be able to record progress on it, and every other member — including the administrator — SHALL be refused

#### Scenario: An unassigned competitive card cannot be played
- **WHEN** any member of a competitive trip attempts to record progress on a trip card that has not been assigned
- **THEN** the system SHALL refuse

### Requirement: All members can see all cards in a trip
The system SHALL let every member see every trip card in the trip, regardless of mode and regardless of any competitive assignment. Assignment SHALL determine only who plays a card, not who can see it. A trip card's recorded progress SHALL be visible to every member on the same terms as the card itself: every member SHALL see the progress on every card, including cards assigned to other members and cards they are not entitled to modify.

#### Scenario: Member sees cards assigned to others
- **WHEN** a non-administrator member views a competitive trip
- **THEN** they SHALL be able to see every trip card, including cards assigned to other members and cards that are unassigned

#### Scenario: Member sees progress on cards assigned to others
- **WHEN** a non-administrator member views a competitive trip in which cards assigned to other members carry progress
- **THEN** they SHALL be able to see that progress, even though they SHALL NOT be able to modify it
