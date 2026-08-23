# win-conditions Specification

## Purpose

Give a trip a declared target to be played toward — a line, two lines, or a full card — define once what a line is, detect and permanently record the moment a card meets that target, and report how far a card still has to go, so that a trip has a finish and a near-miss can be talked about.

## Requirements

### Requirement: A trip declares the target it is played toward
The system SHALL let a trip carry exactly one win condition, chosen from a line, two lines, and a full card. The win condition SHALL be settable when the trip is created. A trip for which no win condition was stated SHALL be treated as a line, so that trips created before win conditions existed read as the single-line game the application has always implied. A value outside the supported set SHALL be rejected in full rather than partially stored or silently corrected.

#### Scenario: Trip is created with a win condition
- **WHEN** a signed-in user creates a trip and states a win condition of two lines
- **THEN** the system SHALL store that trip with a win condition of two lines

#### Scenario: Trip is created without a win condition
- **WHEN** a signed-in user creates a trip without stating a win condition
- **THEN** the system SHALL treat that trip's win condition as a line

#### Scenario: A trip that predates win conditions
- **WHEN** a member opens a trip that was created before win conditions existed
- **THEN** the system SHALL present its win condition as a line

#### Scenario: Unsupported win condition
- **WHEN** a trip is created or edited with a win condition outside the supported set
- **THEN** the system SHALL reject it and SHALL NOT change the trip

### Requirement: A line is any full row, any full column, or either diagonal
The system SHALL treat a line as complete when every square along it is marked. Every row, every column, and both diagonals SHALL count as lines. Two lines SHALL mean any two distinct complete lines; the two SHALL be permitted to intersect and share a marked square. A full card SHALL mean that every square on the card that can be marked has been marked.

#### Scenario: A complete row is a line
- **WHEN** every square in one row of a card is marked
- **THEN** the system SHALL treat that card as having one complete line

#### Scenario: A complete column is a line
- **WHEN** every square in one column of a card is marked
- **THEN** the system SHALL treat that card as having one complete line

#### Scenario: A complete diagonal is a line
- **WHEN** every square along one of the card's two diagonals is marked
- **THEN** the system SHALL treat that card as having one complete line

#### Scenario: Two crossing lines count as two
- **WHEN** one complete row and one complete column are marked on the same card, sharing the square where they cross
- **THEN** the system SHALL treat that card as having two complete lines

#### Scenario: A partial line is not a line
- **WHEN** every square but one along a row, column, or diagonal is marked
- **THEN** the system SHALL NOT treat that row, column, or diagonal as complete

### Requirement: The administrator can change the trip's win condition after creation
The system SHALL let the trip administrator change the trip's win condition at any point in the trip's life, including after play has begun. Changing it SHALL NOT alter any recorded marks and SHALL NOT withdraw any win that has already been recorded. A member who is not the administrator SHALL NOT be able to change it.

#### Scenario: Administrator changes the target mid-trip
- **WHEN** the administrator changes a trip's win condition after members have marked squares
- **THEN** the system SHALL store the new win condition and SHALL leave every recorded mark unchanged

#### Scenario: Tightening the target does not withdraw a recorded win
- **WHEN** the administrator changes a trip's win condition from a line to a full card after a card has already been recorded as won
- **THEN** that card SHALL remain recorded as won

#### Scenario: Non-administrator attempts to change the target
- **WHEN** a member who is not the administrator attempts to change the trip's win condition
- **THEN** the system SHALL refuse

#### Scenario: The new target applies to subsequent play
- **WHEN** the administrator changes the trip's win condition and a member then marks a square
- **THEN** the system SHALL evaluate that mark against the new win condition

### Requirement: A win is detected and recorded when a mark completes the trip's target
When a member marks a square and the resulting marks on that card meet the trip's win condition, the system SHALL record that the card was won, when it was won, and which member won it. The recorded winner SHALL be the member entitled to play the card — the assignee in a competitive trip, and in a cooperative trip the member who placed the completing mark. The system SHALL record only the first such achievement for a card; a later mark that also meets the condition SHALL leave the original record intact. Removing a mark SHALL NOT be evaluated for a win, since removing a mark cannot complete a target.

#### Scenario: A mark completes the target
- **WHEN** a member marks a square and the card's resulting marks meet the trip's win condition
- **THEN** the system SHALL record the card as won, with the time of the win and the winning member

#### Scenario: The assignee is the winner in a competitive trip
- **WHEN** the assignee of a competitive trip card places the mark that meets the win condition
- **THEN** the system SHALL record that assignee as the winner

#### Scenario: The member who completed it is the winner in a cooperative trip
- **WHEN** a member of a cooperative trip places the mark that meets the win condition on a shared card
- **THEN** the system SHALL record that member as the winner

#### Scenario: A subsequent mark does not overwrite the record
- **WHEN** a member marks a further square on a card that has already been recorded as won
- **THEN** the original record of when it was won and by whom SHALL be unchanged

