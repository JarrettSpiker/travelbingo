# trips Specification

## Purpose

Lets a signed-in user gather invited friends and frozen bingo-card snapshots under a shared trip — with a title, an optional date range, and a cooperative or competitive play mode — so a group can organize the cards for an event in one place, alongside (not replacing) the account-free editor.

## Requirements

### Requirement: A signed-in user can create a trip and becomes its administrator
The system SHALL let a signed-in user create a trip by providing a title, choosing a play mode (cooperative or competitive), and optionally a start date and end date. The creating user SHALL become the trip's administrator for the trip's lifetime. A signed-out user SHALL NOT be able to create a trip.

#### Scenario: User creates a trip
- **WHEN** a signed-in user creates a trip with a title, a mode, and no dates
- **THEN** the system SHALL create the trip with that user as its administrator and SHALL reflect the trip in the user's trips

#### Scenario: Trip with a date range
- **WHEN** a signed-in user creates a trip with a start date and an end date
- **THEN** the system SHALL store both dates with the trip

#### Scenario: Signed-out user attempts to create a trip
- **WHEN** a signed-out user attempts to create a trip
- **THEN** the system SHALL refuse and SHALL prompt them to sign in, and SHALL NOT create anything

### Requirement: A trip's title, dates, and play mode are validated
The system SHALL require a non-empty title within a bounded length. When dates are supplied, each SHALL be a well-formed calendar date and the end date SHALL NOT precede the start date. The play mode SHALL be one of the supported modes. A payload violating any of these SHALL be rejected in full rather than partially stored or silently corrected.

#### Scenario: Title is empty or too long
- **WHEN** a trip is created or edited with an empty title or a title exceeding the length bound
- **THEN** the system SHALL reject it and SHALL NOT store the trip

#### Scenario: End date precedes start date
- **WHEN** a trip is created or edited with an end date that precedes its start date
- **THEN** the system SHALL reject it

#### Scenario: Unsupported play mode
- **WHEN** a trip is created with a play mode other than cooperative or competitive
- **THEN** the system SHALL reject it

### Requirement: The trip administrator manages the trip
The trip administrator SHALL be able to change the trip's title and dates, and to delete the trip. The administrator SHALL NOT be removed from the trip while they remain its only administrator. Deleting a trip SHALL remove every record associated with it, including all members, trip cards, and outstanding invite links.

#### Scenario: Administrator edits the trip
- **WHEN** the administrator changes the trip's title or dates
- **THEN** the change SHALL be reflected to all members

#### Scenario: Non-administrator attempts to edit the trip
- **WHEN** a member attempts to change the trip's title, dates, or mode, or to delete the trip
- **THEN** the system SHALL refuse

#### Scenario: Administrator deletes the trip
- **WHEN** the administrator deletes a trip
- **THEN** the trip, all of its members, all of its trip cards, and all of its outstanding invite links SHALL be removed

### Requirement: Trip membership is granted by revocable invite links
The system SHALL let the trip administrator mint an invite identified by an opaque, unguessable token. A signed-in visitor who redeems a valid, unrevoked token SHALL join the trip as a member. A signed-out visitor SHALL be prompted to sign in, with the invite preserved through sign-in so they join on return. The administrator SHALL be able to revoke an invite at any time. Invite tokens SHALL carry sufficient entropy that they cannot feasibly be guessed or enumerated, and a token that is unknown, revoked, or belongs to a deleted trip SHALL produce identical responses, revealing nothing about which case applies. The administrator SHALL be able to see the outstanding invites for the trip.

#### Scenario: Administrator mints an invite
- **WHEN** the administrator mints an invite link
- **THEN** the system SHALL return a link containing an unguessable token for the administrator to share

#### Scenario: Signed-in visitor redeems an invite
- **WHEN** a signed-in visitor who is not already a member redeems a valid, unrevoked invite
- **THEN** the system SHALL add them to the trip as a member

#### Scenario: Signed-out visitor redeems an invite
- **WHEN** a signed-out visitor opens an invite link
- **THEN** the system SHALL prompt them to sign in, and after a successful sign-in SHALL redeem the invite and add them as a member without requiring them to re-open the link

