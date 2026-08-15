## Purpose

Give each square on a trip card a marked state that the members entitled to play it can toggle, that every member of the trip can see, that is confined to the trip's own dates, and that travels with the card into printed and exported output — so a trip stops being a shelf of cards and becomes a game.

## ADDED Requirements

### Requirement: A player marks and unmarks individual squares on a trip card
The system SHALL let a member who is entitled to play a trip card mark any of its squares, and unmark any square they or another entitled player has marked. Marking SHALL operate on one square at a time; the system SHALL NOT provide a bulk mark or a bulk clear. A square SHALL carry only two states, marked and unmarked, and marking an already-marked square SHALL leave it marked rather than failing.

#### Scenario: Player marks a square
- **WHEN** a member entitled to play a trip card marks one of its squares
- **THEN** the system SHALL record that square as marked and SHALL reflect it on the card

#### Scenario: Player unmarks a square
- **WHEN** a member entitled to play a trip card unmarks a square that is currently marked
- **THEN** the system SHALL record that square as unmarked and SHALL reflect it on the card

#### Scenario: Marking is idempotent
- **WHEN** a player marks a square that is already marked
- **THEN** the square SHALL remain marked and the system SHALL NOT report an error

#### Scenario: Unmarking a square that is not marked
- **WHEN** a player unmarks a square that is not currently marked
- **THEN** the square SHALL remain unmarked and the system SHALL NOT report an error

#### Scenario: A card with nothing marked
- **WHEN** a card has been added to a trip and no square has been marked
- **THEN** the system SHALL treat the card as having no marked squares, indistinguishably from a card whose every mark has been removed

### Requirement: Only the assigned member may mark a card in a competitive trip
In a competitive trip, the system SHALL let only the member a trip card is assigned to modify that card's marks. A trip card that has not been assigned SHALL be modifiable by nobody. The trip administrator SHALL NOT be entitled to modify a card assigned to another member by virtue of their administrator role; administering a trip is not playing its cards.

#### Scenario: Assigned member marks their own card
- **WHEN** the member a competitive trip card is assigned to marks one of its squares
- **THEN** the system SHALL record the mark

#### Scenario: Another member attempts to mark an assigned card
- **WHEN** a member of the trip who is not the assignee attempts to modify the marks on an assigned competitive trip card
- **THEN** the system SHALL refuse and SHALL NOT change any mark

#### Scenario: Administrator attempts to mark another member's card
- **WHEN** the trip administrator, who is not the assignee, attempts to modify the marks on an assigned competitive trip card
- **THEN** the system SHALL refuse and SHALL NOT change any mark

#### Scenario: Unassigned competitive card is playable by nobody
- **WHEN** any member, including the administrator, attempts to modify the marks on a competitive trip card that has not been assigned
- **THEN** the system SHALL refuse and SHALL NOT change any mark

#### Scenario: Reassignment transfers who may mark
- **WHEN** the administrator reassigns a trip card from one member to another
- **THEN** the new assignee SHALL be able to modify its marks and the previous assignee SHALL NOT

### Requirement: Any member may mark any card in a cooperative trip
In a cooperative trip, where every member plays every card, the system SHALL let any member of the trip modify the marks on any of its trip cards. A cooperative trip card SHALL carry one shared set of marks that every member sees and contributes to; the system SHALL NOT keep a separate set of marks per member.

#### Scenario: Member marks a card they did not add
- **WHEN** a member of a cooperative trip marks a square on a trip card added by a different member
- **THEN** the system SHALL record the mark

#### Scenario: Progress is shared, not per member
- **WHEN** one member of a cooperative trip marks a square and another member views the same card
- **THEN** the second member SHALL see that square marked, on the same card rather than on a copy of their own

#### Scenario: A member can unmark another member's mark
- **WHEN** a member of a cooperative trip unmarks a square that a different member marked
- **THEN** the system SHALL record the square as unmarked

### Requirement: A non-member cannot read or modify a trip card's progress
The system SHALL make a trip card's marks readable and modifiable only by users holding a current membership in the trip that card belongs to. A request from any other user — including a signed-out visitor and a formerly-removed member — SHALL be indistinguishable from a request for a trip that does not exist, whether or not the trip card it names is real.

Within a trip the caller is a member of, the system MAY distinguish a trip card that does not exist from one the caller is not entitled to play. Nothing leaks by doing so: every member is already shown the full list of that trip's cards, so the caller can enumerate the same identifiers directly. The indistinguishability rule that matters is the one at the membership boundary, above.

#### Scenario: Non-member attempts to read progress
- **WHEN** a signed-in user who holds no membership in a trip requests that trip's progress
- **THEN** the system SHALL respond exactly as it would for a non-existent trip

#### Scenario: Removed member attempts to mark
- **WHEN** a user who has been removed from a trip attempts to modify the marks on one of its cards
- **THEN** the system SHALL respond exactly as it would for a non-existent trip

