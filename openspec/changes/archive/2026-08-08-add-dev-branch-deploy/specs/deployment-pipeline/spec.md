## MODIFIED Requirements

### Requirement: Two isolated deployment environments
The system SHALL provide two isolated deployment environments, `dev` and `prod`, each backed by its own private S3 bucket and CloudFront distribution in a single AWS account. The `dev` environment SHALL be redeployed automatically on every push to the default branch or to the long-lived `dev` integration branch, with no human intervention. The `prod` environment SHALL be deployed only through an explicit, review-gated manual action. Pushes to the `dev` branch and to the default branch both deploy to the same single `dev` environment; there SHALL NOT be a separate environment per branch.

#### Scenario: Dev redeploys on push to the default branch
- **WHEN** a change is pushed to the `main` branch
- **THEN** the dev frontend SHALL be rebuilt and deployed to the dev S3 bucket, and its CloudFront distribution invalidated, without human intervention

#### Scenario: Dev redeploys on push to the integration branch
- **WHEN** a change is pushed to the `dev` branch
- **THEN** the dev frontend SHALL be rebuilt and deployed to the dev S3 bucket, and its CloudFront distribution invalidated, without human intervention, using the same dev environment a push to `main` deploys to

#### Scenario: Prod requires a manual action
- **WHEN** a change is pushed to `main` or to `dev`
- **THEN** the prod environment SHALL NOT be deployed until an operator manually triggers the production deploy and a required reviewer approves it
