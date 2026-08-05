import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { cardMemberKey, cardMetaKey, membershipKey, shareKey, cardSharePointerKey } from "../lib/keys.ts";
import type { ThumbnailStore } from "../lib/thumbnailStore.ts";
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

/** A valid PNG data URL small enough to pass the thumbnail cap. */
function thumbnailDataUrl(bytes = "tiny-thumb"): string {
  return `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`;
}

interface FakeThumbnailStore extends ThumbnailStore {
  objects: Map<string, Buffer>;
  presigned: string[];
  puts: number;
  deletes: number;
}

function thumbnailStoreOf(deps: TestDeps): FakeThumbnailStore {
  return deps.thumbnailStore as FakeThumbnailStore;
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

describe("thumbnails", () => {
  it("writes the thumbnail object and stores the key on the card and membership", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const response = await createCard(deps, request({ body: { ...card, thumbnail: thumbnailDataUrl() } }));
    const cardId = JSON.parse(response.body).cardId as string;

    // The object is keyed by cardId, and the key is denormalized onto both the
    // meta and the membership so listing needs no per-card lookup.
    expect(store.objects.get(`${cardId}.png`)?.toString("utf8")).toBe("tiny-thumb");
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.thumbnailKey).toBe(`${cardId}.png`);
    const membership = membershipKey("user-a", cardId);
    expect(deps.ddb.get(membership.PK, membership.SK)?.thumbnailKey).toBe(`${cardId}.png`);
  });

  it("saves the card without a thumbnail when none is supplied", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const cardId = await seedCard(deps);

    expect(store.puts).toBe(0);
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.thumbnailKey).toBeUndefined();
  });

  it("saves the card without a thumbnail when the payload is invalid", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const response = await createCard(deps, request({ body: { ...card, thumbnail: "not-a-data-url" } }));
    const cardId = JSON.parse(response.body).cardId as string;

    // The card saved; the malformed thumbnail was dropped, not stored.
    expect(response.statusCode).toBe(201);
    expect(store.puts).toBe(0);
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.thumbnailKey).toBeUndefined();
  });

  it("overwrites the thumbnail on re-save and updates the denormalized key", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const cardId = await seedCard(deps);
    await replaceCard(deps, request({ params: { cardId }, body: { ...card, thumbnail: thumbnailDataUrl("v2") } }));

    expect(store.objects.get(`${cardId}.png`)?.toString("utf8")).toBe("v2");
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.thumbnailKey).toBe(`${cardId}.png`);
    const membership = membershipKey("user-a", cardId);
    expect(deps.ddb.get(membership.PK, membership.SK)?.thumbnailKey).toBe(`${cardId}.png`);
  });

  it("leaves an existing thumbnail in place when a re-save sends none", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const cardId = await createCard(deps, request({ body: { ...card, thumbnail: thumbnailDataUrl("first") } }))
      .then((r) => JSON.parse(r.body).cardId as string);

    // A re-save with no thumbnail (e.g. generation failed in the browser) keeps
    // the prior thumbnail object rather than clearing it.
    await replaceCard(deps, request({ params: { cardId }, body: card }));

    expect(store.objects.get(`${cardId}.png`)?.toString("utf8")).toBe("first");
    expect(deps.ddb.get(cardMetaKey(cardId).PK, "META")?.thumbnailKey).toBe(`${cardId}.png`);
  });

  it("mints a presigned URL for each card with a thumbnail on list", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    // One card with a thumbnail, one without.
    const withThumb = await createCard(deps, request({ body: { ...card, thumbnail: thumbnailDataUrl() } }))
      .then((r) => JSON.parse(r.body).cardId as string);
    await seedCard(deps);

    const response = await listCards(deps, request());
    const cards = JSON.parse(response.body).cards as Array<{
      cardId: string;
      thumbnailKey?: string;
      thumbnailUrl?: string;
    }>;

    const withEntry = cards.find((c) => c.cardId === withThumb);
    const withoutEntry = cards.find((c) => c.cardId !== withThumb);
    expect(withEntry?.thumbnailKey).toBe(`${withThumb}.png`);
    expect(withEntry?.thumbnailUrl).toBeDefined();
    expect(withoutEntry?.thumbnailKey).toBeUndefined();
    expect(withoutEntry?.thumbnailUrl).toBeUndefined();
    // One presign per card that actually has a thumbnail — never for the other.
    expect(store.presigned).toHaveLength(1);
  });

  it("does not list another user's cards or presign their thumbnails", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    await createCard(deps, request({ userId: "user-a", body: { ...card, thumbnail: thumbnailDataUrl() } }));

    // Another user sees nothing: no cards, no presigned URLs leaked.
    const response = await listCards(deps, request({ userId: "user-b" }));
    expect(JSON.parse(response.body).cards).toEqual([]);
    expect(store.presigned).toHaveLength(0);
  });

  it("deletes the thumbnail object when the card is deleted", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const cardId = await createCard(deps, request({ body: { ...card, thumbnail: thumbnailDataUrl() } }))
      .then((r) => JSON.parse(r.body).cardId as string);

    await deleteCard(deps, request({ params: { cardId } }));

    expect(store.objects.has(`${cardId}.png`)).toBe(false);
    expect(store.deletes).toBe(1);
  });

  it("still completes deletion when no thumbnail existed", async () => {
    const deps = makeTestDeps();
    const store = thumbnailStoreOf(deps);

    const cardId = await seedCard(deps);
    await deleteCard(deps, request({ params: { cardId } }));

    expect(deps.ddb.items.size).toBe(0);
    expect(store.deletes).toBe(1);
  });
});
