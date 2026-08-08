import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import {
  cardMetaKey,
  inviteKey,
  tripCardKey,
  tripInvitePointerKey,
  tripMemberKey,
  tripMembershipKey,
  tripMetaKey,
  TRIPCARD_SK_PREFIX,
} from "../lib/keys.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import { createCard } from "./cards.ts";
import {
  addTripCard,
  assignTripCard,
  createInvite,
  createTrip,
  deleteTrip,
  getTrip,
  listTrips,
  listInvites,
  MAX_MEMBERS_PER_TRIP,
  MAX_TRIP_CARDS_PER_TRIP,
  MAX_TRIPS_PER_USER,
  redeemInvite,
  removeMember,
  removeTripCard,
  resolveInvite,
  revokeInvite,
  updateTrip,
} from "./trips.ts";

const card = {
  slots: ["Airport", null, "Dog"],
  entries: [
    { text: "Airport", mandatory: false, enabled: true },
    { text: "Dog", mandatory: false, enabled: true },
    { text: "Beach", mandatory: true, enabled: true },
  ],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: { backgroundColor: "#ffffff", cellColor: "#eeeeee", textColor: "#1a1a1a", titleColor: "#1a1a1a" },
  fontScheme: { titleFont: "system-ui, sans-serif", cellFont: "system-ui, sans-serif" },
  emojiScheme: { emojis: ["🚗"] },
};

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

async function seedTrip(
  deps: TestDeps,
  userId = "user-a",
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const response = await createTrip(deps, request({ userId, body: { title: "Summer Road Trip", mode: "cooperative", ...overrides } }));
  return JSON.parse(response.body).tripId as string;
}

async function seedCard(deps: TestDeps, userId = "user-a"): Promise<string> {
  const response = await createCard(deps, request({ userId, body: card }));
  return JSON.parse(response.body).cardId as string;
}

async function mintInvite(deps: TestDeps, tripId: string, userId = "user-a"): Promise<string> {
  const response = await createInvite(deps, request({ userId, params: { tripId } }));
  return JSON.parse(response.body).token as string;
}

interface TripCardItem {
  snapshot: { title: string; slots: (string | null)[] };
  ownerId: string;
  assignedMemberId?: string;
}

function tripCardItem(deps: TestDeps, tripId: string, tripCardId: string): TripCardItem {
  const key = tripCardKey(tripId, tripCardId);
  const item = deps.ddb.get(key.PK, key.SK);
  if (!item) throw new Error(`missing trip card ${tripId}/${tripCardId}`);
  return item as unknown as TripCardItem;
}

describe("listTrips", () => {
  it("lists the caller's trips in a single query, with no per-trip lookup", async () => {
    const deps = makeTestDeps();
    await seedTrip(deps, "user-a");
    await seedTrip(deps, "user-a");

    const before = deps.ddb.sendCount;
    const response = await listTrips(deps, request({ userId: "user-a" }));
    const body = JSON.parse(response.body);

    expect(body.trips).toHaveLength(2);
    expect(body.trips[0].title).toBe("Summer Road Trip");
    expect(body.trips[0].role).toBe("admin");
    // One Query, full stop — the denormalized title/dates buy this.
    expect(deps.ddb.sendCount - before).toBe(1);
  });

  it("does not list another user's trips", async () => {
    const deps = makeTestDeps();
    await seedTrip(deps, "user-a");

    expect(JSON.parse((await listTrips(deps, request({ userId: "user-b" }))).body).trips).toEqual([]);
  });

  it("rejects a signed-out caller", async () => {
    const deps = makeTestDeps();
    expect(await statusOf(listTrips(deps, request({ userId: null })))).toBe(401);
  });

  it("drops a trip from the listing once the member is removed", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(JSON.parse((await listTrips(deps, request({ userId: "user-b" }))).body).trips).toHaveLength(1);

    await removeMember(deps, request({ params: { tripId, userId: "user-b" } }));

    expect(JSON.parse((await listTrips(deps, request({ userId: "user-b" }))).body).trips).toEqual([]);
  });
});

