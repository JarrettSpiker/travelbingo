## MODIFIED Requirements

### Requirement: The hosted zone is referenced, not managed, by Terraform
The system SHALL look up the Route53 hosted zone by name via a data source and SHALL create DNS records within it, without creating, importing, or deleting the hosted zone itself. The hosted zone is created outside Terraform by Route53 domain registration. Records created within it SHALL include the certificate-validation records, the distribution alias record, and the records that authenticate the environment's outbound mail — its sending-domain signing records and its sender records. Adding a further kind of record to the zone SHALL NOT change the fact that the zone itself is referenced rather than managed.

#### Scenario: Records are created in the externally registered zone
- **WHEN** custom domain resources are applied
- **THEN** the validation records and the alias record SHALL be created in the hosted zone that was created by Route53 domain registration, and Terraform SHALL NOT manage the hosted zone resource

#### Scenario: Mail authentication records are created in the same zone
- **WHEN** an environment is configured to send mail from its domain
- **THEN** the signing and sender records that authenticate that mail SHALL be created in the same referenced hosted zone, and Terraform SHALL still NOT manage the hosted zone resource

#### Scenario: An environment with no domain gets no mail records
- **WHEN** an environment has no `domain_name` configured
- **THEN** the system SHALL create no mail authentication records for it
