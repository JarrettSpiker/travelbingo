import { describe, expect, it } from "vitest";
import type { AuthConfig } from "../config";
import {
  buildAuthorizeUrl,
  buildLogoutUrl,
  createCodeChallenge,
  createCodeVerifier,
  createState,
  decodeIdToken,
  expiresAtFrom,
  isExpired,
  parseCallback,
  redirectUri,
} from "./auth";

const config: AuthConfig = {
  cognitoDomain: "travelbingo-dev.auth.us-east-1.amazoncognito.com",
  cognitoClientId: "abc123",
  appOrigin: "https://dev.travelbingo.ca",
};

describe("PKCE", () => {
  it("produces a verifier in the spec's 43–128 character range", () => {
    const verifier = createCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
    expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("produces a different verifier and state each time", () => {
    expect(createCodeVerifier()).not.toBe(createCodeVerifier());
    expect(createState()).not.toBe(createState());
  });

  it("derives a stable S256 challenge", async () => {
    // Pinned against the RFC 7636 appendix B example.
    const challenge = await createCodeChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
    expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("produces a url-safe challenge with no padding", async () => {
    const challenge = await createCodeChallenge(createCodeVerifier());
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("buildAuthorizeUrl", () => {
  it("requests an authorization code with S256 and skips the provider chooser", () => {
    const url = new URL(buildAuthorizeUrl(config, { state: "st", codeChallenge: "ch" }));

    expect(url.origin).toBe(`https://${config.cognitoDomain}`);
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("ch");
    expect(url.searchParams.get("state")).toBe("st");
    // Google is the only provider; without this Cognito shows a chooser with
    // exactly one button on it.
    expect(url.searchParams.get("identity_provider")).toBe("Google");
  });

  it("never includes a client secret", () => {
    const url = buildAuthorizeUrl(config, { state: "st", codeChallenge: "ch" });
    expect(url).not.toContain("client_secret");
  });

  it("uses the registered redirect URI", () => {
    expect(redirectUri(config)).toBe("https://dev.travelbingo.ca/auth/callback");
    expect(new URL(buildAuthorizeUrl(config, { state: "s", codeChallenge: "c" })).searchParams.get("redirect_uri")).toBe(
      "https://dev.travelbingo.ca/auth/callback",
    );
  });
});

describe("buildLogoutUrl", () => {
  it("returns the user to the app origin", () => {
    const url = new URL(buildLogoutUrl(config));
    expect(url.pathname).toBe("/logout");
    expect(url.searchParams.get("logout_uri")).toBe("https://dev.travelbingo.ca");
  });
});

describe("parseCallback", () => {
  it("reads a code and state", () => {
    expect(parseCallback("?code=abc&state=xyz")).toEqual({ kind: "code", code: "abc", state: "xyz" });
  });

  it("reports a provider error", () => {
    expect(parseCallback("?error=access_denied")).toEqual({ kind: "error", error: "access_denied" });
  });

  it("reports nothing for an empty or partial callback", () => {
    expect(parseCallback("")).toEqual({ kind: "none" });
    expect(parseCallback("?code=abc")).toEqual({ kind: "none" });
    expect(parseCallback("?state=xyz")).toEqual({ kind: "none" });
  });
});

describe("decodeIdToken", () => {
  function encode(payload: unknown): string {
    const json = JSON.stringify(payload);
    const base64 = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return `header.${base64}.signature`;
  }

  it("reads sub and email", () => {
    expect(decodeIdToken(encode({ sub: "user-a", email: "a@example.com" }))).toEqual({
      sub: "user-a",
      email: "a@example.com",
    });
  });

  it("returns null for anything malformed rather than throwing", () => {
    expect(decodeIdToken("")).toBeNull();
    expect(decodeIdToken("not.a.jwt")).toBeNull();
    expect(decodeIdToken("only.two")).toBeNull();
    expect(decodeIdToken(encode({ email: "a@example.com" }))).toBeNull();
  });
});

describe("expiry", () => {
  it("treats a token as expired before it actually is", () => {
    const expiresAt = 100_000;
    expect(isExpired(expiresAt, 60_000)).toBe(false);
    // Inside the 30s skew: still valid by the clock, but not used.
    expect(isExpired(expiresAt, 80_000)).toBe(true);
    expect(isExpired(expiresAt, 100_001)).toBe(true);
  });

  it("converts expires_in seconds to an absolute time", () => {
    expect(expiresAtFrom(3600, 1_000)).toBe(3_601_000);
  });
});
