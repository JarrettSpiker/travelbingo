import type { AuthConfig } from "../config";

// Pure helpers for the OAuth 2.0 authorization-code flow with PKCE. Nothing
// here touches React or performs a request; AuthProvider is the only place with
// an effect. Keeping the decisions here is what makes them testable.

export const CALLBACK_PATH = "/auth/callback";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** 32 bytes -> 43 characters, within the 43–128 range the spec requires. */
export function createCodeVerifier(): string {
  return randomBase64Url(32);
}

export function createState(): string {
  return randomBase64Url(16);
}

/**
 * S256 challenge. A public client cannot hold a secret, so PKCE is what stops
 * an intercepted authorization code from being redeemed by anyone else.
 */
export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

export function redirectUri(config: AuthConfig): string {
  return `${config.appOrigin}${CALLBACK_PATH}`;
}

export interface AuthorizeParams {
  state: string;
  codeChallenge: string;
}

export function buildAuthorizeUrl(config: AuthConfig, params: AuthorizeParams): string {
  const url = new URL(`https://${config.cognitoDomain}/oauth2/authorize`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.cognitoClientId);
  url.searchParams.set("redirect_uri", redirectUri(config));
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", params.state);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Google is the only provider, so skip Cognito's chooser screen entirely.
  url.searchParams.set("identity_provider", "Google");
  return url.toString();
}

export function buildLogoutUrl(config: AuthConfig): string {
  const url = new URL(`https://${config.cognitoDomain}/logout`);
  url.searchParams.set("client_id", config.cognitoClientId);
  url.searchParams.set("logout_uri", config.appOrigin);
  return url.toString();
}

export function tokenEndpoint(config: AuthConfig): string {
  return `https://${config.cognitoDomain}/oauth2/token`;
}

export type CallbackResult =
  | { kind: "code"; code: string; state: string }
  | { kind: "error"; error: string }
  | { kind: "none" };

export function parseCallback(search: string): CallbackResult {
  const params = new URLSearchParams(search);

  const error = params.get("error");
  if (error) {
    return { kind: "error", error };
  }

  const code = params.get("code");
  const state = params.get("state");
  if (code && state) {
    return { kind: "code", code, state };
  }

  return { kind: "none" };
}

export interface IdTokenClaims {
  sub: string;
  email: string | null;
}

/**
 * Reads the ID token's claims for display only — a name to show in the menu.
 *
 * This is not verification and must never gate anything. Every authorization
 * decision is made server-side from a token the API Gateway authorizer has
 * actually verified.
 */
export function decodeIdToken(idToken: string): IdTokenClaims | null {
  const parts = idToken.split(".");
  if (parts.length !== 3 || !parts[1]) return null;

  try {
    // Base64url-decode the JWT payload so a non-ASCII email survives.
    const binary = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const sub = json.sub;
    if (typeof sub !== "string") return null;

    return { sub, email: typeof json.email === "string" ? json.email : null };
  } catch {
    return null;
  }
}

/** Treats a token as expired slightly early, so it is not used mid-flight. */
export function isExpired(expiresAt: number, now: number = Date.now(), skewMs = 30_000): boolean {
  return now >= expiresAt - skewMs;
}

export function expiresAtFrom(expiresInSeconds: number, now: number = Date.now()): number {
  return now + expiresInSeconds * 1000;
}