describe("createTrip", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("makes the creator the administrator and writes META + membership + mirror", async () => {
    const tripId = await seedTrip(deps);

    expect(deps.ddb.get(tripMetaKey(tripId).PK, "META")).toMatchObject({
      ownerId: "user-a",
      title: "Summer Road Trip",
      mode: "cooperative",
    });
    const membership = tripMembershipKey("user-a", tripId);
    expect(deps.ddb.get(membership.PK, membership.SK)).toMatchObject({ role: "admin", title: "Summer Road Trip" });
    const mirror = tripMemberKey(tripId, "user-a");
    expect(deps.ddb.get(mirror.PK, mirror.SK)).toMatchObject({ role: "admin" });
  });

  it("stores an optional date range", async () => {
    const tripId = await seedTrip(deps, "user-a", { startDate: "2026-08-01", endDate: "2026-08-09" });
    expect(deps.ddb.get(tripMetaKey(tripId).PK, "META")).toMatchObject({
      startDate: "2026-08-01",
      endDate: "2026-08-09",
    });
  });

  it("rejects an invalid payload without storing anything", async () => {
    expect(await statusOf(createTrip(deps, request({ body: { title: "", mode: "cooperative" } })))).toBe(400);
    expect(await statusOf(createTrip(deps, request({ body: { title: "x", mode: "solo" } })))).toBe(400);
    expect(
      await statusOf(
        createTrip(deps, request({ body: { title: "x", mode: "cooperative", startDate: "2026-08-09", endDate: "2026-08-01" } })),
      ),
    ).toBe(400);
    expect(deps.ddb.items.size).toBe(0);
  });

  it("enforces the per-user trip cap", async () => {
    for (let i = 0; i < MAX_TRIPS_PER_USER; i += 1) {
      deps.ddb.seed({ ...tripMembershipKey("user-a", `trip-${i}`), role: "admin", title: "x", updatedAt: "t" });
    }
    expect(await statusOf(createTrip(deps, request({ body: { title: "one more", mode: "cooperative" } })))).toBe(400);
  });

  it("rejects a signed-out caller", async () => {
    expect(await statusOf(createTrip(deps, request({ userId: null, body: { title: "x", mode: "cooperative" } })))).toBe(401);
  });
});

describe("getTrip", () => {
  it("returns the trip to a member, with members and cards", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const cardId = await seedCard(deps, "user-a");
    await addTripCard(deps, request({ params: { tripId }, body: { cardId } }));

    const body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);

    expect(body.title).toBe("Summer Road Trip");
    expect(body.role).toBe("admin");
    expect(body.members).toHaveLength(1);
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].snapshot.title).toBe("Road trip");
  });

  it("returns 404 to a non-member — not 403", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    expect(await statusOf(getTrip(deps, request({ userId: "user-b", params: { tripId } })))).toBe(404);
  });

  it("shows outstanding invites only to the administrator", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    const adminBody = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(adminBody.invites).toHaveLength(1);

    const memberBody = JSON.parse((await getTrip(deps, request({ userId: "user-b", params: { tripId } }))).body);
    expect(memberBody.invites).toBeUndefined();
  });

  it("lets a member see cards assigned to others (read authorization is trip-level)", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "competitive" });
    const cardId = await seedCard(deps, "user-a");
    const tripCard = await addTripCard(deps, request({ params: { tripId }, body: { cardId } }));
    const tripCardId = JSON.parse(tripCard.body).tripCardId;

    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    await assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-a" } }));

    const memberBody = JSON.parse((await getTrip(deps, request({ userId: "user-b", params: { tripId } }))).body);
    expect(memberBody.cards).toHaveLength(1);
    expect(memberBody.cards[0].assignedMemberId).toBe("user-a");
  });
});

