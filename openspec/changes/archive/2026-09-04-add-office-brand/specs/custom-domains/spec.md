## MODIFIED Requirements

### Requirement: Each environment is served over a custom HTTPS domain
The system SHALL serve an environment at its configured custom domain over HTTPS when a `domain_name` is provided for that environment. The CloudFront distribution SHALL list the domain as an alternate domain name (alias), and a Route53 alias record SHALL point the domain at the distribution. Each brand's production SHALL be served at that brand's apex domain and its dev at a subdomain of the same domain.

Each brand SHALL have its own domain and its own hosted zone; brands SHALL NOT share a domain, a subdomain, or a certificate.

#### Scenario: Production served at the apex domain
- **WHEN** a brand's prod environment has its apex domain configured
- **THEN** requests to that domain over HTTPS SHALL be served by that brand's prod CloudFront distribution

#### Scenario: Dev served at the subdomain
- **WHEN** a brand's dev environment has its dev subdomain configured
- **THEN** requests to that subdomain over HTTPS SHALL be served by that brand's dev CloudFront distribution

#### Scenario: Custom domain is optional
- **WHEN** an environment has no `domain_name` configured
- **THEN** its distribution SHALL continue to serve via the default `*.cloudfront.net` URL and SHALL NOT configure an alias or custom certificate

#### Scenario: One brand's domain does not reach another brand
- **WHEN** a request is made to one brand's domain
- **THEN** it SHALL be served only by that brand's distribution, and SHALL NOT reach another brand's distribution, bucket, or API

### Requirement: The hosted zone is referenced, not managed, by Terraform
The system SHALL reference an existing Route53 hosted zone by name rather than creating or managing it, so that domain registration and delegation remain outside the deployment configuration. Each brand's hosted zone SHALL be referenced independently, and registering a brand's domain and creating its hosted zone SHALL be a prerequisite to that brand's first apply.

#### Scenario: Records are created in the externally registered zone
- **WHEN** custom domain resources are applied for a brand
- **THEN** the validation records and the alias record SHALL be created in that brand's hosted zone, the one created by Route53 domain registration, and Terraform SHALL NOT manage the hosted zone resource

#### Scenario: The hosted zone already exists
- **WHEN** an environment is applied with a hosted zone name configured
- **THEN** the configuration SHALL reference the existing zone and SHALL NOT create, modify, or destroy the zone itself

#### Scenario: A brand's hosted zone does not yet exist
- **WHEN** an environment is applied for a brand whose hosted zone has not been created
- **THEN** the apply SHALL fail on the missing zone, rather than creating one or silently serving without a custom domain
