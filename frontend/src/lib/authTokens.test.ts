import { describe, expect, it, vi } from "vitest";
import type { AuthConfig } from "../config";
import { exchangeCodeForTokens, parseTokenResponse, refreshTokens } from "./authTokens";

const config: AuthConfig = {
  cognitoDomain: "travelbingo-dev.auth.us-east-1.amazoncognito.com",
  cognitoClientId: "abc123",
  appOrigin: "https://dev.travelbingo.ca",
};

function fetchReturning(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("parseTokenResponse", () => {
  it("converts expires_in into an absolute expiry", () => {
    const set = parseTokenResponse({ access_token: "at", expires_in: 3600 }, 1_000);
    expect(set?.expiresAt).toBe(3_601_000);
  });

  it("defaults expires_in to an hour", () => {
    expect(parseTokenResponse({ access_token: "at" }, 0)?.expiresAt).toBe(3_600_000);
  });

  it("rejects a response with no access token", () => {
    expect(parseTokenResponse({ id_token: "it" }, 0)).toBeNull();
    expect(parseTokenResponse({ access_token: "" }, 0)).toBeNull();
    expect(parseTokenResponse(null, 0)).toBeNull();
  });

  it("tolerates a refresh response that carries no new refresh token", () => {
    // Cognito issues one only at sign-in; the stored one stays valid.
    expect(parseTokenResponse({ access_token: "at", id_token: "it" }, 0)?.refreshToken).toBeNull();
  });
});

describe("exchangeCodeForTokens", () => {
  it("sends the PKCE verifier and no client secret", async () => {
    const { impl, calls } = fetchReturning(200, { access_token: "at", refresh_token: "rt" });

    await exchangeCodeForTokens(config, "the-code", "the-verifier", impl, 0);

    const body = new URLSearchParams(String(calls[0]?.init.body));
    expect(calls[0]?.url).toBe(`https://${config.cognitoDomain}/oauth2/token`);
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("the-code");
    expect(body.get("code_verifier")).toBe("the-verifier");
    expect(body.get("redirect_uri")).toBe("https://dev.travelbingo.ca/auth/callback");
    expect(body.get("client_secret")).toBeNull();
  });

  it("returns null on a rejected exchange rather than throwing", async () => {
    const { impl } = fetchReturning(400, { error: "invalid_grant" });

    await expect(exchangeCodeForTokens(config, "c", "v", impl, 0)).resolves.toBeNull();
  });
});

describe("refreshTokens", () => {
  it("sends the refresh grant", async () => {
    const { impl, calls } = fetchReturning(200, { access_token: "at2" });

    const set = await refreshTokens(config, "the-refresh-token", impl, 0);

    const body = new URLSearchParams(String(calls[0]?.init.body));
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("the-refresh-token");
    expect(set?.accessToken).toBe("at2");
  });

  it("returns null when the refresh token has been revoked", async () => {
    const { impl } = fetchReturning(400, { error: "invalid_grant" });

    await expect(refreshTokens(config, "revoked", impl, 0)).resolves.toBeNull();
  });
});
