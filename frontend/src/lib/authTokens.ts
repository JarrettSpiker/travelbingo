import type { AuthConfig } from "../config";
import { expiresAtFrom, redirectUri, tokenEndpoint } from "./auth";

// The two calls to Cognito's token endpoint. Kept out of auth.ts so that file
// stays free of I/O, and out of AuthProvider so the request shapes are testable.

export interface TokenSet {
  accessToken: string;
  idToken: string | null;
  /** Absent on a refresh — Cognito returns a new refresh token only at sign-in. */
  refreshToken: string | null;
  expiresAt: number;
}

function parseTokenResponse(body: unknown, now: number): TokenSet | null {
  if (typeof body !== "object" || body === null) return null;
  const raw = body as Record<string, unknown>;

  if (typeof raw.access_token !== "string" || raw.access_token === "") return null;
  const expiresIn = typeof raw.expires_in === "number" ? raw.expires_in : 3600;

  return {
    accessToken: raw.access_token,
    idToken: typeof raw.id_token === "string" ? raw.id_token : null,
    refreshToken: typeof raw.refresh_token === "string" ? raw.refresh_token : null,
    expiresAt: expiresAtFrom(expiresIn, now),
  };
}

async function postForm(
  config: AuthConfig,
  params: Record<string, string>,
  fetchImpl: typeof fetch,
  now: number,
): Promise<TokenSet | null> {
  const response = await fetchImpl(tokenEndpoint(config), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
    // A public client has no secret to send, and Cognito's token endpoint is
    // cross-origin, so no credentials are involved either way.
    credentials: "omit",
  });

  if (!response.ok) return null;

  try {
    return parseTokenResponse(await response.json(), now);
  } catch {
    return null;
  }
}

export function exchangeCodeForTokens(
  config: AuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TokenSet | null> {
  return postForm(
    config,
    {
      grant_type: "authorization_code",
      client_id: config.cognitoClientId,
      code,
      redirect_uri: redirectUri(config),
      // Proves this is the same client that started the flow, without a secret.
      code_verifier: codeVerifier,
    },
    fetchImpl,
    now,
  );
}

export function refreshTokens(
  config: AuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
  now: number = Date.now(),
): Promise<TokenSet | null> {
  return postForm(
    config,
    {
      grant_type: "refresh_token",
      client_id: config.cognitoClientId,
      refresh_token: refreshToken,
    },
    fetchImpl,
    now,
  );
}

export { parseTokenResponse };
