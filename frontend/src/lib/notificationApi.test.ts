import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./apiClient";
import {
  getNotificationPreferences,
  getTripActivity,
  listNotifications,
  markNotificationsRead,
  updateNotificationPreferences,
} from "./notificationApi";

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

describe("notificationApi routing", () => {
  it("GETs the caller's notifications with the unread count", async () => {
    const { client, calls } = makeClient([
      jsonResponse(200, { notifications: [{ type: "victory", read: false }], unreadCount: 1 }),
    ]);
    const list = await listNotifications(client);
    expect(list.unreadCount).toBe(1);
    expect(calls[0].url).toBe("/api/me/notifications");
    expect(calls[0].init.method).toBe("GET");
    expect(headersOf(calls[0]).Authorization).toBe("Bearer token");
  });

  it("POSTs the read marker", async () => {
    const { client, calls } = makeClient([jsonResponse(200, { unreadCount: 0 })]);
    await markNotificationsRead(client);
    expect(calls[0].url).toBe("/api/me/notifications/read");
    expect(calls[0].init.method).toBe("POST");
  });

  it("GETs and PUTs the caller's preferences", async () => {
    const { client, calls } = makeClient([
      jsonResponse(200, { types: { progress_marked: false, one_away: true, victory: true }, mutedTripIds: [], updatedAt: null }),
      jsonResponse(200, { types: { progress_marked: true, one_away: true, victory: true }, mutedTripIds: ["t1"], updatedAt: "t" }),
    ]);

    const stored = await getNotificationPreferences(client);
    expect(stored.updatedAt).toBeNull();

    const saved = await updateNotificationPreferences(client, {
      types: { progress_marked: true, one_away: true, victory: true },
      mutedTripIds: ["t1"],
    });
    expect(saved.mutedTripIds).toEqual(["t1"]);

    expect(calls[0].url).toBe("/api/me/notification-preferences");
    expect(calls[1].init.method).toBe("PUT");
    expect(calls[1].init.body).toEqual(
      JSON.stringify({ types: { progress_marked: true, one_away: true, victory: true }, mutedTripIds: ["t1"] }),
    );
  });

  it("GETs a trip's activity feed, unwrapping its events", async () => {
    const { client, calls } = makeClient([
      jsonResponse(200, { events: [{ type: "one_away", actorId: "u1", actorName: null, tripCardId: "tc", createdAt: "t" }] }),
    ]);
    const events = await getTripActivity(client, "t1");
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("one_away");
    expect(calls[0].url).toBe("/api/trips/t1/activity");
  });

  it("tolerates an activity response with no events array", async () => {
    const { client } = makeClient([jsonResponse(200, {})]);
    expect(await getTripActivity(client, "t1")).toEqual([]);
  });
});
