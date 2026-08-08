# deployment-pipeline Specification

## Purpose
Defines how the client-side frontend is built and released to AWS, across two isolated environments, with infrastructure managed remotely and all cloud authentication done via short-lived credentials.
## Requirements
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

### Requirement: The frontend is built and deployed by GitHub Actions using ephemeral credentials
The system SHALL build the frontend (lint, test, build) and deploy it to the target environment's S3 bucket with a CloudFront invalidation via GitHub Actions. GitHub Actions SHALL authenticate to AWS using short-lived OIDC-federated credentials scoped to the target environment, and SHALL NOT store long-lived AWS access keys in GitHub.

#### Scenario: GitHub Actions authenticates via OIDC
- **WHEN** a deploy workflow runs
- **THEN** it SHALL assume an environment-specific IAM role using the GitHub Actions OIDC token, and SHALL NOT read any static AWS access key from secrets

### Requirement: Infrastructure is managed by HCP Terraform with remote execution
The system SHALL manage AWS infrastructure through Terraform whose state and execution reside in HCP Terraform. The dev workspace SHALL apply infrastructure changes automatically on push to the default branch; the prod workspace SHALL require a manual apply. Terraform state SHALL NOT be stored on a developer workstation after migration.

#### Scenario: Dev infrastructure auto-applies
- **WHEN** an infrastructure change is pushed to `main`
- **THEN** the dev HCP workspace SHALL plan and apply it automatically

#### Scenario: Prod infrastructure requires manual apply
- **WHEN** an infrastructure change is pushed to `main`
- **THEN** the prod HCP workspace SHALL plan but SHALL NOT apply until an operator manually approves the apply

### Requirement: HCP Terraform authenticates to AWS via dynamic provider credentials
The system SHALL configure HCP Terraform to obtain short-lived AWS credentials per run through OIDC federation (dynamic provider credentials), with one IAM role per environment. The system SHALL NOT configure static AWS credentials in HCP Terraform.

#### Scenario: HCP uses dynamic credentials
- **WHEN** HCP Terraform runs a plan or apply
- **THEN** it SHALL authenticate to AWS using short-lived credentials minted for that run via OIDC, scoped to an environment-specific role

### Requirement: OIDC providers and deploy roles are bootstrapped separately
The system SHALL provision the AWS OIDC identity providers, all environment deploy roles, and the runtime execution roles assumed by backend compute in a dedicated local-state bootstrap configuration applied once with administrator credentials. These resources SHALL NOT reside in the main HCP-managed remote state, because remote execution and dynamic credentials depend on them pre-existing. The roles used for remote Terraform execution SHALL NOT be granted permission to create roles or attach policies; where they must associate a runtime role with a service, they SHALL be granted only the ability to pass a specific named role to that service.

#### Scenario: Bootstrap precedes remote runs
- **WHEN** the deployment pipeline is first established
- **THEN** the OIDC identity providers, deploy roles, and backend runtime execution roles SHALL already exist from a prior local bootstrap apply before any remote Terraform run or GitHub Actions deploy executes

#### Scenario: Remote execution roles cannot escalate their own privileges
- **WHEN** the remote Terraform execution role provisions backend compute
- **THEN** it SHALL pass the pre-existing runtime execution role to the compute service, and SHALL NOT hold permission to create IAM roles or attach IAM policies

### Requirement: The backend is built and deployed by GitHub Actions using ephemeral credentials
The system SHALL build the backend (lint, test, build) and deploy its code to the target environment's serverless function via GitHub Actions, authenticating to AWS using short-lived OIDC-federated credentials scoped to that environment. Backend and frontend SHALL be deployed by separate workflows so that either can fail without partially deploying the other, and the backend SHALL be deployed before the frontend that depends on it. The prod backend SHALL be deployed only through the same explicit, review-gated manual action that gates the prod frontend.

#### Scenario: Backend deploys via OIDC
- **WHEN** the backend deploy workflow runs
- **THEN** it SHALL assume an environment-specific IAM role using the GitHub Actions OIDC token, and SHALL NOT read any static AWS access key from secrets

#### Scenario: Backend is deployed before the frontend
- **WHEN** an environment is deployed
- **THEN** the backend code SHALL be updated before the frontend build is published, and a failed backend deploy SHALL prevent the frontend deploy from proceeding

#### Scenario: Prod backend requires a manual, reviewed action
- **WHEN** a change is pushed to `main`
- **THEN** the prod backend SHALL NOT be deployed until an operator manually triggers the production deploy and a required reviewer approves it

### Requirement: Backend code is deployed separately from infrastructure
The system SHALL provision the backend's infrastructure through Terraform while deploying the backend's code through GitHub Actions, mirroring the existing separation for the frontend. Terraform SHALL NOT be the mechanism by which backend code reaches an environment, so that a backend code fix does not require an infrastructure apply.

#### Scenario: A backend code change does not require an infrastructure apply
- **WHEN** only backend application code changes
- **THEN** deploying it SHALL NOT require a Terraform apply, and SHALL NOT be blocked by the manual prod infrastructure apply gate

### Requirement: Third-party identity provider credentials are stored outside the repository
The system SHALL store the third-party OAuth client credentials used to configure federated sign-in as sensitive per-environment variables in HCP Terraform. These credentials SHALL NOT be committed to the repository and SHALL NOT be stored in GitHub secrets or variables. Each environment SHALL use its own distinct OAuth client.

#### Scenario: Credentials are not in the repository or in GitHub
- **WHEN** the identity provider is configured for an environment
- **THEN** its client id and secret SHALL be read from sensitive HCP Terraform workspace variables, and SHALL NOT appear in the repository, in GitHub secrets, or in GitHub variables

#### Scenario: Environments do not share an OAuth client
- **WHEN** the dev and prod environments are configured
- **THEN** each SHALL use its own OAuth client, so that a dev misconfiguration cannot affect production sign-in
