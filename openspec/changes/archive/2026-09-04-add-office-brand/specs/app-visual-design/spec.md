## MODIFIED Requirements

### Requirement: A design token system is the single source of truth for appearance
The system SHALL define its colours, corner radii, shadows, and type scale as a named set of design tokens, and application components SHALL derive their appearance from those tokens rather than from literal values. Changing a token SHALL change every place that token is used.

Token **names and roles** SHALL be shared across every brand, and token **values** SHALL be supplied per brand. A token SHALL be named for the job it does rather than for the imagery it happens to carry in one brand, so that a component never refers to a motif a different brand does not have. Every brand SHALL define every token the application refers to, in both the light and the dark presentation; see the `brand-theming` capability for the enforcement of that completeness.

#### Scenario: A component is styled
- **WHEN** an application component renders any colour, corner radius, shadow, or text size
- **THEN** the value SHALL come from a design token rather than a literal colour or measurement written into the component

#### Scenario: A token is changed
- **WHEN** the value of a design token is changed
- **THEN** every part of the application that uses that token SHALL reflect the new value, with no component needing a separate edit

#### Scenario: A component refers to a token
- **WHEN** an application component refers to a design token
- **THEN** it SHALL refer to it by the token's role, and SHALL NOT branch on which brand is active

#### Scenario: The active brand changes
- **WHEN** the application is built for a different brand
- **THEN** every component SHALL take that brand's token values with no component edit

## ADDED Requirements

### Requirement: Decorative motifs are a fixed set of surface-bound slots
The system SHALL carry its visual character through a fixed, named set of decorative motif slots, each bound to exactly one surface, with at most one motif applied to any surface. The slot list SHALL be shared across brands and each brand SHALL supply its own realization of every slot.

#### Scenario: A surface carries decoration
- **WHEN** a surface is given a decorative motif
- **THEN** it SHALL be the one motif slot bound to that surface, and no second motif SHALL be applied to the same surface

#### Scenario: A brand is added
- **WHEN** a new brand is defined
- **THEN** it SHALL supply a realization of every motif slot before it can be built

### Requirement: Colour pairs that must remain distinguishable are re-derived per brand
Where two tokens carry meanings a user must be able to tell apart at a glance — in particular the primary action and the destructive action — each brand SHALL be checked for that distinguishability on its own values. A brand SHALL NOT inherit the assumption that a pair separated in one palette is separated in another.

#### Scenario: A brand's palette is defined or changed
- **WHEN** a brand's palette is defined or its values change
- **THEN** the pairs whose meanings must stay distinguishable SHALL be reviewed against that brand's own values, in both presentations, before the change is considered complete

#### Scenario: A pair is not distinguishable in a brand
- **WHEN** two tokens whose meanings must be told apart are confusable in a brand's palette
- **THEN** that brand SHALL separate them, either by adjusting its values or by giving the actions distinct treatments
