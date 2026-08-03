# Single table for all account data. Entities are distinguished by key prefix
# (CARD#, USER#, SHARE#) rather than by table, so a new entity type costs no
# Terraform, IAM, or deploy change. See design.md for the access-pattern map,
# which is a maintained artifact: any new entity or query belongs there.

resource "aws_dynamodb_table" "app" {
  name         = local.resource_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "PK"
  range_key    = "SK"

  attribute {
    name = "PK"
    type = "S"
  }

  attribute {
    name = "SK"
    type = "S"
  }

  # Configured but unused: share links do not expire today, and revocation is
  # the control. Wiring it now means optional expiry needs no migration. A read
  # path that ever sets expiresAt must also check it — TTL deletion is
  # best-effort and can lag by up to 48 hours.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = var.environment == "prod"

  tags = local.tags

  # This is the project's first stateful surface. Everything before it was
  # reproducible from git; this is not.
  lifecycle {
    prevent_destroy = true
  }
}