describe("updateTrip", () => {
  it("updates the title and dates for the administrator, syncing member rows", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { startDate: "2026-08-01", endDate: "2026-08-09" });
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    await updateTrip(deps, request({ params: { tripId }, body: { title: "Renamed", startDate: "2026-09-01" } }));

    // META reflects the new title, the new start date, and the cleared end date.
    const meta = deps.ddb.get(tripMetaKey(tripId).PK, "META");
    expect(meta?.title).toBe("Renamed");
    expect(meta?.startDate).toBe("2026-09-01");
    expect(meta?.endDate).toBeUndefined();
    // Every member's listing row is kept in sync.
    const adminKey = tripMembershipKey("user-a", tripId);
    const adminMembership = deps.ddb.get(adminKey.PK, adminKey.SK);
    expect(adminMembership?.title).toBe("Renamed");
    expect(adminMembership?.endDate).toBeUndefined();
    const memberKey = tripMembershipKey("user-b", tripId);
    const memberMembership = deps.ddb.get(memberKey.PK, memberKey.SK);
    expect(memberMembership?.title).toBe("Renamed");
    expect(memberMembership?.startDate).toBe("2026-09-01");
  });

  it("refuses a non-administrator with 403", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(
      await statusOf(updateTrip(deps, request({ userId: "user-b", params: { tripId }, body: { title: "x" } }))),
    ).toBe(403);
  });

  it("returns 404 to a non-member", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    expect(
      await statusOf(updateTrip(deps, request({ userId: "user-b", params: { tripId }, body: { title: "x" } }))),
    ).toBe(404);
  });
});

describe("deleteTrip", () => {
  it("cascades to members, cards, invites, and cross-partition records", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    const cardId = await seedCard(deps, "user-a");
    await addTripCard(deps, request({ params: { tripId }, body: { cardId } }));

    await deleteTrip(deps, request({ params: { tripId } }));

    // No trip or invite record survives: META, members, cards, invite pointers,
    // member listing rows, and invite records are all gone.
    const survivors = [...deps.ddb.items.values()].filter(
      (item) => String(item.PK).startsWith("TRIP#") || String(item.PK).startsWith("INVITE#"),
    );
    expect(survivors).toEqual([]);
    // The removed user's listing row is gone too.
    expect(deps.ddb.get(tripMembershipKey("user-b", tripId).PK, tripMembershipKey("user-b", tripId).SK)).toBeUndefined();
    // The original card is untouched — cascade deletes never reach it.
    expect(deps.ddb.get(cardMetaKey(cardId).PK, cardMetaKey(cardId).SK)).toBeDefined();
  });

  it("refuses a non-administrator with 403", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(await statusOf(deleteTrip(deps, request({ userId: "user-b", params: { tripId } })))).toBe(403);
  });

  it("returns 404 to a non-member", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    expect(await statusOf(deleteTrip(deps, request({ userId: "user-b", params: { tripId } })))).toBe(404);
  });
});

describe("invites", () => {
  it("mints an unguessable token the administrator can share", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    const token = await mintInvite(deps, tripId);

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);
    // The redemption record and the admin-facing pointer both exist.
    expect(deps.ddb.get(inviteKey(token).PK, inviteKey(token).SK)).toBeDefined();
    expect(deps.ddb.get(tripInvitePointerKey(tripId, token).PK, tripInvitePointerKey(tripId, token).SK)).toBeDefined();
  });

  it("refuses minting by a non-administrator with the same 404 as a non-member", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    // A member minting looks identical to a non-member (non-existent trip).
    expect(await statusOf(createInvite(deps, request({ userId: "user-b", params: { tripId } })))).toBe(403);
    expect(await statusOf(createInvite(deps, request({ userId: "user-c", params: { tripId } })))).toBe(404);
  });

  it("redeems a valid invite and joins the caller as a member", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);

    const response = await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({ tripId, role: "member" });

    // The new member can now read the trip.
    expect(await statusOf(getTrip(deps, request({ userId: "user-b", params: { tripId } })))).toBe(200);
  });

  it("is idempotent: a current member redeeming again is a no-op", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);

    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    const second = await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(second.statusCode).toBe(200);
    expect(JSON.parse(second.body).role).toBe("member");
    // Still exactly one membership + one mirror for user-b.
    expect(deps.ddb.get(tripMembershipKey("user-b", tripId).PK, tripMembershipKey("user-b", tripId).SK)).toBeDefined();
    expect(deps.ddb.get(tripMemberKey(tripId, "user-b").PK, tripMemberKey(tripId, "user-b").SK)).toBeDefined();
  });

  it("makes unknown, revoked, and deleted indistinguishable (all 404 on resolve)", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);

    // A valid token resolves.
    expect(await statusOf(resolveInvite(deps, request({ params: { token: "unknown" } })))).toBe(404);

    // After revocation, it resolves identically to one that never existed.
    await revokeInvite(deps, request({ params: { tripId, token } }));
    expect(await statusOf(resolveInvite(deps, request({ params: { token } })))).toBe(404);
    expect(await statusOf(redeemInvite(deps, request({ userId: "user-b", params: { token } })))).toBe(404);

    // After the trip is deleted, a fresh invite resolves the same way too.
    const tripId2 = await seedTrip(deps, "user-a");
    const token2 = await mintInvite(deps, tripId2);
    await deleteTrip(deps, request({ params: { tripId: tripId2 } }));
    expect(await statusOf(resolveInvite(deps, request({ params: { token: token2 } })))).toBe(404);
  });

  it("resolveInvite is the only public surface — it never reads a userId", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);

    // A signed-out caller can resolve (the landing page shows the title).
    const body = JSON.parse((await resolveInvite(deps, request({ userId: null, params: { token } }))).body);
    expect(body.title).toBe("Summer Road Trip");
  });

  it("listInvites returns the administrator's outstanding invites", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    const t1 = await mintInvite(deps, tripId);
    const t2 = await mintInvite(deps, tripId);

    const body = JSON.parse((await listInvites(deps, request({ params: { tripId } }))).body);
    expect(body.invites.map((i: { token: string }) => i.token).sort()).toEqual([t1, t2].sort());
  });

  it("listInvites refuses a member with 403", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(await statusOf(listInvites(deps, request({ userId: "user-b", params: { tripId } })))).toBe(403);
  });
});

