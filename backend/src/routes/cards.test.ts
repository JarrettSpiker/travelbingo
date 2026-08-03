import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { cardMemberKey, cardMetaKey, membershipKey, shareKey, cardSharePointerKey } from "../lib/keys.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import { createCard, deleteCard, getCard, listCards, renameCard, replaceCard } from "./cards.ts";

const card = {
  slots: ["Airport", null, "Dog"],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: {
    backgroundColor: "#ffffff",
    cellColor: "#eeeeee",
    textColor: "#1a1a1a",
    titleColor: "#1a1a1a",
  },
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

async function seedCard(deps: TestDeps, userId = "user-a") {
  const response = await createCard(deps, request({ userId, body: card }));
  return JSON.parse(response.body).cardId as string;
}

describe("createCard", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("writes the card, the membership, and the member mirror in one transaction", async () => {
    const cardId = await seedCard(deps);

    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")).toMatchObject({
      ownerId: "user-a",
      title: "Road trip",
      payloadVersion: 1,
    });
    const membership = membershipKey("user-a", cardId);
    expect(deps.ddb.get(membership.PK, membership.SK)).toMatchObject({
      role: "owner",
      title: "Road trip",
    });

    const mirror = cardMemberKey(cardId, "user-a");
    expect(deps.ddb.get(mirror.PK, mirror.SK)).toMatchObject({ role: "owner" });
  });

  it("rejects an invalid payload without storing anything", async () => {
    expect(await statusOf(createCard(deps, request({ body: { ...card, title: 42 } })))).toBe(400);
    expect(deps.ddb.items.size).toBe(0);
  });

  it("enforces the per-user cap", async () => {
    for (let i = 0; i < 200; i += 1) {
      deps.ddb.seed({ ...membershipKey("user-a", `card-${i}`), role: "owner", title: "x" });
    }

    expect(await statusOf(createCard(deps, request({ body: card })))).toBe(400);
  });

  it("rejects an unauthenticated caller", async () => {
    expect(await statusOf(createCard(deps, request({ userId: null, body: card })))).toBe(401);
  });
});

describe("listCards", () => {
  it("lists from memberships alone, with no per-card lookup", async () => {
    const deps = makeTestDeps();
    await seedCard(deps);
    await seedCard(deps);

    const before = deps.ddb.sendCount;
    const response = await listCards(deps, request());
    const body = JSON.parse(response.body);

    expect(body.cards).toHaveLength(2);
    expect(body.cards[0].title).toBe("Road trip");
    // One Query, full stop. This is what the denormalized title buys.
    expect(deps.ddb.sendCount - before).toBe(1);
  });

  it("does not list another user's cards", async () => {
    const deps = makeTestDeps();
    await seedCard(deps, "user-a");

    const response = await listCards(deps, request({ userId: "user-b" }));
    expect(JSON.parse(response.body).cards).toEqual([]);
  });
});

describe("getCard", () => {
  it("returns the card to its owner", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps);

    const response = await getCard(deps, request({ params: { cardId } }));
    expect(JSON.parse(response.body).card).toEqual(card);
  });

  it("returns 404 to a different user", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps, "user-a");

    expect(await statusOf(getCard(deps, request({ userId: "user-b", params: { cardId } })))).toBe(404);
  });
});

describe("replaceCard and renameCard", () => {
  it("keeps the denormalized title consistent on replace", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps);

    await replaceCard(deps, request({ params: { cardId }, body: { ...card, title: "New title" } }));

    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.title).toBe("New title");
    const membership = membershipKey("user-a", cardId);
    expect(deps.ddb.get(membership.PK, membership.SK)?.title).toBe("New title");
  });

  it("keeps the denormalized title consistent on rename", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps);

    await renameCard(deps, request({ params: { cardId }, body: { title: "Renamed" } }));

    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.title).toBe("Renamed");
    const membership = membershipKey("user-a", cardId);
    expect(deps.ddb.get(membership.PK, membership.SK)?.title).toBe("Renamed");
  });

  it("refuses a rename from a non-member with 404", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps, "user-a");

    expect(
      await statusOf(renameCard(deps, request({ userId: "user-b", params: { cardId }, body: { title: "x" } }))),
    ).toBe(404);
  });
});

describe("deleteCard", () => {
  it("cascades to memberships and share links", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps);

    // A share link, as createShare would have written it.
    deps.ddb.seed({ ...shareKey("tok"), cardId, ownerId: "user-a", snapshot: card, createdAt: "t" });
    deps.ddb.seed({ ...cardSharePointerKey(cardId, "tok"), createdAt: "t" });

    await deleteCard(deps, request({ params: { cardId } }));

    // Nothing left anywhere: a surviving share would keep serving a snapshot of
    // a card its owner believes they deleted.
    expect(deps.ddb.items.size).toBe(0);
  });

  it("refuses to delete another user's card", async () => {
    const deps = makeTestDeps();
    const cardId = await seedCard(deps, "user-a");

    expect(await statusOf(deleteCard(deps, request({ userId: "user-b", params: { cardId } })))).toBe(404);
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")).toBeDefined();
  });

  it("pages through the partition when one Query cannot hold every share pointer", async () => {
    const deps = makeTestDeps();
    // Force the fake to hand back small pages so the loop is exercised. Real
    // DynamoDB paginates at 1 MB; without this knob the fake returns the whole
    // partition at once and the regression would be invisible.
    deps.ddb.queryPageSize = 3;

    const cardId = await seedCard(deps);

    // Eight share links — more than two pages at size 3 — each with its
    // snapshot and its owner-facing pointer in the card's partition.
    for (let i = 0; i < 8; i += 1) {
      const token = `tok-${i}`;
      deps.ddb.seed({ ...shareKey(token), cardId, ownerId: "user-a", snapshot: card, createdAt: "t" });
      deps.ddb.seed({ ...cardSharePointerKey(cardId, token), createdAt: "t" });
    }

    await deleteCard(deps, request({ params: { cardId } }));

    // Nothing left anywhere: a surviving share would keep serving a snapshot of
    // a card its owner believes they deleted.
    expect(deps.ddb.items.size).toBe(0);
  });
});
