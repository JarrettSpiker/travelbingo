# ui-development-workflow Specification

## Purpose
Keep the app's rendered surface reviewable and its exported output stable, so that visual changes are verified by looking at them rather than assumed correct — and so the parts of the UI that represent user data cannot be restyled by accident.
## Requirements
### Requirement: A development-only component gallery
The system SHALL provide a development-only page that renders every component in the component library, each in its meaningful states, on a single page. The gallery SHALL import the application's real components rather than copies or re-implementations, so that a change to a component is reflected in the gallery automatically.

#### Scenario: Reviewing the UI surface
- **WHEN** a developer or agent opens the gallery page while running the development server
- **THEN** the page SHALL display every component in the component library, including each component's empty, populated, error, and loading states where those states exist

#### Scenario: A component changes
- **WHEN** a component's markup or styling is modified
- **THEN** the gallery SHALL reflect that modification without requiring a separate update to the gallery, because it renders the real component

### Requirement: The gallery is excluded from production builds
The system SHALL exclude the gallery page and all of its supporting modules from production builds. The exclusion SHALL be verified mechanically rather than assumed.

#### Scenario: Production build excludes the gallery
- **WHEN** a production build is produced
- **THEN** the build output SHALL contain no gallery code, and a check of the build output SHALL confirm its absence

#### Scenario: Gallery route is unreachable in production
- **WHEN** a user navigates to the gallery path on a deployed environment
- **THEN** the application SHALL NOT render the gallery

### Requirement: Gallery coverage is enforced
The system SHALL fail its automated checks when a component exists in the component library but has no corresponding gallery entry, so that the gallery cannot silently fall out of date.

#### Scenario: A component is added without a gallery entry
- **WHEN** a new component is added to the component library and no gallery entry is registered for it
- **THEN** the automated checks SHALL fail, identifying the component that is missing an entry

### Requirement: The card renderer's visual output is protected from incidental restyling
The card renderer produces user data — its output is consumed by the on-screen preview, printed output, exported images, and saved-card thumbnails. The system SHALL fail its automated checks when the card renderer's markup or stylesheet acquires styling that is derived from the application's own theme, so that restyling the application cannot silently change what users have already saved and exported. The renderer's allowlisted set of styling hooks SHALL cover every layer the renderer draws, including the layer that indicates recorded progress, so that adding to the renderer is a deliberate act recorded in the allowlist rather than an unnoticed one. The automated checks SHALL additionally fail when the card's stylesheet stops forcing its progress marks to be painted in printed output, since a mark that silently disappears from paper is indistinguishable from a card that was never played.

#### Scenario: Card renderer acquires application theme styling
- **WHEN** the card renderer's markup or stylesheet is modified to reference the application's design tokens, or to use styling hooks outside its own allowlisted set
- **THEN** the automated checks SHALL fail

#### Scenario: Card stylesheet loses its print rules
- **WHEN** the card's stylesheet no longer defines its card classes or its print rules
- **THEN** the automated checks SHALL fail

#### Scenario: A new renderer layer is added without being allowlisted
- **WHEN** the card renderer begins drawing a styling hook that is not in its allowlisted set, including one belonging to the progress-marking layer
- **THEN** the automated checks SHALL fail, identifying the hook that is not allowlisted

#### Scenario: Print rules stop painting progress marks
- **WHEN** the card's stylesheet no longer forces its progress marks to be painted in printed output
- **THEN** the automated checks SHALL fail

### Requirement: A maintained design-language document
The system SHALL maintain a design document describing the visual rules that UI work conforms to and the procedure for visually reviewing a change. The document SHALL cover how to run and reach the application locally, how to review the affected screens, which display variations to review, and how to confirm that printed and exported output is unaffected.

The shared document SHALL describe the **rules** — the token roles, the motif slots and the one-motif-per-surface constraint, the spacing and type scales, depth, focus, the frozen card renderer, and the export checklist. Each brand's **specific values** — its palette, its typeface choice, and its realization of each motif slot — SHALL be documented alongside that brand's definition rather than in the shared document, so neither is diluted by the other.

#### Scenario: Contributor needs the visual rules
- **WHEN** a developer or agent begins UI work
- **THEN** the design document SHALL provide the applicable visual rules and the review procedure, rather than requiring the rules to be inferred from existing components

#### Scenario: Contributor needs a brand's specifics
- **WHEN** a developer or agent needs a brand's palette, typeface, or motif realization
- **THEN** that brand's own document SHALL provide them, and the shared design document SHALL point to it rather than restating it

#### Scenario: A brand is added
- **WHEN** a new brand is defined
- **THEN** it SHALL carry its own document describing its palette, typeface, and motif realizations

### Requirement: Visual review is part of the definition of done
The project's definition of done SHALL include a visual review step for any change that alters rendered output. The step SHALL require reviewing the affected screens in both light and dark presentation **for every brand the change can affect**, and SHALL additionally require the print and export checks when the card renderer or its stylesheet was touched. Those print and export checks SHALL confirm that a card carrying no progress is unaffected, and — when the change concerns the progress-marking layer — that a card carrying progress renders its marks correctly in printed output, in exported images, and in saved-card thumbnails.

Review artifacts SHALL be identifiable by brand, so that one brand's captures cannot be mistaken for or overwritten by another's.

#### Scenario: A change alters rendered output
- **WHEN** a change modifies anything that is rendered
- **THEN** the change SHALL NOT be considered complete until the affected screens have been visually reviewed in both light and dark presentation, in every brand the change can affect

#### Scenario: A change touches the card renderer
- **WHEN** a change modifies the card renderer or its stylesheet
- **THEN** the change SHALL NOT be considered complete until printed output, exported images, and saved-card thumbnails have been confirmed correct — unaffected for a card carrying no progress, and showing the expected marks for a card carrying progress

#### Scenario: A change touches the progress-marking layer
- **WHEN** a change modifies how recorded progress is drawn on a card
- **THEN** the change SHALL NOT be considered complete until a card carrying progress has been reviewed in printed output, in an exported image, and as a saved-card thumbnail

#### Scenario: Review artifacts are captured for more than one brand
- **WHEN** review artifacts are captured for more than one brand
- **THEN** each SHALL be identifiable by its brand, and capturing one brand SHALL NOT overwrite another's

#### Scenario: A change affects only one brand
- **WHEN** a change alters only one brand's own definition
- **THEN** the visual review SHALL cover that brand, and the other brands SHALL be confirmed unchanged rather than re-reviewed in full

### Requirement: The card renderer is guarded against brand coupling
The automated guards on the card renderer SHALL additionally reject any reference from the renderer or its stylesheet to brand-supplied values, so that the one part of the application whose output is user data cannot acquire a brand.

#### Scenario: The renderer refers to brand data
- **WHEN** the card renderer or its stylesheet refers to any brand-supplied value
- **THEN** the automated checks SHALL fail

#### Scenario: The renderer is unchanged across brands
- **WHEN** the same card is rendered, printed, exported, and thumbnailed under two different brands
- **THEN** the results SHALL be equivalent, and SHALL NOT differ on account of the brand

