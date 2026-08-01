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
