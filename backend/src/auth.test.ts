import { describe, expect, it } from "vitest";
import {
  ADMIN_ONLY,
  ADMIN_OR_MEMBER,
  getUserId,
  OWNER_ONLY,
  requireCardRole,
  requireTripCardPlayer,
  requireTripRole,
} from "./auth.ts";
import { HttpError } from "./http.ts";
import { membershipKey, tripCardKey, tripMembershipKey, tripMetaKey } from "./lib/keys.ts";
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

describe("requireTripRole", () => {
  function seedTripMembership(
    deps: ReturnType<typeof makeTestDeps>,
    userId: string,
    role: "admin" | "member",
  ) {
    deps.ddb.seed({
      ...tripMembershipKey(userId, "trip-1"),
      role,
      title: "Summer Road Trip",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  }

  it("returns the membership when the role is allowed", async () => {
    const deps = makeTestDeps();
    seedTripMembership(deps, "user-a", "admin");

    const membership = await requireTripRole(deps, "user-a", "trip-1", ADMIN_ONLY);

    expect(membership.role).toBe("admin");
    expect(membership.title).toBe("Summer Road Trip");
  });

  it("accepts either role with ADMIN_OR_MEMBER", async () => {
    const deps = makeTestDeps();
    seedTripMembership(deps, "user-a", "member");

    const membership = await requireTripRole(deps, "user-a", "trip-1", ADMIN_OR_MEMBER);
    expect(membership.role).toBe("member");
  });

  it("returns 404 when the caller has no membership", async () => {
    const deps = makeTestDeps();

    expect(await statusOf(requireTripRole(deps, "user-a", "trip-1", ADMIN_OR_MEMBER))).toBe(404);
  });

  it("returns 404 — not 403 — for another user's trip", async () => {
    // The security property, identical to cards: a 403 here would confirm that
    // trip-1 is a real id belonging to someone else.
    const deps = makeTestDeps();
    seedTripMembership(deps, "user-a", "admin");

    expect(await statusOf(requireTripRole(deps, "user-b", "trip-1", ADMIN_OR_MEMBER))).toBe(404);
  });

  it("returns 403 when a member requests an admin-only operation", async () => {
    // 403 is safe: the caller already knows the trip exists, because they hold
    // a membership of it.
    const deps = makeTestDeps();
    seedTripMembership(deps, "user-a", "member");

    expect(await statusOf(requireTripRole(deps, "user-a", "trip-1", ADMIN_ONLY))).toBe(403);
  });

  it("derives the role solely from the membership item, never the request", async () => {
    // The role is read from the stored membership; nothing in a request can
    // elevate it. (The caller's identity comes from getUserId elsewhere; the
    // role here comes only from this item.)
    const deps = makeTestDeps();
    seedTripMembership(deps, "user-a", "member");

    const membership = await requireTripRole(deps, "user-a", "trip-1", ADMIN_OR_MEMBER);
    expect(membership.role).toBe("member");
  });
});

describe("requireTripCardPlayer", () => {
  type Deps = ReturnType<typeof makeTestDeps>;

  function seedTrip(deps: Deps, mode: "cooperative" | "competitive") {
    deps.ddb.seed({ ...tripMetaKey("trip-1"), ownerId: "user-a", title: "Summer Road Trip", mode });
  }

  function seedMember(deps: Deps, userId: string, role: "admin" | "member") {
    deps.ddb.seed({
      ...tripMembershipKey(userId, "trip-1"),
      role,
      title: "Summer Road Trip",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
  }

  function seedCard(deps: Deps, assignedMemberId?: string) {
    deps.ddb.seed({
      ...tripCardKey("trip-1", "card-1"),
      snapshot: { slots: [] },
      ownerId: "user-a",
      createdAt: "2026-08-01T00:00:00.000Z",
      ...(assignedMemberId ? { assignedMemberId } : {}),
    });
  }

  it("lets any member play any card in a cooperative trip", async () => {
    const deps = makeTestDeps();
    seedTrip(deps, "cooperative");
    seedMember(deps, "user-b", "member");
    seedCard(deps);

    const player = await requireTripCardPlayer(deps, "user-b", "trip-1", "card-1");

    expect(player.membership.role).toBe("member");
    expect(player.trip.mode).toBe("cooperative");
    expect(player.card.ownerId).toBe("user-a");
  });

  it("lets the assignee play their own card in a competitive trip", async () => {
    const deps = makeTestDeps();
    seedTrip(deps, "competitive");
    seedMember(deps, "user-b", "member");
    seedCard(deps, "user-b");

    const player = await requireTripCardPlayer(deps, "user-b", "trip-1", "card-1");
    expect(player.card.assignedMemberId).toBe("user-b");
  });

  it("refuses a member who is not the assignee with 403", async () => {
    const deps = makeTestDeps();
    seedTrip(deps, "competitive");
    seedMember(deps, "user-c", "member");
    seedCard(deps, "user-b");

    expect(await statusOf(requireTripCardPlayer(deps, "user-c", "trip-1", "card-1"))).toBe(403);
  });

  it("refuses the administrator on another member's card with 403", async () => {
    // Administering a trip is not playing its cards. An admin who could mark
    // any card would also make the competitive rule untestable in practice,
    // since the admin is a member of every trip they run.
    const deps = makeTestDeps();
    seedTrip(deps, "competitive");
    seedMember(deps, "user-a", "admin");
    seedCard(deps, "user-b");

    expect(await statusOf(requireTripCardPlayer(deps, "user-a", "trip-1", "card-1"))).toBe(403);
  });

  it("refuses everyone, administrator included, on an unassigned competitive card", async () => {
    const deps = makeTestDeps();
    seedTrip(deps, "competitive");
    seedMember(deps, "user-a", "admin");
    seedMember(deps, "user-b", "member");
    seedCard(deps);

    expect(await statusOf(requireTripCardPlayer(deps, "user-a", "trip-1", "card-1"))).toBe(403);
    expect(await statusOf(requireTripCardPlayer(deps, "user-b", "trip-1", "card-1"))).toBe(403);
  });

  it("returns 404 to a non-member, from the inherited trip check", async () => {
    const deps = makeTestDeps();
    seedTrip(deps, "cooperative");
    seedMember(deps, "user-a", "admin");
    seedCard(deps);

    expect(await statusOf(requireTripCardPlayer(deps, "user-z", "trip-1", "card-1"))).toBe(404);
  });

  it("returns 404 — not 403 — for a tripCardId that does not exist", async () => {
    // A member already knows the trip exists, but must not be able to probe
    // which card ids within it are real.
    const deps = makeTestDeps();
    seedTrip(deps, "cooperative");
    seedMember(deps, "user-a", "admin");

    expect(await statusOf(requireTripCardPlayer(deps, "user-a", "trip-1", "missing"))).toBe(404);
  });

  it("closes the card when the stored mode is not one it recognizes", async () => {
    // Fail-closed, not fail-open. Validation bars this today, so the value here
    // stands in for a mode added later or an item written by something other
    // than the current create path — neither of which should silently open
    // every card in the trip to every member.
    const deps = makeTestDeps();
    deps.ddb.seed({ ...tripMetaKey("trip-1"), ownerId: "user-a", title: "T", mode: "teams" });
    seedMember(deps, "user-a", "admin");
    seedMember(deps, "user-b", "member");
    seedCard(deps, "user-b");

    expect(await statusOf(requireTripCardPlayer(deps, "user-a", "trip-1", "card-1"))).toBe(403);
    // The assignee still plays their own card, so an unknown mode degrades to
    // the stricter of the two rules rather than locking everyone out.
    expect((await requireTripCardPlayer(deps, "user-b", "trip-1", "card-1")).card.assignedMemberId).toBe("user-b");
  });

  it("performs exactly three reads", async () => {
    // The membership, the trip META, and the trip card. Pinned so the count
    // cannot quietly grow on a write path that already costs three point reads.
    const deps = makeTestDeps();
    seedTrip(deps, "cooperative");
    seedMember(deps, "user-a", "admin");
    seedCard(deps);

    deps.ddb.sendCount = 0;
    await requireTripCardPlayer(deps, "user-a", "trip-1", "card-1");

    expect(deps.ddb.sendCount).toBe(3);
  });
});
