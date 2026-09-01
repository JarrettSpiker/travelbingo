variable "aws_region" {
  description = "AWS region to provision the S3 bucket in."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Globally-unique S3 bucket name to hold the built frontend assets."
  type        = string
}

variable "name_prefix" {
  description = "Optional prefix applied to named resources (e.g. the CloudFront OAC). Defaults to none; the bucket name already differentiates environments."
  type        = string
  default     = ""
}

variable "brand" {
  description = <<-EOT
    Which brand this stack serves. Used for the `Project` cost-allocation tag
    and nothing else.

    Deliberately NOT part of `local.resource_name`. That name is the DynamoDB
    table and the Cognito user pool, both of which carry `prevent_destroy`, so
    changing the formula hard-fails the existing prod apply — and forcing past
    it would change every `sub` and orphan every saved card. `bucket_name` is
    the discriminator; every other resource name already falls out of it, which
    is why a second brand needs no new Terraform here at all.
  EOT
  type        = string
  default     = "travelbingo"
}

variable "environment" {
  description = <<-EOT
    Which of the two environments this stack is. NOT just a tag: three
    behaviours branch on it — the Cognito ALLOW_ADMIN_USER_PASSWORD_AUTH flow,
    the localhost callback URL, and DynamoDB deletion protection.

    A value outside this set silently gets prod-like Cognito flows and NO
    deletion protection, which is why it is validated rather than free text.
    Brand is a separate axis and is carried by `bucket_name`; an `office-dev`
    here would be exactly that silent failure.
  EOT
  type        = string
  default     = "prod"

  validation {
    # The old default was "production", which no comparison in this config ever
    # matched: `dynamodb.tf` gates deletion protection on `== "prod"`. Any
    # workspace that did not set this explicitly was running production data
    # with deletion protection OFF. This validation is what surfaces that.
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "environment must be exactly \"dev\" or \"prod\"."
  }
}

variable "cloudfront_price_class" {
  description = "CloudFront price class. PriceClass_100 covers North America and Europe only, and is the cheapest option."
  type        = string
  default     = "PriceClass_100"
}

variable "domain_name" {
  description = "Custom domain for the CloudFront distribution (e.g. dev.travelbingo.ca). Leave empty to use the default *.cloudfront.net URL."
  type        = string
  default     = ""
}

variable "hosted_zone_name" {
  description = "Name of the Route53 hosted zone that hosts domain_name (e.g. travelbingo.ca). Required when domain_name is set."
  type        = string
  default     = ""
}

variable "google_oauth_client_id" {
  description = "Google OAuth 2.0 Web client ID for this environment. Set as a sensitive HCP workspace variable; each environment uses its own client."
  type        = string
  sensitive   = true
}

variable "google_oauth_client_secret" {
  description = "Google OAuth 2.0 Web client secret for this environment. Set as a sensitive HCP workspace variable; never committed and never stored in GitHub."
  type        = string
  sensitive   = true
}

variable "lambda_execution_role_arn" {
  description = "ARN of the backend Lambda execution role, created by infra/bootstrap. Taken from its lambda_execution_role_arns output. Created there so this config needs only iam:PassRole, not iam:CreateRole."
  type        = string
}

variable "lambda_reserved_concurrency" {
  description = "Reserved concurrent executions for the backend function. -1 leaves it unreserved. AWS rejects any reservation that would leave the account's unreserved pool below 100, so this stays -1 until the account's concurrency limit is raised. API Gateway stage throttling is the primary cost control regardless."
  type        = number
  default     = -1
}

variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito hosted domain (<prefix>.auth.<region>.amazoncognito.com). Prefixes are globally unique per region and availability is only confirmed at apply time, so this is a variable: on a collision, change it here and update the redirect URI in the Google OAuth client. Defaults to the environment's resource name."
  type        = string
  default     = ""
}