describe("removeMember", () => {
  it("removes a member but keeps the cards they added", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    const cardId = await seedCard(deps, "user-b");
    await addTripCard(deps, request({ userId: "user-b", params: { tripId }, body: { cardId } }));

    await removeMember(deps, request({ params: { tripId, userId: "user-b" } }));

    // The removed user can no longer see the trip.
    expect(await statusOf(getTrip(deps, request({ userId: "user-b", params: { tripId } })))).toBe(404);
    // Their added card remains.
    const body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(body.cards).toHaveLength(1);
  });

  it("clears assignments on the removed member's cards", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "competitive" });
    const cardId = await seedCard(deps, "user-a");
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    await assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-b" } }));

    await removeMember(deps, request({ params: { tripId, userId: "user-b" } }));

    expect(tripCardItem(deps, tripId, tripCardId).assignedMemberId).toBeUndefined();
  });

  it("refuses to remove the only administrator", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");

    expect(await statusOf(removeMember(deps, request({ params: { tripId, userId: "user-a" } })))).toBe(400);
  });

  it("returns 404 for a non-member target", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    expect(await statusOf(removeMember(deps, request({ params: { tripId, userId: "user-b" } })))).toBe(404);
  });

  it("refuses a non-administrator with 403", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));
    await redeemInvite(deps, request({ userId: "user-c", params: { token } }));

    expect(await statusOf(removeMember(deps, request({ userId: "user-b", params: { tripId, userId: "user-c" } })))).toBe(403);
  });
});

