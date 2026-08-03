import { describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { cardMetaKey, membershipKey, shareKey } from "../lib/keys.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import { createShare, listShares, resolveShare, revokeShare } from "./shares.ts";

const card = {
  slots: ["Airport", null],
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
  emojiScheme: { emojis: [] },
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

function seedOwnedCard(deps: TestDeps, cardId = "card-1", userId = "user-a") {
  deps.ddb.seed({ ...cardMetaKey(cardId), ...card, ownerId: userId, updatedAt: "t" });
  deps.ddb.seed({ ...membershipKey(userId, cardId), role: "owner", title: card.title, updatedAt: "t" });
}

describe("createShare", () => {
  it("stores a frozen snapshot, not a reference", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);

    const response = await createShare(deps, request({ params: { cardId: "card-1" } }));
    const { token } = JSON.parse(response.body);

    // Later edits by the owner must not reach through the link.
    deps.ddb.seed({ ...cardMetaKey("card-1"), ...card, title: "Edited later", ownerId: "user-a" });

    const resolved = await resolveShare(deps, request({ userId: null, params: { token } }));
    expect(JSON.parse(resolved.body).card.title).toBe("Road trip");
  });

  it("produces a 22-character base64url token", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);

    const response = await createShare(deps, request({ params: { cardId: "card-1" } }));
    const { token } = JSON.parse(response.body);

    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it("retries once when a token collides", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);

    // Occupy the token the first randomBytes call will produce.
    const firstToken = Buffer.alloc(16, 1).toString("base64url");
    deps.ddb.seed({ ...shareKey(firstToken), cardId: "other", ownerId: "someone", snapshot: card, createdAt: "t" });

    const response = await createShare(deps, request({ params: { cardId: "card-1" } }));
    const { token } = JSON.parse(response.body);

    expect(token).not.toBe(firstToken);
    // The occupied share was not overwritten.
    expect(deps.ddb.get(shareKey(firstToken).PK, "META")?.cardId).toBe("other");
  });

  it("refuses to share a card the caller does not own", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps, "card-1", "user-a");

    expect(
      await statusOf(createShare(deps, request({ userId: "user-b", params: { cardId: "card-1" } }))),
    ).toBe(404);
  });
});

describe("resolveShare", () => {
  it("serves the snapshot with no account", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    const { token } = JSON.parse(
      (await createShare(deps, request({ params: { cardId: "card-1" } }))).body,
    );

    const response = await resolveShare(deps, request({ userId: null, params: { token } }));

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body).card).toEqual(card);
  });

  it("does not leak the owner or the original card id", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    const { token } = JSON.parse(
      (await createShare(deps, request({ params: { cardId: "card-1" } }))).body,
    );

    const body = JSON.parse((await resolveShare(deps, request({ userId: null, params: { token } }))).body);

    expect(body).not.toHaveProperty("ownerId");
    expect(body).not.toHaveProperty("cardId");
  });

  it("returns 404 for an unknown token", async () => {
    const deps = makeTestDeps();
    expect(await statusOf(resolveShare(deps, request({ userId: null, params: { token: "nope" } })))).toBe(404);
  });

  it("sets no-store, so a shared snapshot is not cached anywhere", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    const { token } = JSON.parse(
      (await createShare(deps, request({ params: { cardId: "card-1" } }))).body,
    );

    const response = await resolveShare(deps, request({ userId: null, params: { token } }));
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["referrer-policy"]).toBe("no-referrer");
  });
});

describe("revokeShare", () => {
  it("makes a revoked link indistinguishable from one that never existed", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    const { token } = JSON.parse(
      (await createShare(deps, request({ params: { cardId: "card-1" } }))).body,
    );

    await revokeShare(deps, request({ params: { cardId: "card-1", token } }));

    const revoked = await statusOf(resolveShare(deps, request({ userId: null, params: { token } })));
    const neverExisted = await statusOf(
      resolveShare(deps, request({ userId: null, params: { token: "never-existed" } })),
    );

    expect(revoked).toBe(404);
    expect(revoked).toBe(neverExisted);
  });

  it("removes the owner-facing pointer too", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    const { token } = JSON.parse(
      (await createShare(deps, request({ params: { cardId: "card-1" } }))).body,
    );

    await revokeShare(deps, request({ params: { cardId: "card-1", token } }));

    const listed = JSON.parse((await listShares(deps, request({ params: { cardId: "card-1" } }))).body);
    expect(listed.shares).toEqual([]);
  });

  it("refuses to revoke a token belonging to a different card", async () => {
    // An owner of card-2 must not be able to revoke a share of card-1 by
    // guessing or obtaining its token.
    const deps = makeTestDeps();
    seedOwnedCard(deps, "card-1", "user-a");
    seedOwnedCard(deps, "card-2", "user-b");
    const { token } = JSON.parse(
      (await createShare(deps, request({ userId: "user-a", params: { cardId: "card-1" } }))).body,
    );

    expect(
      await statusOf(revokeShare(deps, request({ userId: "user-b", params: { cardId: "card-2", token } }))),
    ).toBe(404);
    expect(deps.ddb.get(shareKey(token).PK, "META")).toBeDefined();
  });
});

describe("listShares", () => {
  it("lists a card's links to its owner and refuses others", async () => {
    const deps = makeTestDeps();
    seedOwnedCard(deps);
    await createShare(deps, request({ params: { cardId: "card-1" } }));

    const listed = JSON.parse((await listShares(deps, request({ params: { cardId: "card-1" } }))).body);
    expect(listed.shares).toHaveLength(1);

    expect(
      await statusOf(listShares(deps, request({ userId: "user-b", params: { cardId: "card-1" } }))),
    ).toBe(404);
  });
});
