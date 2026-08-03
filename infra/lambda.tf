# Backend compute. Terraform provisions the function; GitHub Actions ships the
# code — mirroring the frontend split, and keeping a backend bugfix off the
# manual prod-apply path.

locals {
  function_name = "${local.resource_name}-api"
}

# Placeholder so the function can be created before any code exists. It is
# replaced on the first `aws lambda update-function-code`, and never again by
# Terraform (see ignore_changes below).
data "archive_file" "placeholder" {
  type        = "zip"
  output_path = "${path.module}/.terraform/placeholder.zip"

  source {
    filename = "index.mjs"
    content  = <<-EOT
      export const handler = async () => ({
        statusCode: 503,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ error: "not_deployed" }),
      });
    EOT
  }
}

# Created explicitly rather than implicitly by the first invocation, so that the
# retention period is enforced. CloudWatch Logs defaults to never expiring and
# can quietly become the largest line item on a project this size. The execution
# role deliberately lacks logs:CreateLogGroup to keep it that way.
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${local.function_name}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_lambda_function" "api" {
  function_name = local.function_name
  role          = var.lambda_execution_role_arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 10

  filename         = data.archive_file.placeholder.output_path
  source_code_hash = data.archive_file.placeholder.output_base64sha256

  # Abuse, not usage, is the cost risk here. This is the ceiling on what a
  # runaway loop or a scripted attack can spend.
  reserved_concurrent_executions = 10

  environment {
    variables = {
      TABLE_NAME = aws_dynamodb_table.app.name
    }
  }

  tags = local.tags

  depends_on = [aws_cloudwatch_log_group.lambda]

  lifecycle {
    # GitHub Actions owns the code. Without this, every apply would roll the
    # function back to the placeholder.
    ignore_changes = [
      filename,
      source_code_hash,
    ]
  }
}
