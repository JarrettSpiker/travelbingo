export interface JsonResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

/**
 * An error with an HTTP status attached. Thrown by route handlers and turned
 * into a response by the router, so handlers never assemble responses for the
 * failure paths.
 */
export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message?: string) {
    super(message ?? code);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * The single "no" response. Absence of a membership and absence of the resource
 * must be indistinguishable — returning 403 for "exists but not yours" would
 * confirm that another user's card id is real. See auth.ts.
 */
export function notFound(): HttpError {
  return new HttpError(404, "not_found");
}

export function forbidden(): HttpError {
  return new HttpError(403, "forbidden");
}

export function badRequest(message: string): HttpError {
  return new HttpError(400, "bad_request", message);
}

export function unauthorized(): HttpError {
  return new HttpError(401, "unauthorized");
}

/**
 * A per-account cap was reached. Distinct from badRequest because the client
 * has to tell these apart: "what you sent is wrong, fix it and retry" and "what
 * you sent was fine, you have simply sent enough for now" call for different
 * words, and a caller cannot infer which from a 400.
 */
export function tooManyRequests(code: string, message?: string): HttpError {
  return new HttpError(429, code, message);
}

// no-store belongs on every response, not just share resolutions: these are
// per-user documents, and CloudFront's Managed-CachingDisabled policy on
// /api/* is the other half of the same guarantee.
const BASE_HEADERS: Record<string, string> = {
  "content-type": "application/json",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
};

export function json(statusCode: number, body: unknown): JsonResponse {
  return {
    statusCode,
    headers: { ...BASE_HEADERS },
    body: JSON.stringify(body),
  };
}

export function noContent(): JsonResponse {
  return { statusCode: 204, headers: { ...BASE_HEADERS }, body: "" };
}

export function errorResponse(error: HttpError): JsonResponse {
  return json(error.statusCode, {
    error: error.code,
    ...(error.code === "bad_request" && error.message !== error.code
      ? { message: error.message }
      : {}),
  });
}
