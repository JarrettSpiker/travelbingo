# HTTP API fronting the backend Lambda, reached same-origin via CloudFront at
# /api/*. Routes are declared explicitly rather than with $default, because
# per-route authorizer control is what lets the public share-resolution route
# skip the JWT authorizer while everything else requires it.

locals {
  # Declared *with* the /api prefix. CloudFront's origin_path can prepend a
  # prefix but never strip one, so the alternative is a second CloudFront
  # Function whose only job is rewriting the URI. This way console paths and
  # browser paths are identical.
  public_share_route = "GET /api/shares/{token}"

  api_routes = {
    "GET /api/cards"                            = { authorized = true }
    "POST /api/cards"                           = { authorized = true }
    "GET /api/cards/{cardId}"                   = { authorized = true }
    "PUT /api/cards/{cardId}"                   = { authorized = true }
    "PATCH /api/cards/{cardId}"                 = { authorized = true }
    "DELETE /api/cards/{cardId}"                = { authorized = true }
    "GET /api/cards/{cardId}/shares"            = { authorized = true }
    "POST /api/cards/{cardId}/shares"           = { authorized = true }
    "DELETE /api/cards/{cardId}/shares/{token}" = { authorized = true }
    "GET /api/me/profile"                       = { authorized = true }
    "PUT /api/me/profile"                       = { authorized = true }
    (local.public_share_route)                  = { authorized = false }
  }
}

resource "aws_apigatewayv2_api" "api" {
  name          = local.function_name
  protocol_type = "HTTP"
  tags          = local.tags

  # No CORS configuration: the browser reaches this through the same
  # distribution that served the app, so requests are same-origin.
}

# Validates signature, issuer, audience, and expiry before the Lambda is
# invoked at all. An unauthenticated request to a protected route never reaches
# application code.
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "${local.function_name}-cognito"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.spa.id]
    issuer   = "https://${aws_cognito_user_pool.app.endpoint}"
  }
}

resource "aws_apigatewayv2_integration" "lambda" {
  api_id                 = aws_apigatewayv2_api.api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.api.invoke_arn
  payload_format_version = "2.0"
  timeout_milliseconds   = 10000
}

resource "aws_apigatewayv2_route" "routes" {
  for_each = local.api_routes

  api_id    = aws_apigatewayv2_api.api.id
  route_key = each.key
  target    = "integrations/${aws_apigatewayv2_integration.lambda.id}"

  authorization_type = each.value.authorized ? "JWT" : "NONE"
  authorizer_id      = each.value.authorized ? aws_apigatewayv2_authorizer.cognito.id : null
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/apigateway/${local.function_name}"
  retention_in_days = 14
  tags              = local.tags
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.api.id
  name        = "$default"
  auto_deploy = true
  tags        = local.tags

  # route_settings below names a route by key, but the stage only references
  # the API id — so Terraform sees no dependency on the routes themselves and
  # is free to create the stage first, at which point API Gateway rejects the
  # settings with "Unable to find Route by key".
  depends_on = [aws_apigatewayv2_route.routes]

  default_route_settings {
    throttling_rate_limit  = 20
    throttling_burst_limit = 40
  }

  # Stricter still on the one route reachable without an account. Share tokens
  # carry 128 bits of entropy, so this is a cost control rather than a secrecy
  # control — guessing is already infeasible.
  route_settings {
    route_key              = local.public_share_route
    throttling_rate_limit  = 5
    throttling_burst_limit = 10
  }

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn

    # Deliberately omits headers and bodies: no Authorization value, no share
    # token, and no card text is ever written to logs.
    format = jsonencode({
      requestId      = "$context.requestId"
      httpMethod     = "$context.httpMethod"
      routeKey       = "$context.routeKey"
      status         = "$context.status"
      responseLength = "$context.responseLength"
      requestTime    = "$context.requestTime"
      integrationErr = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_lambda_permission" "api" {
  statement_id  = "AllowExecutionFromApiGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.api.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.api.execution_arn}/*/*"
}
