locals {
  # table_name and function_name mirror the main config's local.resource_name,
  # which equals the bucket name while name_prefix is empty. If name_prefix is
  # ever set, these must be updated to match or the roles will be scoped to
  # resources that do not exist.
  envs = {
    dev = {
      bucket        = var.dev_bucket_name
      workspace     = var.dev_workspace_name
      role_suffix   = "dev"
      table_name    = var.dev_bucket_name
      function_name = "${var.dev_bucket_name}-api"
    }
    prod = {
      bucket        = var.prod_bucket_name
      workspace     = var.prod_workspace_name
      role_suffix   = "prod"
      table_name    = var.prod_bucket_name
      function_name = "${var.prod_bucket_name}-api"
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

  statement {
    sid = "ManageACM"
    # ACM certificates are global; required in us-east-1 for CloudFront.
    actions = [
      "acm:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManageRoute53"
    # The hosted zone is created outside Terraform (Route53 registration), so
    # its ID is unknown at bootstrap time; Route53 access is account-scoped.
    actions = [
      "route53:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManageEnvTable"
    actions = [
      "dynamodb:*",
    ]
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${each.value.table_name}",
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${each.value.table_name}/index/*",
    ]
  }

  statement {
    sid = "ManageCognito"
    # User pool IDs are assigned by AWS and cannot be scoped at bootstrap time,
    # following the same pattern as CloudFront and Route53 above.
    actions = [
      "cognito-idp:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManageApiGateway"
    # API IDs are likewise assigned by AWS. apigateway:* covers the v2 (HTTP
    # API) control plane, which is addressed through the same service prefix.
    actions = [
      "apigateway:*",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ManageEnvFunction"
    actions = [
      "lambda:*",
    ]
    resources = [
      "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${each.value.function_name}",
      "arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${each.value.function_name}:*",
    ]
  }

  statement {
    sid = "ManageEnvLogGroups"
    actions = [
      "logs:*",
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${each.value.function_name}",
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${each.value.function_name}:*",
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/apigateway/${each.value.function_name}",
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/apigateway/${each.value.function_name}:*",
    ]
  }

  statement {
    sid = "DescribeLogGroups"
    # DescribeLogGroups enumerates log groups rather than acting on one, so the
    # authorization context carries no group ARN and the action cannot be
    # scoped — it must be granted on "*" or it fails for every group, including
    # ones this role owns. The Terraform provider calls it on every refresh of
    # aws_cloudwatch_log_group.
    #
    # This grants visibility of log group *names and metadata* account-wide. It
    # does not grant reading their contents: logs:GetLogEvents and
    # logs:FilterLogEvents are resource-scoped and stay limited to the two
    # groups above.
    actions   = ["logs:DescribeLogGroups"]
    resources = ["*"]
  }

  statement {
    sid = "PassLambdaExecutionRole"
    # The single IAM permission these roles hold, and deliberately not
    # iam:CreateRole or iam:PutRolePolicy: this role may attach the
    # pre-existing execution role to a Lambda function and nothing else. The
    # service condition stops it being passed to any other service.
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.lambda[each.key].arn]

    condition {
      test     = "StringEquals"
      variable = "iam:PassedToService"
      values   = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role_policy" "tfc" {
  for_each = local.envs
  name     = "manage-frontend-infra"
  role     = aws_iam_role.tfc[each.key].id
  policy   = data.aws_iam_policy_document.tfc_permissions[each.key].json
}
