## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: OIDC providers and deploy roles are bootstrapped separately
The system SHALL provision the AWS OIDC identity providers, all environment deploy roles, and the runtime execution roles assumed by backend compute in a dedicated local-state bootstrap configuration applied once with administrator credentials. These resources SHALL NOT reside in the main HCP-managed remote state, because remote execution and dynamic credentials depend on them pre-existing. The roles used for remote Terraform execution SHALL NOT be granted permission to create roles or attach policies; where they must associate a runtime role with a service, they SHALL be granted only the ability to pass a specific named role to that service.

#### Scenario: Bootstrap precedes remote runs
- **WHEN** the deployment pipeline is first established
- **THEN** the OIDC identity providers, deploy roles, and backend runtime execution roles SHALL already exist from a prior local bootstrap apply before any remote Terraform run or GitHub Actions deploy executes

#### Scenario: Remote execution roles cannot escalate their own privileges
- **WHEN** the remote Terraform execution role provisions backend compute
- **THEN** it SHALL pass the pre-existing runtime execution role to the compute service, and SHALL NOT hold permission to create IAM roles or attach IAM policies
