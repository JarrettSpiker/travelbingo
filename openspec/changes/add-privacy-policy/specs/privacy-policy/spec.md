## Purpose

Tells a visitor, in plain prose that matches the system's actual behavior, what the application does and does not do with their data — and binds that statement to the behavior it describes, so the two cannot drift apart.

## ADDED Requirements

### Requirement: A privacy policy is published at a stable, brand-invariant path

The system SHALL publish the privacy policy as a page of the application at the path `/privacy`. The path SHALL be the same in every brand. The page SHALL be reachable by a visitor with no account, and loading it SHALL NOT cause a request to the application backend.

#### Scenario: A signed-out visitor opens the policy
- **WHEN** a signed-out visitor navigates to `/privacy`
- **THEN** the page SHALL render, and the load SHALL cause no request to the application backend

#### Scenario: The policy is reached in either brand
- **WHEN** the policy page is opened in any brand's deployment
- **THEN** it SHALL be served at the same path, `/privacy`

### Requirement: The policy is reachable from the site footer

The system SHALL link the privacy policy from the site footer wherever the footer is presented, alongside the feedback entry point. The footer's own visibility rules SHALL be unchanged by this link.

#### Scenario: The footer is presented
- **WHEN** the footer is visible to a visitor, signed in or signed out
- **THEN** it SHALL carry a link to the privacy policy, and following it SHALL arrive at the policy page

### Requirement: The policy states the application's actual data practices

The policy SHALL state, in plain prose readable without legal expertise: that the card tools run entirely in the visitor's browser and a signed-out visitor's card data never leaves it; that signing in is optional and uses Google as the identity provider; what an account stores — saved cards, trips and their members, share links, and feedback; what a feedback submission carries and never carries, and that submissions expire; that the application contains no analytics or advertising and adds no third-party trackers; the address a privacy question or deletion request should be sent to; and the policy's effective date.

#### Scenario: The policy is read by a visitor
- **WHEN** the policy page is rendered
- **THEN** its prose SHALL cover every item this requirement names, including the contact address and the effective date

#### Scenario: The policy names no practice the system does not have
- **WHEN** the policy's claims are compared against the application's behavior
- **THEN** each claim SHALL describe behavior the system actually exhibits, including the claim that a signed-out visitor's data never leaves their browser

### Requirement: Brand-supplied policy values are declared per brand

The policy's operating name, the site's own web address, and the privacy contact address SHALL come from the brand's own declarations. The contact address and web address differ between brands and SHALL be declared as brand-varying text; a brand that fails to supply them SHALL be rejected by the same completeness checks that govern all brand-varying text. The page itself SHALL NOT hardcode any of these values.

#### Scenario: The policy is rendered for a brand
- **WHEN** the policy page is rendered in a brand's build
- **THEN** its operating name, web address, and contact address SHALL be that brand's declared values

#### Scenario: A brand omits a policy value
- **WHEN** a brand does not supply the declared brand-varying policy text
- **THEN** the build SHALL fail, identifying the missing value

### Requirement: The policy is amended with the practices it describes

Any change that alters what the application collects, stores, or shares SHALL amend the policy within that same change. The policy SHALL display an effective date, and the date SHALL change whenever the policy's content changes.

#### Scenario: A change alters data practices
- **WHEN** a change introduces or alters anything the application collects, stores, or shares about a person
- **THEN** that change SHALL also update the policy's prose to match, and SHALL advance the policy's effective date

#### Scenario: The policy content is edited
- **WHEN** the policy's content is changed for any reason
- **THEN** the displayed effective date SHALL change with it