#### Scenario: Removing a mark is not evaluated
- **WHEN** a member removes a mark from a card
- **THEN** the system SHALL NOT evaluate that card for a win

#### Scenario: A mark that does not complete the target records nothing
- **WHEN** a member marks a square and the card's resulting marks do not meet the trip's win condition
- **THEN** the system SHALL NOT record a win

### Requirement: A recorded win is permanent and play continues
A recorded win SHALL be a statement about what happened rather than a value derived from the card's current marks, and the system SHALL NOT withdraw it. Removing marks so that the card no longer meets the condition SHALL leave the recorded win in place. Winning SHALL NOT stop, lock, or restrict play: the winning card SHALL remain markable by whoever was entitled to mark it, and every other card in the trip SHALL remain playable. More than one card in a trip SHALL be able to be recorded as won.

#### Scenario: Unmarking after a win
- **WHEN** a member removes a mark from a card that has been recorded as won, leaving it short of the win condition
- **THEN** the card SHALL remain recorded as won and the system SHALL present both the recorded win and the card's current marks truthfully

#### Scenario: The winning card stays playable
- **WHEN** a card has been recorded as won
- **THEN** the member entitled to mark it SHALL still be able to mark and unmark its squares

#### Scenario: Other members keep playing
- **WHEN** one card in a trip has been recorded as won
- **THEN** every other card in the trip SHALL remain playable on exactly the same terms as before

#### Scenario: A trip can have several winners
- **WHEN** a second card in the same trip meets the win condition after the first
- **THEN** the system SHALL record that win too, alongside the first

### Requirement: Every member can see which cards have been won and by whom
The system SHALL show each recorded win — the card, the winning member, and when it happened — to every member of the trip, on the same terms as the cards themselves. A member SHALL be told when a card they are entitled to play has been recorded as won.

#### Scenario: Member sees another member's win
- **WHEN** a member views a trip in which another member's card has been recorded as won
- **THEN** they SHALL see that the card was won, by whom, and when

#### Scenario: A player is told they have won
- **WHEN** a member places the mark that meets the win condition on a card they are playing
- **THEN** the system SHALL tell them they have won

#### Scenario: Non-members see nothing
- **WHEN** a user who holds no membership in a trip attempts to read its recorded wins
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist

### Requirement: The distance from a card to the trip's target is reported
The system SHALL report how many further squares a card needs before it meets the trip's win condition, computed from the card's current marks and the trip's target. A card that already meets the target SHALL report a distance of nothing further. A card that cannot meet the target at all SHALL be reported as unreachable rather than as some finite distance. This distance SHALL be available wherever a card and its marks are, so that it can be shown to a player and used to describe how close a member is.

#### Scenario: Distance on a partially marked card
- **WHEN** a card in a single-line trip has four of the five squares of one row marked and fewer marked elsewhere
- **THEN** the system SHALL report that card as one square from meeting the target

#### Scenario: Distance on a card that already meets the target
- **WHEN** a card meets the trip's win condition
- **THEN** the system SHALL report it as needing no further squares

#### Scenario: Distance takes the cheapest route
- **WHEN** a card is three squares from completing one line and one square from completing another
- **THEN** the system SHALL report it as one square from meeting a single-line target

#### Scenario: Distance reflects a changed target
- **WHEN** the administrator changes the trip's win condition from a line to two lines
- **THEN** the reported distance for each card SHALL be recomputed against two lines

### Requirement: A target that cannot be reached is stated rather than hidden
Squares that hold no entry cannot be marked, so a line containing one can never be completed and a full card containing one can never be completed. The system SHALL report such a target as unreachable for that card, and SHALL warn the administrator when the trip's win condition cannot be reached by a card in the trip. The system SHALL NOT make an unreachable target reachable by treating an empty square as marked, and SHALL NOT refuse a target merely because a current card cannot reach it, since further cards may still be added.

#### Scenario: A line through an empty square
- **WHEN** a card carries an empty square in every one of its rows, columns, and diagonals, in a single-line trip
- **THEN** the system SHALL report the trip's target as unreachable for that card

#### Scenario: A full card containing an empty square
- **WHEN** a card carries at least one empty square, in a full-card trip
- **THEN** the system SHALL report the trip's target as unreachable for that card

#### Scenario: Administrator is warned when setting an unreachable target
- **WHEN** the administrator sets a win condition that a card already in the trip cannot reach
- **THEN** the system SHALL warn them, naming the situation, and SHALL still apply the win condition they chose

#### Scenario: A card that cannot reach the target is flagged in the trip
- **WHEN** a member views a trip containing a card that cannot reach the trip's win condition
- **THEN** the system SHALL indicate that the card cannot reach the target

#### Scenario: Empty squares are never treated as marked
- **WHEN** the system evaluates a card containing empty squares against any win condition
- **THEN** it SHALL treat those squares as unmarked and unmarkable, and SHALL NOT count them toward any line or toward a full card
