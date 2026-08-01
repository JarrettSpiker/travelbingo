variable "aws_region" {
  description = "AWS region. Used for the provider default; IAM/OIDC resources are global."
  type        = string
  default     = "us-east-1"
}

variable "github_org" {
  description = "GitHub user/organization that owns the repository."
  type        = string
  default     = "JarrettSpiker"
}

variable "github_repo" {
  description = "GitHub repository name."
  type        = string
  default     = "travelbingo"
}

variable "hcp_organization_name" {
  description = "HCP Terraform organization name."
  type        = string
}

variable "hcp_project_name" {
  description = "HCP Terraform project name. Part of the dynamic-credential subject claim. Use \"Default\" if you have no custom project."
  type        = string
  default     = "Default"
}

variable "dev_workspace_name" {
  description = "HCP Terraform workspace name for the dev environment."
  type        = string
  default     = "travelbingo-dev"
}

variable "prod_workspace_name" {
  description = "HCP Terraform workspace name for the prod environment."
  type        = string
  default     = "travelbingo-prod"
}

variable "dev_bucket_name" {
  description = "S3 bucket name for the dev environment. Used to scope the deploy roles."
  type        = string
  default     = "travelbingo-dev"
}

variable "prod_bucket_name" {
  description = "S3 bucket name for the prod environment. Used to scope the deploy roles."
  type        = string
  default     = "travelbingo-prod"
}