#### Scenario: Member redeems their own trip's invite
- **WHEN** a user who is already a member redeems the trip's invite
- **THEN** the system SHALL leave their membership unchanged and SHALL NOT create a duplicate

#### Scenario: Administrator revokes an invite
- **WHEN** the administrator revokes an outstanding invite
- **THEN** a subsequent attempt to redeem it SHALL behave exactly as if the invite had never existed

#### Scenario: Unknown, revoked, and deleted are indistinguishable
- **WHEN** a visitor redeems a token that was never issued, was revoked, or belonged to a deleted trip
- **THEN** the system SHALL return the same response in every case, revealing nothing about which case applies

#### Scenario: Non-administrator attempts to mint or revoke
- **WHEN** a member attempts to mint an invite or revoke one
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist

### Requirement: The trip administrator can remove members
The system SHALL let the trip administrator remove a member from the trip. A removed member SHALL immediately lose access to the trip and to all of its trip cards. Removing a member SHALL NOT delete trip cards that member had added to the trip. The administrator SHALL NOT remove themselves if doing so would leave the trip without an administrator.

#### Scenario: Administrator removes a member
- **WHEN** the administrator removes a member
- **THEN** that user SHALL no longer be able to view the trip or its cards

#### Scenario: Removed member's added cards remain
- **WHEN** the administrator removes a member who had added cards to the trip
- **THEN** those trip cards SHALL remain in the trip

#### Scenario: Administrator cannot strand the trip
- **WHEN** the administrator attempts to remove themselves while they are the only administrator
- **THEN** the system SHALL refuse

### Requirement: A signed-in user can list and open their trips
The system SHALL show a signed-in user every trip they currently hold a membership in, identified by title and reflecting any date range, and SHALL let them open one. The listing SHALL NOT include trips the user is not a member of, nor trips the user was removed from. Opening a trip SHALL present its members and its trip cards according to the visibility rules.

#### Scenario: User lists their trips
- **WHEN** a signed-in user opens their trips
- **THEN** the system SHALL list every trip they currently hold a membership in, and SHALL NOT list any trip belonging only to other users

#### Scenario: Removed member's trip no longer listed
- **WHEN** a user who was removed from a trip opens their trips
- **THEN** the system SHALL NOT list that trip

#### Scenario: User opens a trip
- **WHEN** a signed-in user opens a trip they are a member of
- **THEN** the system SHALL present the trip's members and trip cards

### Requirement: Any member can add a card to the trip as a frozen, render-only snapshot
The system SHALL let any member add a card they hold a membership for to the trip. The added trip card SHALL be a frozen snapshot containing only what is needed to render the card — the on-grid arrangement, the title, the free-space text and on/off state, and the color, font, and emoji schemes — and SHALL NOT include the editable entry pool. The system SHALL NOT provide a way to edit a trip card once added; an updated card is produced by removing and re-adding. The snapshot SHALL be fully decoupled from the original card: editing or deleting the original, or removing the original's owner from the trip, SHALL NOT change or remove the trip card. Removing a trip card SHALL NOT affect the original card or the owner's library.

#### Scenario: Member adds a card they own
- **WHEN** a member adds a card they hold a membership for to the trip
- **THEN** the system SHALL store a frozen snapshot of that card in the trip

#### Scenario: Trip card excludes the editable pool
- **WHEN** a card is added to a trip
- **THEN** the stored trip card SHALL contain the on-grid arrangement and rendering schemes, and SHALL NOT contain the editable entry pool

#### Scenario: Editing the original card does not change the trip card
- **WHEN** the owner edits and re-saves the original card after it was added to a trip
- **THEN** the trip card SHALL remain exactly as it was when added

#### Scenario: Deleting the original card does not remove the trip card
- **WHEN** the owner deletes the original card after it was added to a trip
- **THEN** the trip card SHALL remain in the trip, unchanged

#### Scenario: Removing a trip card does not affect the original
- **WHEN** a trip card is removed from the trip
- **THEN** the original card and the owner's library SHALL be unaffected

