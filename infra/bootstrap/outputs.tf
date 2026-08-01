output "tfc_role_arns" {
  description = "HCP Terraform deploy role ARNs (for dynamic provider credentials), keyed by environment."
  value       = { for k, r in aws_iam_role.tfc : k => r.arn }
}

output "gha_role_arns" {
  description = "GitHub Actions deploy role ARNs (set on the GitHub Environments), keyed by environment."
  value       = { for k, r in aws_iam_role.gha : k => r.arn }
}

output "github_oidc_provider_arn" {
  description = "ARN of the GitHub Actions OIDC identity provider."
  value       = aws_iam_openid_connect_provider.github.arn
}

output "hcp_oidc_provider_arn" {
  description = "ARN of the HCP Terraform OIDC identity provider."
  value       = aws_iam_openid_connect_provider.hcp.arn
}
