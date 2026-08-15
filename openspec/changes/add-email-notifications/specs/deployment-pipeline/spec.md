## MODIFIED Requirements

### Requirement: The backend is built and deployed by GitHub Actions using ephemeral credentials
The system SHALL build the backend (lint, test, build) and deploy its code to every one of the target environment's serverless functions via GitHub Actions, authenticating to AWS using short-lived OIDC-federated credentials scoped to that environment. Every backend function SHALL be built from the same source tree and deployed together by the same workflow run, so that functions sharing code cannot be running different versions of it. Backend and frontend SHALL be deployed by separate workflows so that either can fail without partially deploying the other, and the backend SHALL be deployed before the frontend that depends on it. The prod backend SHALL be deployed only through the same explicit, review-gated manual action that gates the prod frontend.

#### Scenario: Backend deploys via OIDC
- **WHEN** the backend deploy workflow runs
- **THEN** it SHALL assume an environment-specific IAM role using the GitHub Actions OIDC token, and SHALL NOT read any static AWS access key from secrets

#### Scenario: Backend is deployed before the frontend
- **WHEN** an environment is deployed
- **THEN** the backend code SHALL be updated before the frontend build is published, and a failed backend deploy SHALL prevent the frontend deploy from proceeding

#### Scenario: Every backend function is updated together
- **WHEN** the backend deploy workflow runs for an environment
- **THEN** every backend function in that environment SHALL be updated from the same build, and a failure to update any of them SHALL fail the deploy

#### Scenario: Prod backend requires a manual, reviewed action
- **WHEN** a change is pushed to `main`
- **THEN** the prod backend SHALL NOT be deployed until an operator manually triggers the production deploy and a required reviewer approves it

### Requirement: OIDC providers and deploy roles are bootstrapped separately
The system SHALL provision the AWS OIDC identity providers, all environment deploy roles, and the runtime execution roles assumed by backend compute in a dedicated local-state bootstrap configuration applied once with administrator credentials. This SHALL include the runtime execution role of every backend function, not only the one serving the API. These resources SHALL NOT reside in the main HCP-managed remote state, because remote execution and dynamic credentials depend on them pre-existing. The roles used for remote Terraform execution SHALL NOT be granted permission to create roles or attach policies; where they must associate a runtime role with a service, they SHALL be granted only the ability to pass a specific named role to that service.

#### Scenario: Bootstrap precedes remote runs
- **WHEN** the deployment pipeline is first established
- **THEN** the OIDC identity providers, deploy roles, and backend runtime execution roles SHALL already exist from a prior local bootstrap apply before any remote Terraform run or GitHub Actions deploy executes

#### Scenario: A new backend function's role is bootstrapped
- **WHEN** a further backend function is introduced
- **THEN** its runtime execution role SHALL be created in the bootstrap configuration, and the remote Terraform execution role SHALL only be granted the ability to pass that named role to the compute service

#### Scenario: Remote execution roles cannot escalate their own privileges
- **WHEN** the remote Terraform execution role provisions backend compute
- **THEN** it SHALL pass the pre-existing runtime execution role to the compute service, and SHALL NOT hold permission to create IAM roles or attach IAM policies
