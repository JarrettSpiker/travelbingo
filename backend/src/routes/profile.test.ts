import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { profileKey } from "../lib/keys.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import { getProfile, updateProfile } from "./profile.ts";

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return { userId: "user-a", params: {}, body: undefined, ...overrides };
}

async function statusOf(promise: Promise<{ statusCode: number }>): Promise<number> {
  try {
    return (await promise).statusCode;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("getProfile", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("returns a null display name with 200 when no profile exists", async () => {
    const response = await getProfile(deps, request());
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ displayName: null, updatedAt: null });
  });

  it("round-trips a display name set by updateProfile", async () => {
    await updateProfile(deps, request({ body: { displayName: "Jordan" } }));

    const response = await getProfile(deps, request());
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.displayName).toBe("Jordan");
    expect(body.updatedAt).toBe("2026-08-02T00:00:00.000Z");
  });

  it("preserves createdAt across updates while refreshing updatedAt", async () => {
    deps.now = () => "2026-08-02T00:00:00.000Z";
    await updateProfile(deps, request({ body: { displayName: "First" } }));
    const firstKey = profileKey("user-a");
    const first = deps.ddb.get(firstKey.PK, firstKey.SK);
    expect(first?.createdAt).toBe("2026-08-02T00:00:00.000Z");

    deps.now = () => "2026-08-05T00:00:00.000Z";
    await updateProfile(deps, request({ body: { displayName: "Second" } }));
    const second = deps.ddb.get(firstKey.PK, firstKey.SK);
    expect(second?.createdAt).toBe("2026-08-02T00:00:00.000Z");
    expect(second?.updatedAt).toBe("2026-08-05T00:00:00.000Z");
    expect(second?.displayName).toBe("Second");
  });

  it("rejects an unauthenticated caller", async () => {
    expect(await statusOf(getProfile(deps, request({ userId: null })))).toBe(401);
  });

  it("never reads another user's profile — the key is the caller's own", async () => {
    await updateProfile(deps, request({ userId: "user-a", body: { displayName: "A" } }));

    const response = await getProfile(deps, request({ userId: "user-b" }));
    expect(JSON.parse(response.body).displayName).toBeNull();
  });
});

describe("updateProfile", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("stores a valid display name and returns the new profile", async () => {
    const response = await updateProfile(deps, request({ body: { displayName: "  Jordan " } }));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).displayName).toBe("Jordan");
  });

  it("clears the display name to null on an empty value", async () => {
    await updateProfile(deps, request({ body: { displayName: "Jordan" } }));
    await updateProfile(deps, request({ body: { displayName: "   " } }));

    const response = await getProfile(deps, request());
    expect(JSON.parse(response.body).displayName).toBeNull();
  });

  it("rejects an over-length name with 400 and leaves the stored profile unchanged", async () => {
    await updateProfile(deps, request({ body: { displayName: "Jordan" } }));

    expect(await statusOf(updateProfile(deps, request({ body: { displayName: "x".repeat(51) } })))).toBe(400);

    const response = await getProfile(deps, request());
    expect(JSON.parse(response.body).displayName).toBe("Jordan");
  });

  it("rejects a body that is not an object", async () => {
    expect(await statusOf(updateProfile(deps, request({ body: "nope" })))).toBe(400);
    expect(await statusOf(updateProfile(deps, request({ body: null })))).toBe(400);
  });

  it("rejects a missing displayName field", async () => {
    expect(await statusOf(updateProfile(deps, request({ body: {} })))).toBe(400);
  });

  it("ignores a user id in the body and writes only the caller's own profile", async () => {
    // A body claiming to be another user is never read for identity.
    await updateProfile(
      deps,
      request({ userId: "user-a", body: { displayName: "A", userId: "user-b", sub: "user-b" } }),
    );

    const ownKey = profileKey("user-a");
    expect(deps.ddb.get(ownKey.PK, ownKey.SK)?.displayName).toBe("A");

    const otherKey = profileKey("user-b");
    expect(deps.ddb.get(otherKey.PK, otherKey.SK)).toBeUndefined();
  });

  it("rejects an unauthenticated caller", async () => {
    expect(
      await statusOf(updateProfile(deps, request({ userId: null, body: { displayName: "x" } }))),
    ).toBe(401);
  });
});
