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

variable "environment" {
  description = "Environment name, used for tagging."
  type        = string
  default     = "production"
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

variable "cognito_domain_prefix" {
  description = "Prefix for the Cognito hosted domain (<prefix>.auth.<region>.amazoncognito.com). Prefixes are globally unique per region and availability is only confirmed at apply time, so this is a variable: on a collision, change it here and update the redirect URI in the Google OAuth client. Defaults to the environment's resource name."
  type        = string
  default     = ""
}
