import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient } from "./apiClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function headersOf(call: { init: RequestInit } | undefined): Record<string, string> {
  return (call?.init.headers ?? {}) as Record<string, string>;
}

function makeClient(responses: Response[], overrides: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const queue = [...responses];
  const calls: { url: string; init: RequestInit }[] = [];

  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next;
  }) as unknown as typeof fetch;

  const client = createApiClient({
    getAccessToken: async () => "token-1",
    refreshAccessToken: async () => "token-2",
    fetch: fetchMock,
    ...overrides,
  });

  return { client, calls };
}

describe("createApiClient", () => {
  it("sends a bearer token and parses JSON", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { cards: [] })]);

    const body = await client.request<{ cards: unknown[] }>("/api/cards");

    expect(body.cards).toEqual([]);
    expect(headersOf(calls[0]).Authorization).toBe("Bearer token-1");
  });

  it("never caches and never sends cookies", async () => {
    const { client, calls } = makeClient([jsonResponse(200, {})]);

    await client.request("/api/cards");

    expect(calls[0]?.init.cache).toBe("no-store");
    expect(calls[0]?.init.credentials).toBe("omit");
  });

  it("retries exactly once with a refreshed token after a 401", async () => {
    const { client, calls } = makeClient([
      jsonResponse(401, { error: "unauthorized" }),
      jsonResponse(200, { cards: [] }),
    ]);

    await client.request("/api/cards");

    expect(calls).toHaveLength(2);
    expect(headersOf(calls[1]).Authorization).toBe("Bearer token-2");
  });

  it("gives up after the retry also fails, rather than looping", async () => {
    const { client, calls } = makeClient([
      jsonResponse(401, { error: "unauthorized" }),
      jsonResponse(401, { error: "unauthorized" }),
    ]);

    await expect(client.request("/api/cards")).rejects.toThrow(ApiError);
    expect(calls).toHaveLength(2);
  });

  it("does not retry when the refresh itself fails", async () => {
    const { client, calls } = makeClient([jsonResponse(401, { error: "unauthorized" })], {
      refreshAccessToken: async () => null,
    });

    await expect(client.request("/api/cards")).rejects.toThrow(ApiError);
    expect(calls).toHaveLength(1);
  });

  it("makes no request at all when signed out", async () => {
    // The signed-out app must not talk to the API.
    const { client, calls } = makeClient([], { getAccessToken: async () => null });

    await expect(client.request("/api/cards")).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(0);
  });

  it("sends anonymous requests with no Authorization header", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { card: {} })], {
      getAccessToken: async () => {
        throw new Error("must not be called");
      },
    });

    await client.request("/api/shares/tok", { anonymous: true });

    expect(headersOf(calls[0]).Authorization).toBeUndefined();
  });

  it("surfaces the server's error code", async () => {
    const { client } = makeClient([jsonResponse(404, { error: "not_found" })]);

    await expect(client.request("/api/cards/x")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      isNotFound: true,
    });
  });

  it("falls back to the status when the body is not JSON", async () => {
    // If the SPA fallback ever rewrote an API error into index.html, this is
    // where it would surface — as an ApiError, not as a silent success.
    const { client } = makeClient([new Response("<!doctype html>", { status: 404 })]);

    await expect(client.request("/api/cards/x")).rejects.toMatchObject({ status: 404 });
  });

  it("returns undefined for a 204", async () => {
    const { client } = makeClient([jsonResponse(204, null)]);

    await expect(client.request("/api/cards/x", { method: "DELETE" })).resolves.toBeUndefined();
  });
});
