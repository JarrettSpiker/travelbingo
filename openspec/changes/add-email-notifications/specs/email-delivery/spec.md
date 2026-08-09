## Purpose

Carry the rare, genuinely interesting play events — a trip-mate winning, a trip-mate coming within one square of winning — to a member's verified email address, so they learn about them while the application is closed; without ever letting the high-frequency events reach an inbox, and without letting mail delivery touch the play path.

## ADDED Requirements

### Requirement: Only wins and near-misses are eligible for email
The system SHALL deliver by email only the event announcing that a card has been won and the event announcing that a card is one square from its trip's win condition. The event announcing that an individual square has been marked SHALL NOT be deliverable by email under any preference, and the system SHALL NOT offer it as an email option, because it occurs often enough that mailing it would render the channel unusable and would jeopardize delivery of the events that matter. That event SHALL remain available in the application's own notification list and in the trip's activity feed.

#### Scenario: A win is emailed
- **WHEN** a trip card is recorded as won and another member of the trip has enabled email
- **THEN** the system SHALL send that member a message identifying the winning member and the trip

#### Scenario: A near-miss is emailed
- **WHEN** a trip card comes within one square of its trip's win condition and another member of the trip has enabled email
- **THEN** the system SHALL send that member a message identifying the member and the trip

#### Scenario: An individual mark is never emailed
- **WHEN** a member marks a square and other members have enabled email
- **THEN** the system SHALL NOT send any message about that mark

#### Scenario: Individual marks are not offered as an email option
- **WHEN** a user views their notification preferences
- **THEN** the system SHALL NOT present individual marks as something that can be delivered by email, and SHALL make clear that this event is available in the application only

### Requirement: Email is off until the user enables it, and enabling it captures their verified address
The system SHALL NOT send any message to a user who has not explicitly enabled email delivery. When a user enables it, the system SHALL record the email address from that user's verified sign-in credential, and SHALL NOT accept an address supplied in the request body, path, query string, or an unverified header, nor take one from any other stored record. A user SHALL be able to disable email delivery at any time, after which the system SHALL send them nothing further.

#### Scenario: A user who has not opted in receives nothing
- **WHEN** an event eligible for email occurs in a trip a user is a member of and that user has not enabled email delivery
- **THEN** the system SHALL NOT send them a message

#### Scenario: Enabling email records the verified address
- **WHEN** a signed-in user enables email delivery
- **THEN** the system SHALL record the email address carried by their verified credential as the destination for their messages

#### Scenario: A supplied address is ignored
- **WHEN** a request to enable email delivery carries an email address in its body, path, or query
- **THEN** the system SHALL ignore that value and use only the address from the verified credential

#### Scenario: Disabling email stops delivery
- **WHEN** a user disables email delivery and an eligible event then occurs in one of their trips
- **THEN** the system SHALL NOT send them a message

#### Scenario: Re-enabling refreshes the address
- **WHEN** a user whose recorded address is out of date enables email delivery again
- **THEN** the system SHALL record the address from their current verified credential

### Requirement: Email honors the same preferences and muting as the application's own notifications
The system SHALL send a message only to a member who would receive the corresponding notification in the application. A member who has turned off a kind of event, who has muted the trip it occurred in, who is no longer a member of that trip, or who caused the event themselves SHALL NOT be sent a message about it.

#### Scenario: A muted trip sends no mail
- **WHEN** an eligible event occurs in a trip a member has muted, and that member has email enabled
- **THEN** the system SHALL NOT send them a message

#### Scenario: A disabled event type sends no mail
- **WHEN** an eligible event occurs and a member has turned that kind of event off
- **THEN** the system SHALL NOT send them a message

#### Scenario: The acting member is not mailed about their own action
- **WHEN** a member's own action produces an eligible event
- **THEN** the system SHALL NOT send that member a message about it

#### Scenario: A former member is not mailed
- **WHEN** an eligible event occurs in a trip after a member has been removed from it
- **THEN** the system SHALL NOT send that former member a message

### Requirement: Sending is decoupled from play and can never fail a member's action
The system SHALL record a member's mark, and any win it produces, without waiting for any message to be sent, and SHALL NOT fail, delay, or reverse that action because a message could not be sent. A failure to send SHALL be retried by the system rather than surfaced to the member whose action produced the event. A member SHALL NOT be able to observe the difference, in the time their action takes, between a trip where recipients have email enabled and one where none do.

#### Scenario: Mail service is unavailable
- **WHEN** a member marks a square that produces an eligible event and the mail service cannot be reached
- **THEN** the mark and any resulting win SHALL remain recorded and the member SHALL be told their action succeeded

#### Scenario: Play does not wait on delivery
- **WHEN** a member marks a square in a trip where many members have email enabled
- **THEN** the response to that member SHALL NOT wait for any message to be sent

#### Scenario: A transient failure is retried
- **WHEN** sending a message fails for a transient reason
- **THEN** the system SHALL retry it without any action by a member

#### Scenario: A retry may deliver a message twice
- **WHEN** a message is retried after a failure whose outcome is unknown
- **THEN** the system MAY deliver that message more than once, and SHALL NOT produce a duplicate notification, win record, or mark as a result