#### Scenario: Member cannot add a card they do not own
- **WHEN** a member attempts to add a card they hold no membership for
- **THEN** the system SHALL respond exactly as it would for a card that does not exist

### Requirement: In a competitive trip the administrator assigns cards to members
In a competitive trip, a trip card that has just been added SHALL be unassigned until the administrator assigns it to a member. The administrator SHALL be able to assign and reassign trip cards among the trip's members. Assigning a card to a user who is not a member SHALL be rejected. In a cooperative trip, assignment SHALL NOT apply: every member plays every card. Only the administrator SHALL be able to assign or reassign cards.

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

### Requirement: All members can see all cards in a trip
The system SHALL let every member see every trip card in the trip, regardless of mode and regardless of any competitive assignment. Assignment SHALL determine only who plays a card, not who can see it.

#### Scenario: Member sees cards assigned to others
- **WHEN** a non-administrator member views a competitive trip
- **THEN** they SHALL be able to see every trip card, including cards assigned to other members and cards that are unassigned

### Requirement: Only the administrator can remove cards from a trip
The system SHALL let the administrator remove a trip card from the trip, and SHALL NOT let a non-administrator member remove one.

#### Scenario: Administrator removes a card
- **WHEN** the administrator removes a trip card
- **THEN** it SHALL no longer appear in the trip

#### Scenario: Member cannot remove a card
- **WHEN** a non-administrator member attempts to remove a trip card
- **THEN** the system SHALL refuse

### Requirement: Trips are private to their members
The system SHALL make a trip, its members, its trip cards, and its invites readable only by users holding a current membership in the trip. A request from any other user — including a signed-out visitor and a formerly-removed member — SHALL be indistinguishable from a request for a trip that does not exist.

#### Scenario: Non-member requests a trip
- **WHEN** a signed-in user requests a trip they hold no membership for
- **THEN** the system SHALL respond exactly as it would for a non-existent trip

#### Scenario: Signed-out visitor attempts to read trip data
- **WHEN** a signed-out visitor attempts to read any trip data
- **THEN** the system SHALL refuse without revealing whether the trip exists

#### Scenario: Trip invite does not leak trip contents
- **WHEN** a visitor who has not redeemed an invite attempts to read a trip's members or cards
- **THEN** the system SHALL refuse without revealing whether the trip exists

### Requirement: Trip resource usage is bounded
The system SHALL enforce an upper bound on the number of trips a single user may hold a membership in, on the number of members a single trip may have, and on the number of cards a single trip may hold. An operation that would exceed any of these bounds SHALL be rejected with a message explaining the limit.

#### Scenario: User reaches the trip limit
- **WHEN** a user's membership count would exceed the per-user trip limit
- **THEN** the system SHALL refuse and SHALL explain the limit

#### Scenario: Trip reaches the member limit
- **WHEN** redeeming an invite would exceed the per-trip member limit
- **THEN** the system SHALL refuse and SHALL explain the limit

#### Scenario: Trip reaches the card limit
- **WHEN** adding a card would exceed the per-trip card limit
- **THEN** the system SHALL refuse and SHALL explain the limit

### Requirement: Trips are an account-only feature that leaves the signed-out experience unchanged
The system SHALL make trips available only to signed-in users. The system SHALL NOT display any trip UI to a signed-out visitor, and SHALL NOT issue any request to the account backend on behalf of a signed-out visitor. The signed-out card editor — building, editing, randomizing, rendering, printing, and exporting — SHALL remain fully functional and unaffected by trips.

#### Scenario: Signed-out visitor sees no trip UI and makes no requests
- **WHEN** a signed-out visitor loads the application
- **THEN** the system SHALL NOT show any trip entry point, SHALL NOT issue any trip (or any) API request, and the editor SHALL remain fully functional

#### Scenario: Account backend unavailable does not degrade the editor
- **WHEN** the account backend cannot be reached
- **THEN** all signed-out card capabilities SHALL continue to work, and the failure SHALL surface only when a signed-in user attempts a trip action
