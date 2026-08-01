# Trust policies + permissions for the two GitHub Actions deploy roles.
# GitHub Actions assumes these via OIDC during the app build/deploy workflow.

data "aws_iam_policy_document" "gha_assume" {
  for_each = local.envs

  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      # Repositories created after 2026-07-15 use GitHub's immutable subject
      # format, which appends @<owner-id> and @<repo-id> to the owner/repo
      # segment. Match both the legacy and immutable formats; the IDs are
      # matched with wildcards (owner/repo names are unique).
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values = [
        "repo:${var.github_org}/${var.github_repo}:environment:${each.key}",
        "repo:${var.github_org}@*/${var.github_repo}@*:environment:${each.key}",
      ]
    }
  }
}

resource "aws_iam_role" "gha" {
  for_each           = local.envs
  name               = "travelbingo-gha-${each.value.role_suffix}"
  assume_role_policy = data.aws_iam_policy_document.gha_assume[each.key].json
}

data "aws_iam_policy_document" "gha_permissions" {
  for_each = local.envs

  statement {
    sid       = "ListEnvBucket"
    actions   = ["s3:ListBucket"]
    resources = ["arn:aws:s3:::${each.value.bucket}"]
  }

  statement {
    sid       = "ReadWriteEnvBucketObjects"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${each.value.bucket}/*"]
  }

  statement {
    sid = "InvalidateCloudFront"
    # Distribution ID is unpredictable at bootstrap time, so account-scoped.
    actions = [
      "cloudfront:CreateInvalidation",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "gha" {
  for_each = local.envs
  name     = "deploy-frontend"
  role     = aws_iam_role.gha[each.key].id
  policy   = data.aws_iam_policy_document.gha_permissions[each.key].json
}