### Requirement: Every message carries a working one-click unsubscribe that needs no sign-in
The system SHALL include in every message both a visible unsubscribe link and the header that mail clients use to offer their own unsubscribe action. Following either SHALL disable email delivery for that recipient without requiring them to sign in. The unsubscribe link SHALL be identified by an opaque token carrying sufficient entropy that it cannot feasibly be guessed or enumerated. The token SHALL disable email delivery and nothing else: it SHALL NOT grant access to any trip, card, profile, or notification, and SHALL NOT reveal whose it is. A token that is unknown SHALL produce a response identical to one that is valid, so the endpoint cannot be used to discover whether an address is registered.

#### Scenario: A recipient unsubscribes from the message
- **WHEN** a recipient follows the unsubscribe link in a message
- **THEN** the system SHALL disable email delivery for them and SHALL confirm it, without asking them to sign in

#### Scenario: A mail client's unsubscribe action works
- **WHEN** a recipient uses their mail client's own unsubscribe action on a message
- **THEN** the system SHALL disable email delivery for them

#### Scenario: Unsubscribing stops subsequent mail
- **WHEN** a recipient has unsubscribed and a further eligible event occurs in one of their trips
- **THEN** the system SHALL NOT send them a message, while their notifications inside the application SHALL be unaffected

#### Scenario: The token grants nothing else
- **WHEN** an unsubscribe token is presented
- **THEN** the system SHALL NOT return or grant access to any trip, card, profile, or notification

#### Scenario: An unknown token is indistinguishable from a valid one
- **WHEN** an unsubscribe token that was never issued is presented
- **THEN** the system SHALL respond exactly as it would for a valid token, revealing nothing about which case applies

### Requirement: Addresses that hard-bounce or complain are disabled automatically
The system SHALL observe delivery failures and spam complaints reported for the messages it sends, and SHALL disable email delivery for an address that permanently fails or whose recipient reports a message as unwanted, without waiting for anyone to intervene. A temporary delivery failure SHALL NOT disable an address. The system SHALL show the user that their email delivery has been disabled and why, and SHALL let them enable it again, which SHALL re-record the address from their current verified credential.

#### Scenario: A permanent delivery failure disables the address
- **WHEN** a message to a recipient permanently fails to be delivered
- **THEN** the system SHALL disable email delivery for that recipient and SHALL NOT send them further messages

#### Scenario: A complaint disables the address
- **WHEN** a recipient reports a message as unwanted
- **THEN** the system SHALL disable email delivery for that recipient

#### Scenario: A temporary failure does not disable the address
- **WHEN** a message fails for a temporary reason, such as a full mailbox
- **THEN** the system SHALL NOT disable email delivery for that recipient

#### Scenario: The user is told why delivery stopped
- **WHEN** a user whose email delivery has been disabled automatically views their notification preferences
- **THEN** the system SHALL show that it is disabled and the reason, and SHALL let them enable it again

### Requirement: The sending domain is authenticated
The system SHALL send messages from an identity for the environment's own domain, signed so that receiving mail systems can authenticate them, with the required signing and sender records published in the same externally-registered hosted zone the environment's other records live in. Each deployment environment SHALL use its own sending identity, so that a non-production environment cannot send as production. An environment with no configured domain SHALL NOT be configured to send at all rather than sending from an unauthenticated identity.

#### Scenario: Messages are signed
- **WHEN** the system sends a message
- **THEN** it SHALL be signed for the environment's own domain such that a receiving mail system can authenticate it

#### Scenario: Environments do not share a sending identity
- **WHEN** the dev and prod environments are configured
- **THEN** each SHALL use its own sending identity, and a non-production environment SHALL NOT be able to send as production

#### Scenario: An environment without a domain does not send
- **WHEN** an environment has no custom domain configured
- **THEN** the system SHALL NOT configure email sending for it, rather than sending from an unauthenticated identity

### Requirement: Production sending requires granted general-access before any member can be mailed
Until the mail service has granted the account general sending access, the system can deliver only to individually verified addresses. The system SHALL treat obtaining that access for production as a prerequisite to enabling email delivery in production, rather than a step discovered when the first message fails. A non-production environment SHALL remain usable under the restriction by verifying its test addresses individually.

#### Scenario: Production is not enabled before access is granted
- **WHEN** general sending access has not been granted for the production environment
- **THEN** email delivery SHALL NOT be enabled for production members

#### Scenario: Non-production works under the restriction
- **WHEN** a non-production environment operates without general sending access
- **THEN** email delivery SHALL be exercisable for addresses that have been individually verified in that environment

### Requirement: A message contains only what its recipient could already see
The system SHALL limit a message to identifying who did what, in which trip, and a link to the trip. A message SHALL NOT contain the contents of a card, the entry on the square that was marked, or any other member's personal information beyond the name already shown to trip members. The system SHALL NOT embed tracking of whether a message was opened or its links followed.

#### Scenario: A message names the event without disclosing card contents
- **WHEN** the system sends a message about a win or a near-miss
- **THEN** it SHALL identify the member, the trip, and a link to it, and SHALL NOT include the card's entries or the marked square's text

#### Scenario: Messages carry no tracking
- **WHEN** the system sends a message
- **THEN** it SHALL NOT include a mechanism for observing whether the message was opened or its links followed

#### Scenario: The link is governed by the ordinary access rules
- **WHEN** a recipient follows the link in a message to a trip they are no longer a member of
- **THEN** the system SHALL respond exactly as it would for a trip that does not exist