#### Scenario: Signed-out visitor attempts to read progress
- **WHEN** a signed-out visitor attempts to read any trip card's progress
- **THEN** the system SHALL refuse without revealing whether the trip exists

#### Scenario: A trip card in someone else's trip reveals nothing about itself
- **WHEN** a signed-in user who holds no membership in a trip attempts to modify the marks on one of its trip cards
- **THEN** the system SHALL respond exactly as it would for a trip card identifier that does not exist, revealing nothing about which case applies

### Requirement: Every member can see every trip card's progress
The system SHALL show each trip card's marks to every member of the trip, regardless of the trip's mode and regardless of which member may modify them. Entitlement to play SHALL determine only who may change a card's marks, never who may see them.

#### Scenario: Member sees progress on a card assigned to someone else
- **WHEN** a member of a competitive trip views a trip card assigned to another member
- **THEN** they SHALL see that card's marked squares

#### Scenario: Progress accompanies the trip
- **WHEN** a member opens a trip
- **THEN** the system SHALL present each trip card's marks alongside the card itself

### Requirement: A member watching a trip sees others' progress without reloading
While a member has a trip open, the system SHALL refresh the trip's progress on its own so that marks made by other members appear without the member reloading the page or taking any action. The system SHALL stop refreshing when the trip is no longer being viewed, so that a page left open in the background does not keep requesting indefinitely. A member's own mark SHALL be reflected immediately rather than waiting for the next refresh.

#### Scenario: Another member's mark appears
- **WHEN** a member has a trip open and another member marks a square on one of its cards
- **THEN** the first member SHALL see that square become marked without reloading the page

#### Scenario: Refreshing stops when the trip is not being viewed
- **WHEN** the member navigates away from the trip, or the page carrying it stops being visible
- **THEN** the system SHALL stop refreshing that trip's progress

#### Scenario: A player's own mark is immediate
- **WHEN** a player marks a square
- **THEN** the card SHALL show the square as marked immediately, without waiting for the next refresh

#### Scenario: A rejected mark does not persist on screen
- **WHEN** a player's mark is refused by the system
- **THEN** the card SHALL return to showing the square's true state and the player SHALL be told the mark did not take effect

### Requirement: Progress cannot be modified outside the trip's date range
When a trip carries a start date, an end date, or both, the system SHALL refuse to modify any of its cards' marks outside the resulting window. The window SHALL be evaluated so that no member is excluded on a date the trip covers merely because of the time zone they are in. A trip carrying no dates SHALL always be open for play. A trip carrying only a start date SHALL have no closing bound, and a trip carrying only an end date SHALL have no opening bound. This restriction SHALL be enforced by the system rather than relying on the interface, and SHALL NOT depend on any date or time reported by the requesting client. Reading progress SHALL remain possible at all times, including before the trip starts and after it ends.

#### Scenario: Marking before the trip starts
- **WHEN** a member entitled to play attempts to mark a square before the trip's start date has been reached anywhere
- **THEN** the system SHALL refuse and SHALL NOT change any mark

#### Scenario: Marking after the trip ends
- **WHEN** a member entitled to play attempts to mark a square after the trip's end date has passed everywhere
- **THEN** the system SHALL refuse and SHALL NOT change any mark

#### Scenario: Marking on the first day of the trip from any time zone
- **WHEN** a member whose local calendar date is the trip's start date marks a square
- **THEN** the system SHALL accept the mark regardless of the member's offset from UTC

#### Scenario: Trip with no dates is always open
- **WHEN** a member entitled to play marks a square on a card in a trip that carries neither a start date nor an end date
- **THEN** the system SHALL accept the mark

#### Scenario: Only one bound is set
- **WHEN** a trip carries a start date but no end date
- **THEN** the system SHALL accept marks at any time from that start date onward

#### Scenario: The interface explains the closed window
- **WHEN** a member entitled to play opens a trip whose dates place it outside the play window
- **THEN** the interface SHALL present the card as not currently markable and SHALL explain that the trip's dates are the reason

#### Scenario: A client asserting a different date does not widen the window
- **WHEN** a request to modify a mark arrives carrying or implying a date within the window while the system's own clock places it outside
- **THEN** the system SHALL refuse the mark

#### Scenario: Progress remains readable outside the window
- **WHEN** a member views a trip whose end date has passed
- **THEN** the system SHALL still present every card's marks

### Requirement: Only a card's own real squares can be marked
The system SHALL accept a mark only for a position that exists on the card and holds an entry. A position outside the card's grid SHALL be rejected. A position that is blank — present on the grid but holding no entry, as happens when a card was built from fewer entries than the grid has cells — SHALL NOT be markable, because a blank is the absence of a square rather than an unclaimed one. A rejected position SHALL leave every existing mark unchanged.

