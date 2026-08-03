## Purpose

Defines short, revocable links that let the owner of a saved card hand someone else a copy of it, without the recipient needing an account and without exposing the owner's library.

## ADDED Requirements

### Requirement: The owner of a saved card can mint a share link
The system SHALL let the owner of a saved card create a share link identified by an opaque, unguessable token. The link SHALL carry a snapshot of the card taken at the moment the link was created. The system SHALL let the owner see the share links that exist for a card.

#### Scenario: Owner creates a share link
- **WHEN** the owner of a saved card creates a share link
- **THEN** the system SHALL generate a link containing an unguessable token and make it available to the owner to copy

#### Scenario: Non-owner attempts to create a share link
- **WHEN** a user who does not own the card attempts to create a share link for it
- **THEN** the system SHALL refuse, responding exactly as it would for a card that does not exist

### Requirement: The snapshot in a share link is frozen at creation
The system SHALL serve a share link's recipients the card as it existed when the link was created. Subsequent edits to the owner's saved card SHALL NOT change what an existing share link produces.

#### Scenario: Owner edits the card after sharing
- **WHEN** the owner modifies and re-saves a card after creating a share link for it
- **THEN** opening that share link SHALL still produce the card as it was when the link was created

### Requirement: Anyone with the link receives a copy, with no account required
The system SHALL let any visitor open a share link without signing in, and SHALL present them the card as an independent copy. Changes the recipient makes SHALL NOT affect the owner's saved card. A signed-in recipient SHALL be able to save that copy to their own library as a new card of their own.

#### Scenario: Signed-out recipient opens a share link
- **WHEN** a visitor with no account opens a share link
- **THEN** the system SHALL display the shared card and let them edit, print, and export it, without prompting them to sign in

#### Scenario: Recipient edits the shared card
- **WHEN** a recipient modifies the card they received from a share link
- **THEN** the owner's saved card SHALL be unchanged

#### Scenario: Signed-in recipient keeps a copy
- **WHEN** a signed-in recipient saves a card they opened from a share link
- **THEN** the system SHALL create a new card owned by the recipient, leaving the owner's card untouched

### Requirement: The owner can revoke a share link
The system SHALL let the owner of a card revoke any share link minted from it. Once revoked, the link SHALL no longer resolve. Revocation SHALL NOT affect copies that recipients have already saved to their own libraries.

#### Scenario: Owner revokes a link
- **WHEN** the owner revokes a share link and someone then opens that link
- **THEN** the system SHALL respond as it would for a link that never existed

#### Scenario: Copies already taken survive revocation
- **WHEN** a recipient saved a copy before the link was revoked
- **THEN** that recipient's saved copy SHALL remain intact and accessible to them

### Requirement: Share tokens resist guessing and leakage
The system SHALL generate share tokens with sufficient entropy that they cannot feasibly be guessed or enumerated. A token that is unknown, revoked, or belongs to a deleted card SHALL produce identical responses, revealing nothing about which case applies. Share responses SHALL NOT be cached by shared infrastructure, and the system SHALL limit the token from leaking through the browser's address bar, history, or referrer headers.

#### Scenario: Unknown, revoked, and deleted are indistinguishable
- **WHEN** a visitor opens a share link whose token was never issued, was revoked, or belonged to a deleted card
- **THEN** the system SHALL return the same response in every case

#### Scenario: Share responses are not cached at the edge
- **WHEN** a share link is resolved
- **THEN** the response SHALL NOT be stored by any shared cache, so that no visitor can receive another visitor's response

#### Scenario: The token does not linger in the browser
- **WHEN** a recipient has opened a share link and the card has loaded
- **THEN** the system SHALL remove the token from the visible URL, and SHALL NOT transmit it in referrer headers to other sites
