# app-visual-design Specification

## Purpose

Give the application a deliberate, consistent visual language — one source of truth for colour, shape, and depth, working in both light and dark — so the app reads as designed rather than assembled, while keeping the card the user is making clearly distinct from the application around it.

## Requirements

### Requirement: A design token system is the single source of truth for appearance
The system SHALL define its colours, corner radii, shadows, and type scale as a named set of design tokens, and application components SHALL derive their appearance from those tokens rather than from literal values. Changing a token SHALL change every place that token is used.

#### Scenario: A component is styled
- **WHEN** an application component renders any colour, corner radius, shadow, or text size
- **THEN** the value SHALL come from a design token rather than a literal colour or measurement written into the component

#### Scenario: A token is changed
- **WHEN** the value of a design token is changed
- **THEN** every part of the application that uses that token SHALL reflect the new value, with no component needing a separate edit

### Requirement: Light and dark presentation with a user-selectable mode
The system SHALL support both light and dark presentation, and SHALL let the user choose between light, dark, and following the operating system's preference. The choice SHALL persist across sessions and SHALL be applied before the first paint, so the page does not visibly change appearance after loading.

#### Scenario: User chooses a mode
- **WHEN** the user selects light or dark
- **THEN** the application SHALL render in that presentation regardless of the operating system's preference, and SHALL still do so when the user returns in a later session

#### Scenario: User follows the system preference
- **WHEN** the user selects the option to follow the operating system
- **THEN** the application SHALL match the operating system's current preference, and SHALL change presentation if that preference changes

#### Scenario: No flash on load
- **WHEN** a user who has chosen dark presentation loads the application
- **THEN** the page SHALL render in dark presentation from the first paint, without briefly appearing in light presentation

#### Scenario: Both presentations are complete
- **WHEN** any screen is viewed in either presentation
- **THEN** every element SHALL be legible and intentionally styled, with no element carrying a colour fixed for the other presentation

### Requirement: Application chrome is visually distinct from card content
The card a user is building is a document with its own user-chosen colours and fonts; the application around it is not. The system SHALL keep the two visually distinct, and SHALL NOT use the typefaces offered to users for card content as the typefaces of the application's own interface.

#### Scenario: Card sits on a distinct surface
- **WHEN** the card preview is shown
- **THEN** the surrounding application surface SHALL be visually distinguishable from the card itself, so the card reads as an object being worked on rather than part of the page

#### Scenario: Chrome typography is separate
- **WHEN** the application renders its own headings, labels, and body text
- **THEN** it SHALL use typefaces reserved for the interface, not the card-content typefaces the user can select for their card

### Requirement: Interactive controls are perceivable and keyboard-navigable
The system SHALL render text and interactive controls at sufficient contrast against their backgrounds in both presentations, and SHALL show a clearly visible focus indicator on every interactive control when it receives keyboard focus.

#### Scenario: Keyboard focus is visible
- **WHEN** a user moves keyboard focus onto any interactive control
- **THEN** the control SHALL display a clearly visible focus indicator

#### Scenario: Contrast holds in both presentations
- **WHEN** any screen is viewed in either light or dark presentation
- **THEN** text and interactive controls SHALL meet the project's contrast requirement against their backgrounds

#### Scenario: Destructive actions are distinguishable
- **WHEN** a destructive action is shown near the application's primary action
- **THEN** the two SHALL be distinguishable by more than hue alone, so they are not confusable

### Requirement: Motion is subtle and respects user preference
The system SHALL keep transitions short and unobtrusive, and SHALL honour the user's reduced-motion preference.

#### Scenario: User prefers reduced motion
- **WHEN** the user's system indicates a preference for reduced motion
- **THEN** the application SHALL suppress non-essential animation and transition effects
