# Execution roles assumed by the backend Lambda at runtime, one per environment.
#
# These live in bootstrap rather than the main config on purpose. If the main
# config created them, the HCP Terraform roles would need iam:CreateRole and
# iam:PutRolePolicy — which would let a VCS-triggered auto-apply workspace
# attach an arbitrary inline policy to a role it creates, making it effectively
# an administrator. Creating them here instead means the tfc roles need only
# iam:PassRole on a single ARN (see tfc-roles.tf).

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "lambda" {
  for_each           = local.envs
  name               = "travelbingo-lambda-${each.value.role_suffix}"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

data "aws_iam_policy_document" "lambda_permissions" {
  for_each = local.envs

  statement {
    sid = "EnvTableItems"
    # Item-level operations only: the function never creates, alters, or
    # deletes the table itself. That remains Terraform's job.
    actions = [
      "dynamodb:GetItem",
      "dynamodb:BatchGetItem",
      "dynamodb:Query",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:BatchWriteItem",
      "dynamodb:ConditionCheckItem",
      "dynamodb:TransactGetItems",
      "dynamodb:TransactWriteItems",
    ]
    resources = [
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${each.value.table_name}",
      "arn:aws:dynamodb:${var.aws_region}:${data.aws_caller_identity.current.account_id}:table/${each.value.table_name}/index/*",
    ]
  }

  statement {
    sid = "WriteOwnLogs"
    # Deliberately no logs:CreateLogGroup. The main config creates the group so
    # that its retention period is enforced; if the function could create it
    # implicitly, the group would default to never expiring.
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      "arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/aws/lambda/${each.value.function_name}:*",
    ]
  }

  statement {
    sid = "ManageOwnThumbnails"
    # Object-level access only for card thumbnails: the function writes them on
    # save, reads them to mint presigned GET URLs, and deletes them with the
    # card. It never touches the bucket itself — Terraform owns that.
    actions = [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject",
    ]
    resources = [
      "arn:aws:s3:::${each.value.thumbnail_bucket_name}/*",
    ]
  }
}

resource "aws_iam_role_policy" "lambda" {
  for_each = local.envs
  name     = "backend-runtime"
  role     = aws_iam_role.lambda[each.key].id
  policy   = data.aws_iam_policy_document.lambda_permissions[each.key].json
}
