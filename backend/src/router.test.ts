import { describe, expect, it } from "vitest";
import { cardMetaKey, membershipKey } from "./lib/keys.ts";
import { makeTestDeps } from "./testing/fakeDdb.ts";
import { MAX_BODY_BYTES, route, type ApiEvent } from "./router.ts";

function event(overrides: Partial<ApiEvent> = {}): ApiEvent {
  return {
    routeKey: "GET /api/cards",
    requestContext: { authorizer: { jwt: { claims: { sub: "user-a" } } } },
    ...overrides,
  };
}

describe("route", () => {
  it("returns a JSON 404 for an unknown API path, never the app shell", async () => {
    const deps = makeTestDeps();

    const response = await route(deps, event({ routeKey: "GET /api/nope" }));

    expect(response.statusCode).toBe(404);
    expect(response.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(response.body)).toEqual({ error: "not_found" });
  });

  it("rejects a protected route with no verified claims", async () => {
    const deps = makeTestDeps();

    const response = await route(deps, event({ requestContext: {} }));

    expect(response.statusCode).toBe(401);
  });

  it("allows the one public route with no claims", async () => {
    const deps = makeTestDeps();

    const response = await route(
      deps,
      event({ routeKey: "GET /api/shares/{token}", requestContext: {}, pathParameters: { token: "x" } }),
    );

    // 404 because the token is unknown — not 401, which is the point.
    expect(response.statusCode).toBe(404);
  });

  it("ignores a user id supplied in the request body", async () => {
    // The caller's identity comes only from the verified claim. A body that
    // claims to be someone else acts as the verified user, not as the claim.
    const deps = makeTestDeps();
    deps.ddb.seed({ ...membershipKey("user-b", "card-1"), role: "owner", title: "B's card" });
    deps.ddb.seed({ ...cardMetaKey("card-1"), ownerId: "user-b", title: "B's card" });

    const response = await route(
      deps,
      event({
        routeKey: "GET /api/cards/{cardId}",
        pathParameters: { cardId: "card-1" },
        body: JSON.stringify({ userId: "user-b", sub: "user-b" }),
      }),
    );

    expect(response.statusCode).toBe(404);
  });

  it("rejects an oversized body before parsing it", async () => {
    const deps = makeTestDeps();

    const response = await route(
      deps,
      event({ routeKey: "POST /api/cards", body: "x".repeat(MAX_BODY_BYTES + 1) }),
    );

    expect(response.statusCode).toBe(400);
  });

  it("rejects a body that is not valid JSON", async () => {
    const deps = makeTestDeps();

    const response = await route(deps, event({ routeKey: "POST /api/cards", body: "{not json" }));

    expect(response.statusCode).toBe(400);
  });

  it("decodes a base64-encoded body", async () => {
    const deps = makeTestDeps();

    const response = await route(
      deps,
      event({
        routeKey: "PATCH /api/cards/{cardId}",
        pathParameters: { cardId: "card-1" },
        body: Buffer.from(JSON.stringify({ title: "x" })).toString("base64"),
        isBase64Encoded: true,
      }),
    );

    // Reaches authorization (404, no membership) rather than failing to parse.
    expect(response.statusCode).toBe(404);
  });

  it("turns an unexpected error into an opaque 500", async () => {
    const deps = makeTestDeps({
      ddb: {
        send: () => {
          throw new Error("boom: connection string with a secret in it");
        },
      } as never,
    });

    const response = await route(deps, event());

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain("secret");
    expect(JSON.parse(response.body)).toEqual({ error: "internal_error" });
  });

  it("sets no-store on every response", async () => {
    const deps = makeTestDeps();

    const response = await route(deps, event());

    expect(response.headers["cache-control"]).toBe("no-store");
  });
});
