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

variable "environments" {
  description = <<-EOT
    Every deploy environment, keyed by an id that is part of the IAM role
    address. Two per brand: <brand>-dev and <brand>-prod.

    THE KEYS ARE LOAD-BEARING. `for_each` keys are part of the resource address
    (`aws_iam_role.tfc["dev"]`), so renaming one destroys and recreates the
    role. The existing role ARNs are pasted into HCP workspace configuration
    and GitHub Environment variables, so a recreate breaks every running
    deploy. The travel entries stay keyed `dev` and `prod` — not
    `travel-dev`/`travel-prod` — for exactly that reason, and adding a brand
    must show a plan of additions only.

    Fields:
      bucket             - the environment's S3 bucket. It is also the whole
                           discriminator for every other resource: the main
                           module derives the DynamoDB table, Cognito pool,
                           Lambda, API, and thumbnail bucket names from it.
      workspace          - HCP Terraform workspace, matched in the OIDC subject
                           claim. Must be in the project named by
                           `hcp_project_name`: the project name is embedded in
                           that claim, so a workspace elsewhere silently cannot
                           assume its role.
      role_name_prefix   - leading segment of the three IAM role names
                           (`<prefix>-{tfc,gha,lambda}-<key>`). Renaming a live
                           role breaks the deploys that assume it.
      github_environment - the GitHub Environment this maps to, matched in the
                           Actions OIDC subject claim.

    `github_environment` is an explicit field rather than a reuse of the map
    key, even though the two are equal for every entry today. They were equal by
    coincidence — `gha-roles.tf` built the subject from `each.key` while
    `tfc-roles.tf` built role names from a separate suffix — and an entry where
    they diverged would produce a role that nothing can assume, with no error
    until a deploy fails at the assume step.
  EOT
  type = map(object({
    bucket             = string
    workspace          = string
    role_name_prefix   = string
    github_environment = string
  }))
  default = {
    dev = {
      bucket             = "travelbingo-dev"
      workspace          = "travelbingo-dev"
      role_name_prefix   = "travelbingo"
      github_environment = "dev"
    }
    prod = {
      bucket             = "travelbingo-prod"
      workspace          = "travelbingo-prod"
      role_name_prefix   = "travelbingo"
      github_environment = "prod"
    }
    office-dev = {
      bucket             = "officelingobingo-dev"
      workspace          = "officelingobingo-dev"
      role_name_prefix   = "olbingo"
      github_environment = "office-dev"
    }
    office-prod = {
      bucket             = "officelingobingo-prod"
      workspace          = "officelingobingo-prod"
      role_name_prefix   = "olbingo"
      github_environment = "office-prod"
    }
  }
}
