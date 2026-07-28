variable "aws_region" {
  description = "AWS region to provision the S3 bucket in."
  type        = string
  default     = "us-east-1"
}

variable "bucket_name" {
  description = "Globally-unique S3 bucket name to hold the built frontend assets."
  type        = string
}

variable "environment" {
  description = "Environment name, used for tagging."
  type        = string
  default     = "production"
}

variable "domain_name" {
  description = "Optional custom domain (e.g. bingo.example.com) to serve the app on. Leave empty to use the default CloudFront domain."
  type        = string
  default     = ""
}

variable "hosted_zone_id" {
  description = "Route53 hosted zone ID for domain_name. Required only if domain_name is set and you want Terraform to manage DNS validation and the alias record automatically."
  type        = string
  default     = ""
}

variable "cloudfront_price_class" {
  description = "CloudFront price class. PriceClass_100 covers North America and Europe only, and is the cheapest option."
  type        = string
  default     = "PriceClass_100"
}