#### Scenario: Position outside the grid
- **WHEN** a mark is requested for a position beyond the card's last square, or for a position that is not a whole number at or above zero
- **THEN** the system SHALL reject it and SHALL leave the card's existing marks unchanged

#### Scenario: Blank square is not markable
- **WHEN** a mark is requested for a position on the card that holds no entry
- **THEN** the system SHALL reject it and SHALL leave the card's existing marks unchanged

#### Scenario: Blank squares are not interactive
- **WHEN** a player views a card that contains blank positions
- **THEN** those positions SHALL NOT offer a marking affordance

#### Scenario: The free space is an ordinary square
- **WHEN** a card carrying a free space is added to a trip and play begins
- **THEN** the free space SHALL start unmarked and SHALL be markable and unmarkable exactly like any other square

### Requirement: A marked square is shown by a translucent mark that leaves the square readable
The system SHALL indicate a marked square by drawing a translucent X over it rather than by replacing, hiding, or obscuring its contents, so that the square's entry text remains readable through the mark. The mark SHALL be part of the card itself, so that it appears identically wherever the card is rendered — on screen, in printed output, and in exported images. An unmarked card SHALL render exactly as it renders today, with no trace of the marking layer.

#### Scenario: A marked square stays readable
- **WHEN** a square carrying entry text is marked
- **THEN** the system SHALL draw a translucent X over the square and the entry text SHALL remain readable through it

#### Scenario: The mark appears in printed output
- **WHEN** a card carrying marks is printed
- **THEN** the printed card SHALL show the marks in the same positions as on screen

#### Scenario: The mark appears in an exported image
- **WHEN** a card carrying marks is exported as an image
- **THEN** the exported image SHALL show the marks in the same positions as on screen

#### Scenario: An unmarked card is unchanged
- **WHEN** a card with no marked squares is rendered, printed, or exported
- **THEN** its output SHALL be equivalent to the output the same card produced before marking existed

### Requirement: Progress belongs to the trip card and survives changes around it
A trip card's marks SHALL belong to that trip card and SHALL be unaffected by changes to anything the card was derived from or assigned to. Reassigning a trip card SHALL NOT clear its marks. Removing a member SHALL NOT clear the marks on cards that were assigned to them. Editing or deleting the original card the snapshot was taken from SHALL NOT change its marks. Removing a trip card from the trip SHALL remove its marks with it, and deleting the trip SHALL remove every card's marks along with the trip.

#### Scenario: Reassignment preserves progress
- **WHEN** the administrator reassigns a trip card that already carries marks
- **THEN** those marks SHALL remain on the card

#### Scenario: Removing a member preserves progress on their cards
- **WHEN** the administrator removes a member who was the assignee of trip cards carrying marks
- **THEN** those cards and their marks SHALL remain in the trip

#### Scenario: Editing the original card does not change progress
- **WHEN** the owner edits or deletes the original card a trip card was snapshotted from
- **THEN** the trip card's marks SHALL be unchanged

#### Scenario: Removing a trip card removes its progress
- **WHEN** the administrator removes a trip card from the trip
- **THEN** its marks SHALL be removed with it and SHALL NOT reappear if an equivalent card is added again

#### Scenario: Deleting the trip removes all progress
- **WHEN** the administrator deletes the trip
- **THEN** every trip card's marks SHALL be removed along with the trip

### Requirement: Concurrent marks by different members are all preserved
The system SHALL apply each mark and unmark as an independent change to a single square, so that two members acting at the same time on the same trip card cannot discard each other's change. A member's mark of one square SHALL NOT be lost because another member marked a different square at the same moment.

#### Scenario: Two members mark different squares at once
- **WHEN** two members of a cooperative trip mark two different squares on the same trip card at the same time
- **THEN** both squares SHALL end up marked

#### Scenario: Two members mark the same square at once
- **WHEN** two members mark the same square on the same trip card at the same time
- **THEN** the square SHALL be marked and neither request SHALL fail

### Requirement: Play is an account-only feature that leaves the signed-out experience unchanged
The system SHALL make marking available only to signed-in members of a trip. The system SHALL NOT display any marking affordance to a signed-out visitor, and SHALL NOT issue any request on their behalf. The signed-out card editor — building, editing, randomizing, rendering, printing, and exporting — SHALL remain fully functional and SHALL gain no play state; a card in a user's library outside a trip SHALL carry no marks.

#### Scenario: Signed-out visitor sees no play affordance and makes no requests
- **WHEN** a signed-out visitor loads the application
- **THEN** the system SHALL show no marking affordance, SHALL issue no API request, and the editor SHALL remain fully functional

#### Scenario: A library card carries no progress
- **WHEN** a signed-in user opens a saved card from their library that has also been added to a trip
- **THEN** the card in the editor SHALL show no marks, because progress belongs to the trip card rather than to the saved card
