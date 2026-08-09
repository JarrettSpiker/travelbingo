## MODIFIED Requirements

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
The project's definition of done SHALL include a visual review step for any change that alters rendered output. The step SHALL require reviewing the affected screens in both light and dark presentation **for every brand the change can affect**, and SHALL additionally require the print and export checks when the card renderer or its stylesheet was touched.

Review artifacts SHALL be identifiable by brand, so that one brand's captures cannot be mistaken for or overwritten by another's.

#### Scenario: A change alters rendered output
- **WHEN** a change modifies anything that is rendered
- **THEN** the change SHALL NOT be considered complete until the affected screens have been visually reviewed in both light and dark presentation, in every brand the change can affect

#### Scenario: A change touches the card renderer
- **WHEN** a change modifies the card renderer or its stylesheet
- **THEN** the change SHALL NOT be considered complete until printed output, exported images, and saved-card thumbnails have been confirmed unaffected

#### Scenario: Review artifacts are captured for more than one brand
- **WHEN** review artifacts are captured for more than one brand
- **THEN** each SHALL be identifiable by its brand, and capturing one brand SHALL NOT overwrite another's

#### Scenario: A change affects only one brand
- **WHEN** a change alters only one brand's own definition
- **THEN** the visual review SHALL cover that brand, and the other brands SHALL be confirmed unchanged rather than re-reviewed in full

## ADDED Requirements

### Requirement: The card renderer is guarded against brand coupling
The automated guards on the card renderer SHALL additionally reject any reference from the renderer or its stylesheet to brand-supplied values, so that the one part of the application whose output is user data cannot acquire a brand.

#### Scenario: The renderer refers to brand data
- **WHEN** the card renderer or its stylesheet refers to any brand-supplied value
- **THEN** the automated checks SHALL fail

#### Scenario: The renderer is unchanged across brands
- **WHEN** the same card is rendered, printed, exported, and thumbnailed under two different brands
- **THEN** the results SHALL be equivalent, and SHALL NOT differ on account of the brand
