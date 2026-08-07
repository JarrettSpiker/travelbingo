import { getUserId } from "./auth.ts";
import type { Deps } from "./context.ts";
import { badRequest, errorResponse, HttpError, json, type JsonResponse } from "./http.ts";
import type { RouteRequest } from "./request.ts";
import { createCard, deleteCard, getCard, listCards, renameCard, replaceCard } from "./routes/cards.ts";
import { getProfile, updateProfile } from "./routes/profile.ts";
import { createShare, listShares, resolveShare, revokeShare } from "./routes/shares.ts";

/**
 * The reachable bound on request size. The per-field limits in cardPayload.ts
 * constrain a *valid* card; this constrains what an attacker can make the
 * runtime parse before validation gets a chance to run. Sized to admit a card
 * payload plus a base64 thumbnail (the two ride the same save request), well
 * under API Gateway HTTP API's 10MB body limit.
 */
export const MAX_BODY_BYTES = 1024 * 1024;

type Handler = (deps: Deps, request: RouteRequest) => Promise<JsonResponse>;

interface Route {
  handler: Handler;
  /**
   * Mirrors the API Gateway route configuration, where this route carries no
   * authorizer. Every other route is rejected by the authorizer before this
   * code runs; the flag exists so the public surface is visible in one list
   * rather than inferred from Terraform.
   */
  public?: boolean;
}

// Keys match API Gateway's routeKey format, including the /api prefix. CloudFront
// can prepend a path prefix but never strip one, so the prefix is real here.
const ROUTES: Record<string, Route> = {
  "GET /api/cards": { handler: listCards },
  "POST /api/cards": { handler: createCard },
  "GET /api/cards/{cardId}": { handler: getCard },
  "PUT /api/cards/{cardId}": { handler: replaceCard },
  "PATCH /api/cards/{cardId}": { handler: renameCard },
  "DELETE /api/cards/{cardId}": { handler: deleteCard },
  "GET /api/cards/{cardId}/shares": { handler: listShares },
  "POST /api/cards/{cardId}/shares": { handler: createShare },
  "DELETE /api/cards/{cardId}/shares/{token}": { handler: revokeShare },
  "GET /api/me/profile": { handler: getProfile },
  "PUT /api/me/profile": { handler: updateProfile },
  "GET /api/shares/{token}": { handler: resolveShare, public: true },
};

export interface ApiEvent {
  routeKey?: string;
  rawPath?: string;
  body?: string;
  isBase64Encoded?: boolean;
  pathParameters?: Record<string, string | undefined> | null;
  requestContext?: {
    authorizer?: { jwt?: { claims?: Record<string, unknown> } };
  };
}

function parseBody(event: ApiEvent): unknown {
  if (!event.body) return undefined;

  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;

  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    throw badRequest("request body is too large");
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("request body must be valid JSON");
  }
}

function cleanParams(params: Record<string, string | undefined> | null | undefined) {
  const cleaned: Record<string, string> = {};
  for (const [key, value] of Object.entries(params ?? {})) {
    if (typeof value === "string") cleaned[key] = value;
  }
  return cleaned;
}

export async function route(deps: Deps, event: ApiEvent): Promise<JsonResponse> {
  try {
    const routeKey = event.routeKey ?? "";
    const match = ROUTES[routeKey];
    if (!match) {
      // Not the SPA fallback's job: an unknown API path is a JSON 404, never
      // the app shell. CloudFront leaves /api/* responses untouched.
      return json(404, { error: "not_found" });
    }

    const request: RouteRequest = {
      userId: match.public ? null : getUserId(event.requestContext?.authorizer?.jwt?.claims),
      params: cleanParams(event.pathParameters),
      body: parseBody(event),
    };

    return await match.handler(deps, request);
  } catch (error) {
    if (error instanceof HttpError) {
      return errorResponse(error);
    }

    // Deliberately opaque to the caller, and logged without the request body,
    // which could contain card text.
    console.error("unhandled error", {
      routeKey: event.routeKey,
      name: error instanceof Error ? error.name : "unknown",
      message: error instanceof Error ? error.message : String(error),
    });

    return json(500, { error: "internal_error" });
  }
}
