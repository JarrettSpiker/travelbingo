locals {
  tags = {
    Project     = "travelbingo"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
  # When name_prefix is empty, resource_name == bucket_name, preserving the
  # names the existing dev resources were created with.
  resource_name = var.name_prefix != "" ? "${var.name_prefix}-${var.bucket_name}" : var.bucket_name
  # Custom domain is active only when both a domain and its hosting zone are set.
  use_custom_domain = var.domain_name != "" && var.hosted_zone_name != ""
  # Owner-private thumbnails live in their own bucket, kept separate from the
  # static-asset bucket so its public CloudFront delivery never applies. The name
  # mirrors infra/bootstrap/tfc-roles.tf's thumbnail_bucket_name; both derive
  # from the env's bucket name and must stay aligned.
  thumbnail_bucket_name = "${local.resource_name}-thumbnails"
}

resource "aws_s3_bucket" "frontend" {
  bucket = var.bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Owner-private card thumbnails. Read access is granted only through short-lived
# presigned GET URLs minted by the backend after requireCardRole authorizes the
# caller, so the bucket is fully private: public access block on, no OAC, no
# public bucket policy, and no CloudFront behaviour in front of it.
resource "aws_s3_bucket" "thumbnails" {
  bucket = local.thumbnail_bucket_name
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Belt-and-suspenders against orphaned uploads: a failed save mid-write could
# leave an incomplete multipart behind, and a bug could strand a noncurrent
# version if versioning is ever enabled. Both expire quickly.
resource "aws_s3_bucket_lifecycle_configuration" "thumbnails" {
  bucket = aws_s3_bucket.thumbnails.id

  rule {
    id     = "expire-incomplete-and-noncurrent"
    status = "Enabled"

    # Empty filter = the rule applies to every object in the bucket.
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }

    noncurrent_version_expiration {
      noncurrent_days = 1
    }
  }
}

resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${local.resource_name}-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

# Mandatory for /api/*: an edge-cached /api/cards or share response would be a
# cross-user data leak.
data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Also mandatory for /api/*: forwards Authorization through to the API while
# suppressing the viewer Host header, which API Gateway routing requires.
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_function" "spa_fallback" {
  name    = "${local.resource_name}-spa-fallback"
  runtime = "cloudfront-js-2.0"
  publish = true
  comment = "Serves index.html for app routes. Attached to the S3 behavior only."
  code    = file("${path.module}/cloudfront_function.js")
}

resource "aws_cloudfront_response_headers_policy" "frontend" {
  name = "${local.resource_name}-security-headers"

  security_headers_config {
    content_security_policy {
      override = true
      # The primary mitigation for the refresh token held in localStorage.
      #
      # 'unsafe-inline' is required for style-src because Radix writes inline
      # styles at runtime to position popovers, dropdowns, and dialogs. (It used
      # to be Emotion, via MUI; the frontend moved to Tailwind + shadcn/ui and
      # the requirement survived the change, so the value here did not.)
      #
      # It is deliberately absent from script-src, and that is load-bearing:
      # `src/lib/colorMode.ts` applies the stored theme from main.tsx rather
      # than from the inline <script> in index.html that would normally beat
      # first paint, precisely because such a script would be blocked here — and
      # blocked only in production, since this policy never applies in dev.
      #
      # img-src widens to the thumbnail bucket's S3 regional domain: card
      # thumbnails are read via short-lived presigned GET URLs that resolve
      # directly to S3 (routing through the API would be N invocations per
      # library render). The bucket name is environment-specific, so this is a
      # per-env literal rather than a broad wildcard.
      content_security_policy = join("; ", [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://${local.thumbnail_bucket_name}.s3.${var.aws_region}.amazonaws.com",
        "font-src 'self' data:",
        "connect-src 'self' https://${local.cognito_auth_domain}",
        "form-action 'self' https://${local.cognito_auth_domain}",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "object-src 'none'",
      ])
    }

    referrer_policy {
      override        = true
      referrer_policy = "no-referrer"
    }

    content_type_options {
      override = true
    }

    frame_options {
      override     = true
      frame_option = "DENY"
    }

    strict_transport_security {
      override                   = true
      access_control_max_age_sec = 31536000
      include_subdomains         = true
    }
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  price_class         = var.cloudfront_price_class
  aliases             = local.use_custom_domain ? [var.domain_name] : []
  tags                = local.tags

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "s3-frontend"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  origin {
    domain_name = replace(aws_apigatewayv2_api.api.api_endpoint, "https://", "")
    origin_id   = "api-gateway"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    target_origin_id           = "s3-frontend"
    viewer_protocol_policy     = "redirect-to-https"
    cache_policy_id            = data.aws_cloudfront_cache_policy.caching_optimized.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.frontend.id

    # The SPA fallback. Attached here and not distribution-wide, so API
    # responses are never rewritten into the app shell. See
    # cloudfront_function.js for why custom_error_response was removed.
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_fallback.arn
    }
  }

  ordered_cache_behavior {
    path_pattern     = "/api/*"
    target_origin_id = "api-gateway"

    allowed_methods = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods  = ["GET", "HEAD"]

    # https-only rather than redirect-to-https: a redirected POST would arrive
    # as a GET, which is a worse failure than a clear refusal.
    viewer_protocol_policy = "https-only"

    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id

    # No function_association and no response_headers_policy_id: API responses
    # pass through untouched, with their own status codes and bodies.
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = local.use_custom_domain ? false : true
    acm_certificate_arn            = local.use_custom_domain ? aws_acm_certificate_validation.frontend[0].certificate_arn : null
    ssl_support_method             = local.use_custom_domain ? "sni-only" : null
    minimum_protocol_version       = local.use_custom_domain ? "TLSv1.2_2021" : null
  }
}

data "aws_iam_policy_document" "frontend_bucket_policy" {
  statement {
    sid    = "AllowCloudFrontServicePrincipal"
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }

    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.frontend.arn}/*"]

    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.frontend.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  policy = data.aws_iam_policy_document.frontend_bucket_policy.json
}
