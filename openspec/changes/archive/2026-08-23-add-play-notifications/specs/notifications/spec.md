## Purpose

Turn the things that happen during play — a square marked, a card coming within one square of the trip's target, a card won — into events that reach the people who care, through a per-trip activity feed that shows everything and a per-user notification list that is quiet by default and under the user's control.

## ADDED Requirements

### Requirement: Play produces a closed set of events
The system SHALL produce an event when a member marks a square, when a trip card comes within one square of meeting its trip's win condition, and when a trip card is recorded as won. Each event SHALL identify the trip, the trip card, the member responsible, the kind of event, and when it happened. The system SHALL NOT produce an event for any other action, and SHALL NOT produce an event when a member removes a mark.

#### Scenario: Marking a square produces an event
- **WHEN** a member marks a square on a trip card
- **THEN** the system SHALL produce an event recording that member, that trip card, and the time

#### Scenario: Removing a mark produces no event
- **WHEN** a member removes a mark from a trip card
- **THEN** the system SHALL NOT produce any event

#### Scenario: Winning produces an event
- **WHEN** a trip card is recorded as won
- **THEN** the system SHALL produce an event identifying the winning member and the card

#### Scenario: Actions outside play produce no events
- **WHEN** a member is invited, joins, is removed, or a card is added to or removed from a trip
- **THEN** the system SHALL NOT produce a play event

### Requirement: A near-miss is announced once, when the card enters that state
The system SHALL produce the one-square-away event only when a mark moves a trip card from being more than one square away from its trip's win condition to being exactly one square away. A subsequent mark on a card that is already one square away SHALL NOT produce another one-square-away event. A card that is recorded as won SHALL NOT also produce a one-square-away event for the same mark.

#### Scenario: A card becomes one square away
- **WHEN** a member marks a square that leaves their card exactly one square from the trip's win condition, having been further away before
- **THEN** the system SHALL produce a one-square-away event

#### Scenario: Marking again while still one square away
- **WHEN** a member marks a further square on a card that was already exactly one square from the win condition and still is
- **THEN** the system SHALL NOT produce another one-square-away event

#### Scenario: A card that was never further away
- **WHEN** a mark leaves a card exactly one square away and the card was already exactly one square away before that mark
- **THEN** the system SHALL NOT produce a one-square-away event

#### Scenario: A winning mark is a win, not a near-miss
- **WHEN** a mark completes the trip's win condition
- **THEN** the system SHALL produce a win event and SHALL NOT produce a one-square-away event for that mark

### Requirement: Each trip has an activity feed visible to every member
The system SHALL keep, for each trip, a most-recent-first record of the events that have occurred in it, and SHALL show it to every member of that trip. The feed SHALL be shown regardless of the viewing member's notification preferences, including to a member who has muted the trip. The feed SHALL be bounded to a recent window rather than returning a trip's whole history. A user who holds no membership in the trip SHALL NOT be able to read it, and the response SHALL be indistinguishable from that for a trip that does not exist.

#### Scenario: Member reads the trip's activity
- **WHEN** a member opens a trip in which events have occurred
- **THEN** the system SHALL present those events most-recent-first, identifying the member responsible and what happened

#### Scenario: A muted trip still shows its activity
- **WHEN** a member who has muted a trip opens it
- **THEN** the system SHALL still present that trip's activity feed

#### Scenario: The feed is bounded
- **WHEN** a trip has accumulated more events than the feed shows at once
- **THEN** the system SHALL return only the most recent events rather than the entire history

#### Scenario: Non-member attempts to read a trip's activity
- **WHEN** a user who holds no membership in a trip requests its activity
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist

### Requirement: Each signed-in user has a personal notification list
The system SHALL keep, for each signed-in user, a most-recent-first list of notifications drawn from events in the trips they are a member of and matching their preferences. Each notification SHALL identify the trip it came from, the member responsible, and what happened, and SHALL lead the user to the trip. The system SHALL track which notifications the user has read and SHALL report how many are unread. The list SHALL be scoped solely to the caller's verified identity, and the system SHALL NOT accept a user identifier supplied in the request body, path, query string, or an unverified header.

#### Scenario: User reads their notifications
- **WHEN** a signed-in user opens their notifications
- **THEN** the system SHALL present the notifications drawn from their trips, most-recent-first, with an unread count

#### Scenario: A notification leads to its trip
- **WHEN** a user opens a notification
- **THEN** the system SHALL take them to the trip the event occurred in

#### Scenario: Marking notifications read
- **WHEN** a user marks their notifications as read
- **THEN** the unread count SHALL become zero and SHALL remain so until a further notification arrives

#### Scenario: A notification list cannot target another user
- **WHEN** a request to read or modify notifications carries a user identifier that differs from the verified credential
- **THEN** the system SHALL ignore that identifier and act only on the caller's own notifications

#### Scenario: An unauthenticated request is rejected
- **WHEN** a request for notifications is made without valid credentials
- **THEN** the system SHALL reject it before any application logic runs, and SHALL NOT return any notification

### Requirement: A member is never notified of their own action
The system SHALL NOT place a notification in the list of the member whose action produced the event. The member SHALL still be told directly, in the moment, when their own mark wins a card, and the event SHALL still appear in the trip's activity feed.

#### Scenario: The acting member gets no notification
- **WHEN** a member marks a square, comes within one square of winning, or wins
- **THEN** the system SHALL NOT add a notification to that member's own list

