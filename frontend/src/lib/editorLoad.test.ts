import { describe, expect, it, vi } from "vitest";
import { ApiError, createApiClient, type ApiClient } from "./apiClient";
import { editorLoadMode, fetchCardForReload, shouldFetchCard } from "./editorLoad";
import type { CardUrlData } from "./cardData";

function input(overrides: {
  incoming?: CardUrlData | null;
  urlCardId?: string | null;
  status?: "loading" | "anonymous" | "authenticated";
}) {
  return {
    incoming: overrides.incoming ?? null,
    urlCardId: overrides.urlCardId ?? null,
    status: overrides.status ?? "anonymous",
  };
}

describe("editorLoadMode", () => {
  it("is instant when a card was handed over in memory", () => {
    expect(editorLoadMode(input({ incoming: {} as CardUrlData, urlCardId: "abc", status: "authenticated" }))).toBe(
      "instant",
    );
  });

  it("is loading when authenticated with a card id in the URL (reload-restore)", () => {
    expect(editorLoadMode(input({ urlCardId: "abc", status: "authenticated" }))).toBe("loading");
  });

  it("is loading while auth is still resolving and a card id is present (no empty-editor flash)", () => {
    expect(editorLoadMode(input({ urlCardId: "abc", status: "loading" }))).toBe("loading");
  });

  it("is empty when there is no card id in the URL, signed in or not", () => {
    expect(editorLoadMode(input({ status: "authenticated" }))).toBe("empty");
    expect(editorLoadMode(input({ status: "anonymous" }))).toBe("empty");
    expect(editorLoadMode(input({ status: "loading" }))).toBe("empty");
  });

  it("is empty for a signed-out visitor with a card id (no fetch; the editor prompts sign-in)", () => {
    expect(editorLoadMode(input({ urlCardId: "abc", status: "anonymous" }))).toBe("empty");
  });
});

describe("shouldFetchCard", () => {
  it("fetches when authenticated with a card id and no in-memory card", () => {
    expect(shouldFetchCard(input({ urlCardId: "abc", status: "authenticated" }))).toBe(true);
  });

  it("never fetches when a card was handed over in memory (instant path wins)", () => {
    expect(
      shouldFetchCard(input({ incoming: {} as CardUrlData, urlCardId: "abc", status: "authenticated" })),
    ).toBe(false);
  });

  it("never fetches when there is no card id in the URL", () => {
    expect(shouldFetchCard(input({ status: "authenticated" }))).toBe(false);
  });

  it("never fetches for a signed-out visitor (zero API calls invariant)", () => {
    expect(shouldFetchCard(input({ urlCardId: "abc", status: "anonymous" }))).toBe(false);
    expect(shouldFetchCard(input({ urlCardId: "abc", status: "loading" }))).toBe(false);
  });
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeApi(responses: Response[]): ApiClient {
  const queue = [...responses];
  const fetchMock = vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next;
  }) as unknown as typeof fetch;
  return createApiClient({
    getAccessToken: async () => "token",
    refreshAccessToken: async () => "token",
    fetch: fetchMock,
  });
}

const PAYLOAD = {
  slots: ["Airport", null, "Dog"],
  title: "Road trip",
  hasFreeSpace: true,
  freeSpaceText: "FREE",
  colorScheme: { backgroundColor: "#ffffff", cellColor: "#eeeeee", textColor: "#1a1a1a", titleColor: "#1a1a1a" },
  fontScheme: { titleFont: "system-ui, sans-serif", cellFont: "'Poppins', sans-serif" },
  emojiScheme: { emojis: ["🚗"] },
};

describe("fetchCardForReload", () => {
  it("returns the decoded card on a successful fetch", async () => {
    const api = makeApi([jsonResponse(200, { card: PAYLOAD })]);
    const card = await fetchCardForReload(api, "card-1");
    expect(card).not.toBeNull();
    expect(card?.title).toBe("Road trip");
    expect(card?.slots).toEqual(["Airport", null, "Dog"]);
  });

  it("returns null on a 404 — absent and other-user's cards look identical", async () => {
    // The server returns 404 whether the card does not exist or belongs to
    // someone else. The wrapper must not distinguish them.
    const api = makeApi([jsonResponse(404, { error: "not_found" })]);
    expect(await fetchCardForReload(api, "someone-elses")).toBeNull();
  });

  it("returns null on any other error, indistinguishable from a 404", async () => {
    const api = makeApi([jsonResponse(500, { error: "internal" })]);
    expect(await fetchCardForReload(api, "card-1")).toBeNull();
  });

  it("swallows an ApiError rather than throwing into the route", async () => {
    const api = makeApi([jsonResponse(404, { error: "not_found" })]);
    await expect(fetchCardForReload(api, "card-1")).resolves.toBeNull();
    // Sanity: the underlying client really does throw for a 404, so the null is
    // the wrapper doing its job, not a request that never happened.
    const throwing = makeApi([jsonResponse(404, { error: "not_found" })]);
    await expect(throwing.request("/api/cards/card-1")).rejects.toBeInstanceOf(ApiError);
  });
});
