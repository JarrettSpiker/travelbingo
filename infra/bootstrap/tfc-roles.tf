locals {
  envs = {
    dev = {
      bucket      = var.dev_bucket_name
      workspace   = var.dev_workspace_name
      role_suffix = "dev"
    }
    prod = {
      bucket      = var.prod_bucket_name
      workspace   = var.prod_workspace_name
      role_suffix = "prod"
    }
  }
}

# Trust policies + permissions for the two HCP Terraform deploy roles.
# HCP assumes these per run via dynamic provider credentials.

data "aws_iam_policy_document" "tfc_assume" {
  for_each = local.envs

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.hcp.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "app.terraform.io:aud"
      values   = ["aws.workload.identity"]
    }
    condition {
      test     = "StringLike"
      variable = "app.terraform.io:sub"
      values = [
        "organization:${var.hcp_organization_name}:project:${var.hcp_project_name}:workspace:${each.value.workspace}:*"
      ]
    }
  }
}

resource "aws_iam_role" "tfc" {
  for_each           = local.envs
  name               = "travelbingo-tfc-${each.value.role_suffix}"
  assume_role_policy = data.aws_iam_policy_document.tfc_assume[each.key].json
}

data "aws_iam_policy_document" "tfc_permissions" {
  for_each = local.envs

  statement {
    sid = "ManageEnvBucket"
    actions = [
      "s3:*",
    ]
    resources = [
      "arn:aws:s3:::${each.value.bucket}",
      "arn:aws:s3:::${each.value.bucket}/*",
    ]
  }

  statement {
    sid = "ManageCloudFront"
    # CloudFront distribution IDs are assigned by AWS and cannot be scoped per
    # environment at bootstrap time, so CloudFront access is account-scoped.
    actions = [
      "cloudfront:*",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "tfc" {
  for_each = local.envs
  name     = "manage-frontend-infra"
  role     = aws_iam_role.tfc[each.key].id
  policy   = data.aws_iam_policy_document.tfc_permissions[each.key].json
}
