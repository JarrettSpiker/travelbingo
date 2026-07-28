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
  value       = local.use_custom_domain ? "https://${var.domain_name}" : "https://${aws_cloudfront_distribution.frontend.domain_name}"
}
