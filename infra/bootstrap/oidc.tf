locals {
  github_oidc_url = "https://token.actions.githubusercontent.com"
  hcp_oidc_url    = "https://app.terraform.io"
}

# AWS validates the full certificate chain of the IdP, so the thumbprint here
# is supplemental. We compute it from the issuer's TLS cert to stay current.
data "tls_certificate" "github" {
  url = local.github_oidc_url
}

data "tls_certificate" "hcp" {
  url = local.hcp_oidc_url
}

resource "aws_iam_openid_connect_provider" "github" {
  url             = local.github_oidc_url
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github.certificates[0].sha1_fingerprint]
}

resource "aws_iam_openid_connect_provider" "hcp" {
  url             = local.hcp_oidc_url
  client_id_list  = ["aws.workload.identity"]
  thumbprint_list = [data.tls_certificate.hcp.certificates[0].sha1_fingerprint]
}
