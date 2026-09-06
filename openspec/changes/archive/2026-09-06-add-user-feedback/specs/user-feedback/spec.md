## Purpose

Gives a person using the application a way to tell its maintainer that something is wrong or missing, and gives the maintainer enough context with each report to act on it without a conversation.

## ADDED Requirements

### Requirement: Feedback submission requires an account
The system SHALL accept a feedback submission only from a signed-in user, and SHALL attribute every stored submission to the submitting account's verified identity. Submission SHALL NOT be possible without an account, by any route.

This is an anti-abuse measure taken in full knowledge of what it costs: the application is otherwise fully functional signed out, so this requirement places the channel out of reach of every visitor who has not signed in, including those who leave because something is wrong.

#### Scenario: A signed-in user submits feedback
- **WHEN** a signed-in user submits feedback
- **THEN** the system SHALL store it, attributed to the identity carried by their verified credential

#### Scenario: A submission arrives without a valid credential
- **WHEN** a feedback submission arrives without a valid credential
- **THEN** the system SHALL reject it before it reaches application code, and SHALL NOT store any part of it

### Requirement: The feedback channel is discoverable while signed out
The system SHALL present the feedback entry point to signed-out visitors rather than hiding it, and SHALL state that signing in is required, offering the sign-in action in place of the submission form. A signed-out visitor SHALL NOT be presented with a form that fails on submission.

Presenting the entry point SHALL NOT cause a request to the account backend, so that the signed-out experience continues to require no backend at all.

#### Scenario: A signed-out visitor opens the feedback entry point
- **WHEN** a signed-out visitor activates the feedback entry point
- **THEN** the system SHALL explain that sign-in is required and offer the sign-in action, and SHALL NOT present a form that would be rejected

#### Scenario: A signed-out visitor loads the application
- **WHEN** the application is loaded while signed out
- **THEN** the presence of the feedback entry point SHALL NOT cause any request to the account backend

### Requirement: A submission carries its own diagnostic context
The system SHALL attach to every submission, without asking the submitter, the brand and environment the submission came from, the route the submitter was on, the viewport dimensions, the browser's user agent, and an identifier of the build being run. The submitter SHALL NOT be asked to supply any of these.

#### Scenario: Feedback is submitted from a given build and screen
- **WHEN** a user submits feedback
- **THEN** the stored submission SHALL carry the brand, the environment, the route, the viewport, the user agent, and the build identifier, none of them typed by the submitter

#### Scenario: The deployed build changes after a submission
- **WHEN** a submission is read after the environment has been redeployed
- **THEN** the build identifier it carries SHALL still identify the build the submitter was running, not the build currently deployed

### Requirement: A submission never carries card content or a network address
The system SHALL NOT attach the text, title, or any other content of a user's card to a feedback submission, and SHALL NOT store the submitter's IP address in any form. This extends to the automatically collected context, which SHALL carry only the values this specification names.

#### Scenario: Feedback is submitted while a card is being edited
- **WHEN** a user submits feedback while editing a card
- **THEN** the stored submission SHALL NOT contain that card's title, entries, or any other card content

#### Scenario: A submission is stored
- **WHEN** the system stores a submission
- **THEN** it SHALL NOT record the submitter's IP address, in plaintext or in any derived form

### Requirement: A contact address is optional and captured at the moment of consent
The system SHALL allow a submitter to supply a contact address, SHALL present it as optional, and SHALL state what it will be used for. The system SHALL NOT take an address from the submitter's existing session or credential, and SHALL store no address for a submitter who does not supply one. Supplying an address SHALL NOT be a condition of submitting.

#### Scenario: A submitter supplies no address
- **WHEN** a user submits feedback without filling the contact field
- **THEN** the system SHALL store the submission with no contact address, and SHALL NOT substitute the address on their account

#### Scenario: A submitter supplies an address
- **WHEN** a user fills the contact field and submits
- **THEN** the system SHALL store that address with the submission, having stated before submission what it will be used for

### Requirement: Submitted text is bounded and validated
The system SHALL bound the length of the submitted message and of the optional contact address, and SHALL reject a submission that exceeds a bound or that carries an empty message, with a client-error response, storing no part of it. The bounds SHALL be enforced by the backend and SHALL NOT rely on the client enforcing them.

#### Scenario: An oversized or empty submission is sent
- **WHEN** a submission carries a message that is empty or that exceeds the length bound
- **THEN** the system SHALL reject it with a client-error response and SHALL NOT store any part of it

### Requirement: Submission volume is bounded per account
The system SHALL cap how many submissions one account may store within a rolling window, and SHALL reject submissions beyond that cap with a client-error response that says the cap was reached. The cap SHALL bound abuse rather than ordinary use, and SHALL be enforced server-side.

#### Scenario: An account exceeds its submission cap
- **WHEN** an account submits more feedback within the window than the cap allows
- **THEN** the system SHALL reject the excess with a client-error response identifying the cap as the reason, and SHALL retain the submissions already stored

### Requirement: Submissions expire
The system SHALL store each submission with an expiry, after which it is removed without manual intervention, so that user-written text does not accumulate indefinitely.

#### Scenario: A submission reaches its expiry
- **WHEN** a stored submission reaches its expiry
- **THEN** the system SHALL remove it without requiring a manual deletion

### Requirement: Feedback is read out of band, per brand and per environment
The system SHALL make stored feedback readable by the maintainer through an operational tool that selects a brand and an environment, and SHALL NOT present submissions inside the application to any user. One brand's feedback SHALL NOT be readable from another brand's stack.

Keeping submissions out of the application is deliberate: a submission is text written by someone else, and rendering it in an authenticated view would create an injection surface and a moderation obligation that reading it in a terminal does not.

#### Scenario: The maintainer reads feedback for one brand
- **WHEN** the maintainer reads feedback for a given brand and environment
- **THEN** the tool SHALL return the submissions stored by that brand's stack in that environment, and SHALL NOT return another brand's

#### Scenario: A user looks for submitted feedback in the application
- **WHEN** any user, including the submitter, uses the application
- **THEN** no view SHALL render stored feedback submissions
