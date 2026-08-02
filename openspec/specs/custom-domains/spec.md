# custom-domains Specification

## Purpose
Defines how each deployment environment is served over a custom HTTPS domain, with managed TLS certificates and DNS records, on top of the existing S3 + CloudFront hosting.
## Requirements
### Requirement: Each environment is served over a custom HTTPS domain
The system SHALL serve an environment at its configured custom domain over HTTPS when a `domain_name` is provided for that environment. The CloudFront distribution SHALL list the domain as an alternate domain name (alias), and a Route53 alias record SHALL point the domain at the distribution. Production SHALL be served at the apex domain and dev at its subdomain.

#### Scenario: Production served at the apex domain
- **WHEN** the prod environment has `domain_name=travelbingo.ca` configured
- **THEN** requests to `https://travelbingo.ca` SHALL be served by the prod CloudFront distribution

#### Scenario: Dev served at the subdomain
- **WHEN** the dev environment has `domain_name=dev.travelbingo.ca` configured
- **THEN** requests to `https://dev.travelbingo.ca` SHALL be served by the dev CloudFront distribution

#### Scenario: Custom domain is optional
- **WHEN** an environment has no `domain_name` configured
- **THEN** its distribution SHALL continue to serve via the default `*.cloudfront.net` URL and SHALL NOT configure an alias or custom certificate

### Requirement: TLS certificates are managed by ACM and validated via DNS
The system SHALL provision an AWS Certificate Manager certificate for the environment's custom domain and SHALL validate it using DNS records created in the environment's hosted zone. The distribution SHALL use that certificate (SNI-only) once validated.

#### Scenario: Certificate is DNS-validated before use
- **WHEN** a custom domain is configured for an environment
- **THEN** the system SHALL create an ACM certificate for that domain, create the required DNS validation records, and only attach the certificate to the distribution after validation succeeds

### Requirement: The hosted zone is referenced, not managed, by Terraform
The system SHALL look up the Route53 hosted zone by name via a data source and SHALL create DNS records within it, without creating, importing, or deleting the hosted zone itself. The hosted zone is created outside Terraform by Route53 domain registration.

#### Scenario: Records are created in the externally registered zone
- **WHEN** custom domain resources are applied
- **THEN** the validation records and the alias record SHALL be created in the hosted zone that was created by Route53 domain registration, and Terraform SHALL NOT manage the hosted zone resource

### Requirement: Certificate provisioning stays in the CloudFront-required region
The system SHALL provision ACM certificates in `us-east-1` (the region CloudFront requires), using the default AWS provider which is pinned to `us-east-1`.

#### Scenario: Certificate is in us-east-1
- **WHEN** an ACM certificate is provisioned for a distribution
- **THEN** the certificate SHALL reside in the `us-east-1` region regardless of the custom domain involved

