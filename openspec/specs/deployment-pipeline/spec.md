# deployment-pipeline Specification

## Purpose
Defines how the client-side frontend is built and released to AWS, across two isolated environments, with infrastructure managed remotely and all cloud authentication done via short-lived credentials.
## Requirements
### Requirement: Two isolated deployment environments
The system SHALL provide two isolated deployment environments, `dev` and `prod`, each backed by its own private S3 bucket and CloudFront distribution in a single AWS account. The `dev` environment SHALL be redeployed automatically on every push to the default branch. The `prod` environment SHALL be deployed only through an explicit, review-gated manual action.

#### Scenario: Dev redeploys on push
- **WHEN** a change is pushed to the `main` branch
- **THEN** the dev frontend SHALL be rebuilt and deployed to the dev S3 bucket, and its CloudFront distribution invalidated, without human intervention

#### Scenario: Prod requires a manual action
- **WHEN** a change is pushed to `main`
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
The system SHALL provision the AWS OIDC identity providers and all environment deploy roles in a dedicated local-state bootstrap configuration applied once with administrator credentials. These resources SHALL NOT reside in the main HCP-managed remote state, because remote execution and dynamic credentials depend on them pre-existing.

#### Scenario: Bootstrap precedes remote runs
- **WHEN** the deployment pipeline is first established
- **THEN** the OIDC identity providers and deploy roles SHALL already exist from a prior local bootstrap apply before any remote Terraform run or GitHub Actions deploy executes