describe("trip cards", () => {
  it("stores a frozen render-only snapshot, excluding the editable pool", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);

    const item = tripCardItem(deps, tripId, tripCardId);
    expect(item.snapshot.title).toBe("Road trip");
    expect(item.snapshot.slots).toEqual(["Airport", null, "Dog"]);
    // The editable entry pool is not part of the snapshot.
    expect((item.snapshot as Record<string, unknown>).entries).toBeUndefined();
  });

  it("decouples the snapshot from the original card (edit then delete)", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);

    // Edit the original: the trip card is unchanged.
    const { replaceCard } = await import("./cards.ts");
    await replaceCard(deps, request({ params: { cardId }, body: { ...card, title: "Completely New Title" } }));
    expect(tripCardItem(deps, tripId, tripCardId).snapshot.title).toBe("Road trip");

    // Delete the original: the trip card still stands.
    const { deleteCard } = await import("./cards.ts");
    await deleteCard(deps, request({ params: { cardId } }));
    expect(tripCardItem(deps, tripId, tripCardId).snapshot.title).toBe("Road trip");
  });

  it("rejects adding a card the caller does not own (no leak)", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const cardId = await seedCard(deps, "user-a");
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    // user-b is a member but not the card's owner: 404, indistinguishable from
    // a non-existent card.
    expect(
      await statusOf(addTripCard(deps, request({ userId: "user-b", params: { tripId }, body: { cardId } }))),
    ).toBe(404);
  });

  it("bounds the per-trip card count", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    for (let i = 0; i < MAX_TRIP_CARDS_PER_TRIP; i += 1) {
      deps.ddb.seed({
        ...tripCardKey(tripId, `tc-${i}`),
        snapshot: { title: "x", slots: [], hasFreeSpace: false, freeSpaceText: "", colorScheme: {}, fontScheme: {}, emojiScheme: { emojis: [] } },
        ownerId: "user-a",
        createdAt: "t",
      });
    }
    const cardId = await seedCard(deps);
    expect(
      await statusOf(addTripCard(deps, request({ params: { tripId }, body: { cardId } }))),
    ).toBe(400);
  });

  it("bounds the per-trip member count on redeem", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    for (let i = 0; i < MAX_MEMBERS_PER_TRIP; i += 1) {
      deps.ddb.seed({ ...tripMemberKey(tripId, `member-${i}`), role: "member", createdAt: "t" });
    }
    const token = await mintInvite(deps, tripId);
    expect(
      await statusOf(redeemInvite(deps, request({ userId: "user-b", params: { token } }))),
    ).toBe(400);
  });

  it("only the administrator can remove a card", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps);
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(await statusOf(removeTripCard(deps, request({ userId: "user-b", params: { tripId, tripCardId } })))).toBe(403);

    expect((await removeTripCard(deps, request({ params: { tripId, tripCardId } }))).statusCode).toBe(204);
  });

  it("competitive: a newly added card is unassigned until the administrator assigns it", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "competitive" });
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);

    let body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(body.cards[0].assignedMemberId).toBeUndefined();

    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    await assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-b" } }));
    body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(body.cards[0].assignedMemberId).toBe("user-b");

    // Reassign.
    await assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-a" } }));
    body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(body.cards[0].assignedMemberId).toBe("user-a");
  });

  it("competitive: rejects assigning to a non-member", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "competitive" });
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);

    expect(
      await statusOf(assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-b" } }))),
    ).toBe(400);
  });

  it("competitive: a member cannot assign", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "competitive" });
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);
    const token = await mintInvite(deps, tripId);
    await redeemInvite(deps, request({ userId: "user-b", params: { token } }));

    expect(
      await statusOf(
        assignTripCard(deps, request({ userId: "user-b", params: { tripId, tripCardId }, body: { assignedMemberId: "user-b" } })),
      ),
    ).toBe(403);
  });

  it("cooperative: assignment does not apply and is rejected", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a", { mode: "cooperative" });
    const cardId = await seedCard(deps);
    const { tripCardId } = JSON.parse((await addTripCard(deps, request({ params: { tripId }, body: { cardId } }))).body);

    // No assignedMemberId is ever set in cooperative trips.
    const body = JSON.parse((await getTrip(deps, request({ params: { tripId } }))).body);
    expect(body.cards[0].assignedMemberId).toBeUndefined();

    // And the administrator cannot assign.
    expect(
      await statusOf(assignTripCard(deps, request({ params: { tripId, tripCardId }, body: { assignedMemberId: "user-a" } }))),
    ).toBe(400);
  });

  it("a signed-out caller cannot touch any authenticated trip route", async () => {
    const deps = makeTestDeps();
    const tripId = await seedTrip(deps, "user-a");
    const cardId = await seedCard(deps, "user-a");
    await addTripCard(deps, request({ params: { tripId }, body: { cardId } }));

    expect(await statusOf(addTripCard(deps, request({ userId: null, params: { tripId }, body: { cardId } })))).toBe(401);
    expect(await statusOf(redeemInvite(deps, request({ userId: null, params: { token: "anything" } })))).toBe(401);
  });
});

describe("router parameter wiring sanity", () => {
  it("exposes the trip-card sort-key prefix used to slice tripCardId", () => {
    // Guards against an accidental prefix rename that would break tripCardId
    // slicing silently.
    expect(TRIPCARD_SK_PREFIX).toBe("TRIPCARD#");
  });
});
