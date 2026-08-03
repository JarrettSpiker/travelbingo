import { describe, expect, it } from "vitest";
import { getUserId, OWNER_ONLY, requireCardRole } from "./auth.ts";
import { HttpError } from "./http.ts";
import { membershipKey } from "./lib/keys.ts";
import { makeTestDeps } from "./testing/fakeDdb.ts";

async function statusOf(promise: Promise<unknown>): Promise<number> {
  try {
    await promise;
    return 200;
  } catch (error) {
    if (error instanceof HttpError) return error.statusCode;
    throw error;
  }
}

describe("getUserId", () => {
  it("returns the verified sub claim", () => {
    expect(getUserId({ sub: "user-a" })).toBe("user-a");
  });

  it("rejects missing, empty, and non-string subs", () => {
    expect(() => getUserId(undefined)).toThrow(HttpError);
    expect(() => getUserId({})).toThrow(HttpError);
    expect(() => getUserId({ sub: "" })).toThrow(HttpError);
    expect(() => getUserId({ sub: 42 })).toThrow(HttpError);
  });

  it("ignores any other identity-looking claim", () => {
    // The authorizer verified `sub`. Nothing else in the token, and nothing at
    // all from the request, may stand in for it.
    expect(getUserId({ sub: "user-a", username: "user-b", email: "b@example.com" })).toBe("user-a");
  });
});

describe("requireCardRole", () => {
  function seedMembership(deps: ReturnType<typeof makeTestDeps>, userId: string, role: string) {
    deps.ddb.seed({
      ...membershipKey(userId, "card-1"),
      role,
      title: "Trip",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  }

  it("returns the membership when the role is allowed", async () => {
    const deps = makeTestDeps();
    seedMembership(deps, "user-a", "owner");

    const membership = await requireCardRole(deps, "user-a", "card-1", OWNER_ONLY);

    expect(membership.role).toBe("owner");
    expect(membership.title).toBe("Trip");
  });

  it("returns 404 when the caller has no membership", async () => {
    const deps = makeTestDeps();

    expect(await statusOf(requireCardRole(deps, "user-a", "card-1", OWNER_ONLY))).toBe(404);
  });

  it("returns 404 — not 403 — for another user's card", async () => {
    // The security property: a 403 here would confirm that card-1 is a real id
    // belonging to someone else. "Not yours" and "does not exist" must be
    // indistinguishable.
    const deps = makeTestDeps();
    seedMembership(deps, "user-a", "owner");

    expect(await statusOf(requireCardRole(deps, "user-b", "card-1", OWNER_ONLY))).toBe(404);
  });

  it("returns 403 when the caller holds a membership with an insufficient role", async () => {
    // 403 is safe here: the caller already knows the card exists, because they
    // hold a membership of it.
    const deps = makeTestDeps();
    seedMembership(deps, "user-a", "viewer");

    expect(await statusOf(requireCardRole(deps, "user-a", "card-1", OWNER_ONLY))).toBe(403);
  });
});