#### Scenario: Other members are notified
- **WHEN** a member's action produces an event
- **THEN** every other member of the trip subscribed to that kind of event SHALL receive a notification

#### Scenario: The actor's own action still appears in the feed
- **WHEN** a member's action produces an event
- **THEN** that event SHALL appear in the trip's activity feed, including for the member who caused it

### Requirement: A user controls which notifications reach them
The system SHALL let a signed-in user choose, for each kind of event, whether it produces a notification for them, and SHALL let them mute an individual trip so that no notification from it reaches them while other trips are unaffected. A user who has expressed no preference SHALL receive notifications for wins and near-misses but SHALL NOT receive one for each individual mark, because an individual mark occurs often enough that notifying on it by default would make the list unusable. Preferences SHALL be scoped solely to the caller's verified identity and SHALL be validated before storage, with an invalid submission rejected in full rather than partially applied or silently corrected.

#### Scenario: Default preferences
- **WHEN** a user who has never set preferences is a member of a trip in which a member wins, comes one square away, and marks an individual square
- **THEN** the system SHALL notify them of the win and the near-miss, and SHALL NOT notify them of the individual mark

#### Scenario: User turns on notifications for individual marks
- **WHEN** a user enables notifications for individual marks and another member then marks a square in one of their trips
- **THEN** the system SHALL notify them of that mark

#### Scenario: User turns off notifications for a kind of event
- **WHEN** a user disables notifications for a kind of event and an event of that kind then occurs in one of their trips
- **THEN** the system SHALL NOT add a notification to their list

#### Scenario: User mutes a single trip
- **WHEN** a user mutes one trip and events then occur in that trip and in another trip they are a member of
- **THEN** the system SHALL notify them only of the events from the trip they did not mute

#### Scenario: Invalid preferences are rejected unchanged
- **WHEN** a user submits preferences that are malformed or name an unsupported kind of event
- **THEN** the system SHALL reject the submission and SHALL leave the stored preferences unchanged

#### Scenario: Preferences cannot target another user
- **WHEN** a request to write preferences carries a user identifier that differs from the verified credential
- **THEN** the system SHALL ignore that identifier and write only the caller's own preferences

### Requirement: Leaving a trip stops its notifications
The system SHALL determine who receives a notification from the trip's membership at the moment the event occurs. A user who has been removed from a trip, or who was never a member, SHALL NOT receive notifications from it. Notifications a removed member already received SHALL remain in their list until they expire, and following one SHALL behave exactly as any attempt by a non-member to open that trip.

#### Scenario: A removed member receives nothing further
- **WHEN** a member is removed from a trip and an event then occurs in it
- **THEN** the system SHALL NOT add a notification to that former member's list

#### Scenario: Earlier notifications remain but do not grant access
- **WHEN** a removed member opens a notification they received while they were still a member
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist, and the notification SHALL be presented as no longer available rather than as an error

#### Scenario: A newly joined member receives subsequent events only
- **WHEN** a user joins a trip in which events have already occurred
- **THEN** the system SHALL notify them only of events occurring after they joined, while the trip's activity feed SHALL still show them the earlier events

### Requirement: Notifications and activity are retained for a bounded period
The system SHALL remove notifications and trip activity automatically after a bounded retention period, so that neither a user's notification list nor a trip's activity grows without limit. The system SHALL NOT depend on removal being immediate, and every read SHALL be bounded in its own right rather than relying on retention to keep responses small. Deleting a trip SHALL remove its activity along with the trip.

#### Scenario: Old activity is removed
- **WHEN** an event is older than the retention period
- **THEN** the system SHALL remove it without any user action

#### Scenario: Reads stay bounded regardless of retention
- **WHEN** a user's notification list or a trip's activity contains more entries than a single response returns, including entries past the retention period that have not yet been removed
- **THEN** the system SHALL return only the most recent entries

#### Scenario: Deleting a trip removes its activity
- **WHEN** the administrator deletes a trip
- **THEN** that trip's activity SHALL be removed along with the trip

### Requirement: A failure to notify never fails the play action that caused it
The system SHALL record a member's mark, and any win it produces, before producing the resulting events, and SHALL NOT fail or reverse that action because a notification could not be produced or delivered. A member SHALL NOT be shown an error for a notification failure caused by an action they performed correctly.

#### Scenario: Notification production fails
- **WHEN** a member marks a square successfully and the resulting notifications cannot be produced
- **THEN** the mark SHALL remain recorded and the member SHALL be told their mark succeeded

#### Scenario: A win survives a notification failure
- **WHEN** a mark completes the win condition and the resulting notifications cannot be produced
- **THEN** the win SHALL remain recorded

### Requirement: Notifications are an account-only feature that leaves the signed-out experience unchanged
The system SHALL make notifications and the activity feed available only to signed-in users. A signed-out visitor SHALL NOT see any notification surface and the application SHALL issue no notification request on their behalf. The signed-out card editor SHALL remain fully functional and SHALL NOT depend on any notification or preference data.

#### Scenario: Signed-out visitor sees no notification surface and makes no requests
- **WHEN** a signed-out visitor loads the application
- **THEN** the system SHALL show no notification surface, SHALL issue no notification request, and the editor SHALL remain fully functional

#### Scenario: Notifications do not gate account-free use
- **WHEN** a signed-out or signed-in user builds, edits, randomizes, prints, or exports a card
- **THEN** that capability SHALL work without reading or writing any notification or preference
