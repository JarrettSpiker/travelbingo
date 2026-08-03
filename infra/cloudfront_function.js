// Single-page-app fallback, attached as a viewer-request function to the S3
// behavior only.
//
// This replaces a distribution-wide custom_error_response that never actually
// worked: it mapped 404 -> /index.html, but the bucket policy grants only
// s3:GetObject with no s3:ListBucket, so S3 answers 403 for a missing key.
// Nothing noticed because the app had no routes.
//
// A viewer-request function attaches per-behavior, which matters more now than
// the 403 fix does: custom_error_response cannot be scoped to a cache
// behavior, so once /api/* shares this distribution it would have rewritten
// API errors into 200 + index.html — turning authorization denials into
// apparent successes.
//
// The rule: a path whose last segment has no dot is an app route, so serve the
// shell and let the client render it. A path that looks like a file is left
// alone, so a missing asset fails as a missing asset instead of being
// disguised as the app.
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  var lastSegment = uri.substring(uri.lastIndexOf("/") + 1);

  if (lastSegment.indexOf(".") === -1) {
    request.uri = "/index.html";
  }

  return request;
}
