## ADDED Requirements

### Requirement: The default branch is protected against unreviewed change
The system SHALL prevent commits from reaching the default branch except through a pull request. Force pushes to the default branch and deletion of the default branch SHALL be blocked. These restrictions SHALL apply to repository administrators as well as to other contributors, because a push to the default branch applies infrastructure and deploys to a live cloud environment without further human intervention.

#### Scenario: A direct push to the default branch
- **WHEN** anyone, including an administrator, pushes a commit directly to the default branch
- **THEN** the push SHALL be rejected, and the change SHALL be able to reach the branch only through a pull request

#### Scenario: History is rewritten or the branch removed
- **WHEN** a force push or a branch deletion targets the default branch
- **THEN** the operation SHALL be rejected

### Requirement: Changes are verified before they can merge
The system SHALL run lint, tests, and a build for every package on each pull request targeting the default branch, and SHALL block merging until those checks pass. The verification workflow SHALL NOT deploy, SHALL NOT assume a cloud role, and SHALL NOT require credentials, so that it is safe to run against code proposed by someone without write access.

#### Scenario: A pull request with a failing check
- **WHEN** a pull request's lint, test, or build check fails for any package
- **THEN** the pull request SHALL NOT be mergeable until the check passes

#### Scenario: The verification workflow needs no credentials
- **WHEN** the verification workflow runs
- **THEN** it SHALL complete without assuming any cloud role and without reading any deployment secret

### Requirement: Workflows proposed by untrusted contributors require approval
The system SHALL require explicit maintainer approval before any workflow runs for a pull request opened from a fork. No workflow triggered by an unapproved fork pull request SHALL obtain cloud credentials or access repository secrets.

#### Scenario: A fork opens a pull request
- **WHEN** a pull request is opened from a fork of the repository
- **THEN** no workflow SHALL execute until a maintainer approves the run

#### Scenario: An unapproved fork run attempts a deploy
- **WHEN** a workflow from an unapproved fork pull request would otherwise assume a deploy role
- **THEN** it SHALL NOT execute, and SHALL NOT receive federated cloud credentials
