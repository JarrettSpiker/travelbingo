## ADDED Requirements

### Requirement: A build carries an identifier of the source it was built from
The frontend build SHALL embed an identifier of the source revision it was built from, and the running application SHALL be able to report it. The identifier SHALL be supplied by the build pipeline rather than typed into configuration, so it cannot drift from the artifact it describes. A build performed outside the pipeline, where no identifier is available, SHALL still succeed and SHALL report the identifier as unknown rather than failing or reporting a stale value.

This exists so that a report from a user can be tied to the exact artifact they were running, which a redeploy would otherwise make unknowable.

#### Scenario: The pipeline builds the frontend
- **WHEN** the deploy pipeline builds the frontend
- **THEN** the built artifact SHALL carry the source revision it was built from, taken from the pipeline rather than from configuration

#### Scenario: A developer builds locally
- **WHEN** the frontend is built outside the pipeline with no revision available
- **THEN** the build SHALL succeed and the application SHALL report the identifier as unknown, rather than failing or reporting a value from another build
