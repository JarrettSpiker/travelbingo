# brand-theming Specification

## Purpose
Lets one codebase present as more than one product — varying the design token values, motif set, UI copy, suggestion content, and marketing metadata per brand — while guaranteeing that exactly one brand reaches any build and that the card renderer, the stored card shape, the API, and the URL paths stay identical across brands.
## Requirements
### Requirement: A build selects exactly one brand
The system SHALL select a brand at build time from a closed set of known brand identifiers, and the selected brand SHALL be the only brand whose design tokens, motif definitions, copy, suggestion content, and marketing metadata are present in the built artifact. The build SHALL fail when no brand is selected or when an unrecognized brand is named, rather than falling back to a default.

#### Scenario: A brand is selected for a production build
- **WHEN** a production build runs with a recognized brand identifier
- **THEN** the built artifact SHALL contain that brand's tokens, copy, suggestion content, and metadata, and SHALL NOT contain any other brand's

#### Scenario: No brand is named for a production build
- **WHEN** a production build runs with no brand identifier
- **THEN** the build SHALL fail with a message naming the accepted identifiers, and SHALL NOT produce an artifact

#### Scenario: An unrecognized brand is named
- **WHEN** a build runs with a brand identifier outside the known set
- **THEN** the build SHALL fail with a message naming the accepted identifiers

#### Scenario: Local development without configuration
- **WHEN** the development server is started in a checkout with no brand configured
- **THEN** it SHALL start successfully using the default brand, preserving the ability to work on a fresh clone with no local configuration

### Requirement: The built artifact is verified to carry one brand
The system SHALL verify, as part of the build, that the produced artifact carries the selected brand and no other. The verification SHALL cover both the application bundle and the delivered HTML document.

#### Scenario: The wrong brand's assets are present
- **WHEN** the built artifact contains an identifying value belonging to a brand other than the selected one
- **THEN** the build SHALL fail

#### Scenario: The document does not match the selected brand
- **WHEN** the delivered HTML document's title, description, or icon reference does not match the selected brand's metadata
- **THEN** the build SHALL fail

### Requirement: Every brand defines every design token in both presentations
Design token *names and roles* SHALL be shared across brands; token *values* SHALL be supplied per brand. Every token that the application refers to SHALL be defined by every brand, in both the light and the dark presentation. A token defined by one brand and not another SHALL be detected by an automated check rather than surfacing as an unstyled element.

#### Scenario: A brand omits a token
- **WHEN** a brand's token definitions omit a token the application refers to, in either presentation
- **THEN** the automated checks SHALL fail, naming the token and the brand

#### Scenario: A token is added to the shared layer
- **WHEN** a new token is referred to by the application
- **THEN** the automated checks SHALL fail until every brand defines it in both presentations

#### Scenario: A token is defined outside a brand
- **WHEN** a brand-owned token is declared in the shared style layer rather than in a brand's own definitions
- **THEN** the automated checks SHALL fail

### Requirement: Every brand fills every motif slot
The system SHALL define its decorative motifs as a fixed set of named slots, each bound to one surface, rather than as a set of brand-specific pictures. Every brand SHALL fill every slot. A brand that intends a slot to render nothing SHALL state that explicitly rather than omitting the definition.

#### Scenario: A brand omits a motif slot
- **WHEN** a brand's motif definitions do not define one of the named slots
- **THEN** the automated checks SHALL fail, naming the slot and the brand

#### Scenario: A brand intends a slot to be empty
- **WHEN** a brand does not want a visible motif in a slot
- **THEN** it SHALL define the slot with an explicitly empty presentation, and the automated checks SHALL pass

### Requirement: Brand-varying copy is declared and complete
User-visible text that differs between brands SHALL be declared in one place per brand against a shared declaration of which text varies. Text that is identical across brands SHALL NOT be declared there. A brand that is missing a declared piece of text, or that declares text not in the shared declaration, SHALL be rejected before the application runs.

#### Scenario: A brand is missing a piece of copy
- **WHEN** a brand does not supply a piece of text that the shared declaration requires
- **THEN** the build SHALL fail, and the failure SHALL identify the missing text

#### Scenario: A new brand-varying string is introduced
- **WHEN** a new piece of user-visible text is declared as brand-varying
- **THEN** the build SHALL fail until every brand supplies it

#### Scenario: Text is the same in every brand
- **WHEN** a piece of user-visible text has the same value in every brand
- **THEN** it SHALL NOT be declared as brand-varying

### Requirement: Brand selection is exhaustive over known brands
The system SHALL ensure that every known brand identifier resolves to a complete brand definition, and that no known brand can be unreachable through the build-time selection.

#### Scenario: A brand is defined but unreachable
- **WHEN** a brand definition exists that the build-time selection cannot produce
- **THEN** the automated checks SHALL fail

#### Scenario: A brand identifier has no definition
- **WHEN** a brand identifier is declared without a complete definition
- **THEN** the build SHALL fail

### Requirement: The card renderer, stored card shape, API, and URL paths are brand-invariant
Branding SHALL NOT reach the card renderer, the persisted card payload, the API surface, the stored data key format, or the application's URL paths. A card produced under one brand SHALL be structurally identical to one produced under another, and a given screen SHALL be reachable at the same path in every brand.

#### Scenario: Brand data is referenced by the card renderer
- **WHEN** the card renderer or its stylesheet refers to any brand-supplied value
- **THEN** the automated checks SHALL fail

#### Scenario: The same card is saved under different brands
- **WHEN** the same card content is saved under two different brands
- **THEN** the stored payload SHALL have the same shape and SHALL satisfy the same validation, differing in no brand-dependent way

#### Scenario: A screen is reached in either brand
- **WHEN** a user navigates to a given screen in either brand
- **THEN** the URL path SHALL be the same, and any link previously issued for that path SHALL continue to resolve

### Requirement: Marketing metadata is brand-supplied
Each brand SHALL supply the document title, description, icon, and social preview metadata for its deployment, and the delivered HTML document SHALL carry that brand's values. Metadata that depends on the deployment's own origin SHALL be omitted when no origin is configured rather than emitted with a placeholder or unresolvable value.

#### Scenario: A page is delivered
- **WHEN** the application's HTML document is delivered for a brand
- **THEN** its title, description, icon reference, and social preview tags SHALL be that brand's

#### Scenario: No origin is configured
- **WHEN** the deployment has no configured origin
- **THEN** metadata requiring an absolute URL SHALL be omitted rather than emitted with an unresolvable value

#### Scenario: A brand's icon is out of step with its palette
- **WHEN** a brand's icon no longer carries the mark colours its metadata declares
- **THEN** the automated checks SHALL fail

