# Identity. Google is the only provider: no password storage, and no SES (so no
# domain verification, DKIM records, or sandbox-exit ticket). Cognito answers
# "who is this" and nothing else — every "may they read card X" decision is made
# in backend/src/auth.ts. See design.md.

locals {
  site_origin = var.domain_name != "" ? "https://${var.domain_name}" : ""

  # Deliberately derived from var.domain_name rather than the CloudFront domain
  # name. The distribution depends on the API, the API's authorizer depends on
  # the user pool client, so a client that depended on the distribution would
  # close a dependency cycle.
  auth_callback_urls = compact([
    local.site_origin != "" ? "${local.site_origin}/auth/callback" : "",
    var.environment == "dev" ? "http://localhost:5173/auth/callback" : "",
  ])

  auth_logout_urls = compact([
    local.site_origin,
    var.environment == "dev" ? "http://localhost:5173" : "",
  ])
}

resource "aws_cognito_user_pool" "app" {
  name = local.resource_name

  # Sign-up happens through Google, never directly against the pool.
  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 1
      max_length = 2048
    }
  }

  tags = local.tags

  # The `sub` claim is a partition key in DynamoDB. Recreating the pool would
  # change every sub, orphaning memberships while card data survives
  # unreachable. googleSubject is recorded on the profile item as the escape
  # hatch, but the real mitigation is not destroying this.
  lifecycle {
    prevent_destroy = true

    ignore_changes = [
      # Cognito rewrites schema entries on read; without this the pool shows a
      # perpetual diff and would be proposed for replacement.
      schema,
    ]
  }
}

resource "aws_cognito_user_pool_domain" "app" {
  domain       = var.cognito_domain_prefix != "" ? var.cognito_domain_prefix : local.resource_name
  user_pool_id = aws_cognito_user_pool.app.id
}

locals {
  # The hosted UI / token endpoint host. Non-secret by design: it appears in
  # every sign-in redirect, so it is a build-time VITE_* variable, not a secret.
  cognito_auth_domain = "${aws_cognito_user_pool_domain.app.domain}.auth.${var.aws_region}.amazoncognito.com"
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id  = aws_cognito_user_pool.app.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_oauth_client_id
    client_secret    = var.google_oauth_client_secret
    authorize_scopes = "openid email profile"
  }

  # Maps Google's claims onto the pool's attributes. `username` receives the
  # Google subject, which the backend records as googleSubject.
  attribute_mapping = {
    email    = "email"
    username = "sub"
  }
}

resource "aws_cognito_user_pool_client" "spa" {
  name         = "${local.resource_name}-spa"
  user_pool_id = aws_cognito_user_pool.app.id

  # Public client: a browser cannot keep a secret, so authorization-code with
  # PKCE is used instead. generate_secret must stay false.
  generate_secret = false

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["openid", "email", "profile"]
  supported_identity_providers         = ["Google"]

  callback_urls = local.auth_callback_urls
  logout_urls   = local.auth_logout_urls

  # Refresh tokens live in localStorage; access and ID tokens stay in memory.
  # One hour bounds the damage from a leaked access token, and revocation on
  # sign-out is what invalidates the refresh token. The refresh window is kept
  # short (7 days) so that an exfiltrated refresh token — the worst case if an
  # XSS ever bypasses the CSP — ages out quickly rather than lasting a month.
  access_token_validity  = 1
  id_token_validity      = 1
  refresh_token_validity = 7

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  enable_token_revocation = true

  # Prod gets refresh only: there are no passwords in this pool, and Google is
  # the only way in.
  #
  # Dev additionally allows ADMIN_USER_PASSWORD_AUTH so that test users can be
  # created and authenticated from the CLI without a Google account — see
  # scripts/dev-user.sh. This is not a public password login:
  # AdminInitiateAuth is an IAM-authorized API, so it is reachable only by
  # someone who already holds admin credentials for this AWS account and who
  # therefore gains nothing new. supported_identity_providers stays ["Google"]
  # above, so the hosted UI still offers only the Google button to the internet.
  #
  # Prod must never get this flow.
  explicit_auth_flows = var.environment == "dev" ? [
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_ADMIN_USER_PASSWORD_AUTH",
  ] : ["ALLOW_REFRESH_TOKEN_AUTH"]

  prevent_user_existence_errors = "ENABLED"

  depends_on = [aws_cognito_identity_provider.google]
}
