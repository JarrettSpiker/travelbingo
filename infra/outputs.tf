output "bucket_name" {
  description = "S3 bucket holding the built frontend assets."
  value       = aws_s3_bucket.frontend.bucket
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution ID (useful for cache invalidations after deploys)."
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_domain_name" {
  description = "Default CloudFront domain (*.cloudfront.net) serving the app."
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "site_url" {
  description = "URL the app is served at."
  value       = "https://${aws_cloudfront_distribution.frontend.domain_name}"
}

output "dynamodb_table_name" {
  description = "Single table holding all account data."
  value       = aws_dynamodb_table.app.name
}

output "lambda_function_name" {
  description = "Backend function name. Set as the GitHub Environment variable LAMBDA_FUNCTION_NAME."
  value       = aws_lambda_function.api.function_name
}

output "api_gateway_endpoint" {
  description = "Direct HTTP API endpoint. The app does not use this — it calls /api/* same-origin through CloudFront — but it is useful for debugging."
  value       = aws_apigatewayv2_api.api.api_endpoint
}

output "cognito_user_pool_id" {
  description = "Cognito user pool ID."
  value       = aws_cognito_user_pool.app.id
}

output "cognito_user_pool_client_id" {
  description = "Public SPA client ID. Non-secret (visible in every sign-in redirect). Set as the GitHub Environment variable VITE_COGNITO_CLIENT_ID."
  value       = aws_cognito_user_pool_client.spa.id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain. Set as the GitHub Environment variable VITE_COGNITO_DOMAIN."
  value       = local.cognito_auth_domain
}
