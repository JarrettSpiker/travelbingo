## MODIFIED Requirements

### Requirement: Two isolated deployment environments
The system SHALL provide two isolated deployment environments, `dev` and `prod`, **for each brand**, each backed by its own private S3 bucket and CloudFront distribution in a single AWS account. Every `dev` environment SHALL be redeployed automatically on every push to the default branch or to the long-lived `dev` integration branch, with no human intervention. Every `prod` environment SHALL be deployed only through an explicit, review-gated manual action, and each brand's production deploy SHALL be approvable independently of the other's. Pushes to the `dev` branch and to the default branch both deploy to the same single `dev` environment per brand; there SHALL NOT be a separate environment per branch.

Environments SHALL be isolated **across brands** by the same mechanism that isolates `dev` from `prod`: a separate bucket, distribution, data store, identity pool, function, and API per environment, with no shared state of any kind between brands.

#### Scenario: Dev redeploys on push to the default branch
- **WHEN** a change is pushed to the `main` branch
- **THEN** each brand's dev frontend SHALL be rebuilt and deployed to that brand's dev S3 bucket, and its CloudFront distribution invalidated, without human intervention

#### Scenario: Dev redeploys on push to the integration branch
- **WHEN** a change is pushed to the `dev` branch
- **THEN** each brand's dev frontend SHALL be rebuilt and deployed to that brand's dev S3 bucket, and its CloudFront distribution invalidated, without human intervention, using the same dev environment a push to `main` deploys to

#### Scenario: Prod requires a manual action
- **WHEN** a change is pushed to `main` or to `dev`
- **THEN** no prod environment SHALL be deployed until an operator manually triggers that brand's production deploy and a required reviewer approves it

#### Scenario: One brand is promoted and the other is not
- **WHEN** an operator triggers and approves the production deploy for one brand
- **THEN** only that brand's production environment SHALL be deployed, and the other brand's SHALL be left untouched

#### Scenario: One brand's deploy fails
- **WHEN** a deploy for one brand fails
- **THEN** the other brand's deploy SHALL NOT be blocked or cancelled by that failure

## ADDED Requirements

### Requirement: The brand is a validated deploy input
Each deployment environment SHALL declare which brand it serves, and the frontend build SHALL take that brand as an input. A deployment environment SHALL NOT be able to publish an artifact built for a different brand.

#### Scenario: An environment declares its brand
- **WHEN** a deploy workflow runs for an environment
- **THEN** it SHALL build the frontend for that environment's declared brand

#### Scenario: An environment's brand is missing or unrecognized
- **WHEN** a deploy workflow runs for an environment whose declared brand is absent or not a known brand
- **THEN** the build SHALL fail and nothing SHALL be uploaded

#### Scenario: A built artifact does not match the environment's brand
- **WHEN** the artifact produced for an environment does not carry that environment's declared brand
- **THEN** the deploy SHALL fail before any upload or cache invalidation

### Requirement: Every brand is built before changes are merged
The automated checks that run before a change is merged SHALL build the frontend for **every** known brand. A change that builds for one brand and fails for another SHALL be rejected before it can reach any deployment.

#### Scenario: A change breaks a brand that is not the default
- **WHEN** a proposed change builds successfully for one brand but fails for another
- **THEN** the pre-merge checks SHALL fail

#### Scenario: A brand is added
- **WHEN** a new brand is defined
- **THEN** the pre-merge checks SHALL build it alongside the existing brands with no separate configuration step

### Requirement: Deploy credentials are scoped per brand and environment
The deploy role assumed for a given environment SHALL be scoped to that environment's own resources. A brand's credentials SHALL NOT grant access to another brand's bucket, distribution, function, data store, or identity pool.

#### Scenario: A deploy assumes credentials
- **WHEN** a deploy workflow assumes credentials for an environment
- **THEN** those credentials SHALL permit acting only on that environment's own resources

#### Scenario: A deploy targets another brand's resources
- **WHEN** a deploy attempts to write to a bucket or update a function belonging to another brand or environment
- **THEN** the attempt SHALL be denied
