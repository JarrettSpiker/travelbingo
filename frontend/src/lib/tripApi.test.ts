import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./apiClient";
import {
  addTripCard,
  assignTripCard,
  createInvite,
  createTrip,
  deleteTrip,
  getTrip,
  listInvites,
  listTrips,
  redeemInvite,
  removeMember,
  removeTripCard,
  resolveInvite,
  revokeInvite,
  updateTrip,
} from "./tripApi";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

interface Call {
  url: string;
  init: RequestInit;
}

function makeClient(responses: Response[]) {
  const queue = [...responses];
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const next = queue.shift();
    if (!next) throw new Error("unexpected extra fetch");
    return next;
  }) as unknown as typeof fetch;

  const client = createApiClient({
    getAccessToken: async () => "token",
    refreshAccessToken: async () => "token",
    fetch: fetchMock,
  });

  return { client, calls };
}

function headersOf(call: Call): Record<string, string> {
  return (call.init.headers ?? {}) as Record<string, string>;
}

describe("tripApi routing", () => {
  it("GETs the caller's trips", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { trips: [{ tripId: "t1" }] })]);
    const trips = await listTrips(client);
    expect(trips).toEqual([{ tripId: "t1" }]);
    expect(calls[0].url).toBe("/api/trips");
    expect(calls[0].init.method).toBe("GET");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer token");
  });

  it("POSTs a new trip", async () => {
    const { client, calls } = makeClient([jsonResponse(201, { tripId: "t1" })]);
    await createTrip(client, { title: "Trip", mode: "cooperative" }, "you@example.com");
    expect(calls[0].url).toBe("/api/trips");
    expect(calls[0].init.method).toBe("POST");
  });

  it("GETs a trip detail", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { tripId: "t1" })]);
    await getTrip(client, "t1");
    expect(calls[0].url).toBe("/api/trips/t1");
  });

  it("PATCHes a trip", async () => {
    const { client, calls } = makeClient([jsonResponse(200, {})]);
    await updateTrip(client, "t1", { title: "x" });
    expect(calls[0].init.method).toBe("PATCH");
  });

  it("DELETEs a trip", async () => {
    const { client, calls } = makeClient([jsonResponse(204, null)]);
    await deleteTrip(client, "t1");
    expect(calls[0].init.method).toBe("DELETE");
  });

  it("creates, lists, and revokes invites against the trip invite path", async () => {
    const { client, calls } = makeClient([
      jsonResponse(201, { token: "tok", createdAt: "t" }),
      jsonResponse(200, { invites: [{ token: "tok", createdAt: "t" }] }),
      jsonResponse(204, null),
    ]);
    await createInvite(client, "t1");
    await listInvites(client, "t1");
    await revokeInvite(client, "t1", "tok");
    expect(calls[0].url).toBe("/api/trips/t1/invites");
    expect(calls[1].url).toBe("/api/trips/t1/invites");
    expect(calls[2].url).toBe("/api/trips/t1/invites/tok");
  });

  it("removes a member against the member path", async () => {
    const { client, calls } = makeClient([jsonResponse(204, null)]);
    await removeMember(client, "t1", "user-b");
    expect(calls[0].url).toBe("/api/trips/t1/members/user-b");
  });

  it("adds, assigns, and removes trip cards", async () => {
    const { client, calls } = makeClient([
      jsonResponse(201, { tripCardId: "tc", snapshot: {}, ownerId: "a", createdAt: "t" }),
      jsonResponse(200, {}),
      jsonResponse(204, null),
    ]);
    await addTripCard(client, "t1", "card-1");
    await assignTripCard(client, "t1", "tc", "user-b");
    await removeTripCard(client, "t1", "tc");
    expect(calls[0].url).toBe("/api/trips/t1/cards");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[1].url).toBe("/api/trips/t1/cards/tc");
    expect(calls[1].init.method).toBe("PATCH");
    expect(calls[2].init.method).toBe("DELETE");
  });

  it("redeems an invite with authentication", async () => {
    const { client, calls } = makeClient([jsonResponse(201, { tripId: "t1" })]);
    await redeemInvite(client, "tok", "you@example.com");
    expect(calls[0].url).toBe("/api/invites/tok/redeem");
    expect(calls[0].init.method).toBe("POST");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer token");
  });

  it("resolves an invite anonymously — no Authorization header", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { title: "Trip", createdAt: "t" })]);
    const body = await resolveInvite(client, "tok");
    expect(body.title).toBe("Trip");
    expect(calls[0].url).toBe("/api/invites/tok");
    // The public route: the client must not attach a token.
    expect(headersOf(calls[0]).Authorization).toBeUndefined();
  });

  it("encodes unsafe characters in path segments", async () => {
    const { client, calls } = makeClient([jsonResponse(204, null)]);
    await revokeInvite(client, "t1", "tok/with%slash");
    expect(calls[0].url).toBe("/api/trips/t1/invites/tok%2Fwith%25slash");
  });
});
