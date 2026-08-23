import { beforeEach, describe, expect, it } from "vitest";
import { HttpError } from "../http.ts";
import { notificationPrefsKey, notificationReadKey, userNotificationKey } from "../lib/keys.ts";
import { DEFAULT_PREFERENCES } from "../lib/notificationPayload.ts";
import { makeTestDeps, type TestDeps } from "../testing/fakeDdb.ts";
import type { RouteRequest } from "../request.ts";
import {
  getNotificationPreferences,
  listNotifications,
  markNotificationsRead,
  updateNotificationPreferences,
} from "./notifications.ts";

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

function seedNotification(userId: string, sortId: string, overrides: Record<string, unknown> = {}) {
  return { ...userNotificationKey(userId, sortId), ...overrides };
}

describe("listNotifications", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("returns an empty list and zero unread for a user with none", async () => {
    const body = JSON.parse((await listNotifications(deps, request())).body);
    expect(body).toEqual({ notifications: [], unreadCount: 0 });
  });

  it("lists most-recent-first with actor names resolved at read time", async () => {
    deps.ddb.seed(seedNotification("user-a", "2026-08-01T00:00:00.000Z#older", {
      type: "one_away",
      tripId: "trip-1",
      tripTitle: "Summer Road Trip",
      actorId: "user-b",
      tripCardId: "tc-1",
      createdAt: "2026-08-01T00:00:00.000Z",
    }));
    deps.ddb.seed(seedNotification("user-a", "2026-08-02T00:00:00.000Z#newer", {
      type: "victory",
      tripId: "trip-1",
      tripTitle: "Summer Road Trip",
      actorId: "user-b",
      tripCardId: "tc-2",
      createdAt: "2026-08-02T00:00:00.000Z",
    }));
    deps.ddb.seed({ PK: "USER#user-b", SK: "PROFILE", displayName: "Priya", createdAt: "t", updatedAt: "t" });

    const body = JSON.parse((await listNotifications(deps, request())).body);

    expect(body.notifications.map((n: { type: string }) => n.type)).toEqual(["victory", "one_away"]);
    // The name comes from the profile at read time, so a rename is reflected.
    expect(body.notifications[0].actorName).toBe("Priya");
    expect(body.unreadCount).toBe(2);
  });

  it("counts only entries newer than the read marker as unread", async () => {
    deps.ddb.seed(seedNotification("user-a", "2026-08-01T00:00:00.000Z#older", { type: "victory", tripId: "t", tripTitle: "T", actorId: "user-b", tripCardId: "c", createdAt: "2026-08-01T00:00:00.000Z" }));
    deps.ddb.seed({ ...notificationReadKey("user-a"), readUpTo: "2026-08-01T12:00:00.000Z", updatedAt: "t" });
    deps.ddb.seed(seedNotification("user-a", "2026-08-02T00:00:00.000Z#newer", { type: "one_away", tripId: "t", tripTitle: "T", actorId: "user-b", tripCardId: "c", createdAt: "2026-08-02T00:00:00.000Z" }));

    const body = JSON.parse((await listNotifications(deps, request())).body);
    expect(body.unreadCount).toBe(1);
    expect(body.notifications.find((n: { type: string }) => n.type === "victory").read).toBe(true);
    expect(body.notifications.find((n: { type: string }) => n.type === "one_away").read).toBe(false);
  });

  it("lists only the caller's own partition", async () => {
    deps.ddb.seed(seedNotification("user-b", "2026-08-02T00:00:00.000Z#x", { type: "victory", tripId: "t", tripTitle: "T", actorId: "user-a", tripCardId: "c", createdAt: "t" }));
    const body = JSON.parse((await listNotifications(deps, request())).body);
    expect(body.notifications).toEqual([]);
  });

  it("rejects a signed-out caller", async () => {
    expect(await statusOf(listNotifications(deps, request({ userId: null })))).toBe(401);
  });
});

describe("markNotificationsRead", () => {
  it("writes one read-up-to marker, not one write per row", async () => {
    const deps = makeTestDeps();
    for (let i = 0; i < 5; i += 1) {
      deps.ddb.seed(seedNotification("user-a", `2026-08-01T00:0${i}:00.000Z#r${i}`, { type: "victory", tripId: "t", tripTitle: "T", actorId: "user-b", tripCardId: "c", createdAt: "t" }));
    }

    const before = deps.ddb.sendCount;
    const body = JSON.parse((await markNotificationsRead(deps, request())).body);
    expect(body.readUpTo).toBe("2026-08-02T00:00:00.000Z");

    // One write for the marker itself; the rest of the calls are the reads
    // that decide whether to write and re-derive the honest count. No write
    // ever scales with the number of rows.
    const writes = [...deps.ddb.items.values()].filter((item) => item.SK === "NOTIFREAD");
    expect(writes).toHaveLength(1);

    const marker = deps.ddb.get(notificationReadKey("user-a").PK, notificationReadKey("user-a").SK);
    expect(marker?.readUpTo).toBe("2026-08-02T00:00:00.000Z");
    expect(deps.ddb.sendCount - before).toBe(4);

    const list = JSON.parse((await listNotifications(deps, request())).body);
    expect(list.unreadCount).toBe(0);
    expect(list.notifications.every((n: { read: boolean }) => n.read)).toBe(true);
  });

  it("reports the honest count: a same-millisecond notification stays unread", async () => {
    const deps = makeTestDeps();
    // Emitted in the same millisecond as the fixed test clock the marker
    // writes; its `#rand` sort suffix sorts after the bare timestamp, so it
    // must remain unread — and the response must say so rather than 0.
    deps.ddb.seed(seedNotification("user-a", "2026-08-02T00:00:00.000Z#rand", { type: "victory", tripId: "t", tripTitle: "T", actorId: "user-b", tripCardId: "c", createdAt: "2026-08-02T00:00:00.000Z" }));

    const body = JSON.parse((await markNotificationsRead(deps, request())).body);
    expect(body.unreadCount).toBe(1);

    const list = JSON.parse((await listNotifications(deps, request())).body);
    expect(list.unreadCount).toBe(1);
    expect(list.notifications[0].read).toBe(false);
  });

  it("never moves the marker backwards", async () => {
    const deps = makeTestDeps();
    deps.ddb.seed({ ...notificationReadKey("user-a"), readUpTo: "2027-01-01T00:00:00.000Z", updatedAt: "t" });

    // The fixed test clock (2026-08-02) is behind the stored marker: the
    // write is skipped and the stored value stands.
    await markNotificationsRead(deps, request());
    const marker = deps.ddb.get(notificationReadKey("user-a").PK, notificationReadKey("user-a").SK);
    expect(marker?.readUpTo).toBe("2027-01-01T00:00:00.000Z");
  });

  it("rejects a signed-out caller", async () => {
    const deps = makeTestDeps();
    expect(await statusOf(markNotificationsRead(deps, request({ userId: null })))).toBe(401);
  });
});

describe("notification preferences", () => {
  let deps: TestDeps;
  beforeEach(() => {
    deps = makeTestDeps();
  });

  it("returns the defaults for a user who has never saved", async () => {
    const body = JSON.parse((await getNotificationPreferences(deps, request())).body);
    expect(body.types).toEqual(DEFAULT_PREFERENCES.types);
    expect(body.mutedTripIds).toEqual([]);
    expect(body.updatedAt).toBeNull();
  });

  it("stores a valid submission and preserves createdAt across updates", async () => {
    const first = JSON.parse(
      (await updateNotificationPreferences(deps, request({
        body: { types: { progress_marked: true, one_away: false, victory: true }, mutedTripIds: ["trip-1"] },
      }))).body,
    );
    expect(first.types.progress_marked).toBe(true);
    expect(first.updatedAt).toBe("2026-08-02T00:00:00.000Z");

    await updateNotificationPreferences(deps, request({
      body: { types: { progress_marked: false, one_away: true, victory: true }, mutedTripIds: [] },
    }));

    const stored = deps.ddb.get(notificationPrefsKey("user-a").PK, notificationPrefsKey("user-a").SK);
    expect(stored?.createdAt).toBe("2026-08-02T00:00:00.000Z");
    const body = JSON.parse((await getNotificationPreferences(deps, request())).body);
    expect(body.types.one_away).toBe(true);
    expect(body.mutedTripIds).toEqual([]);
  });

  it("rejects an invalid submission whole, leaving stored preferences unchanged", async () => {
    await updateNotificationPreferences(deps, request({
      body: { types: { progress_marked: false, one_away: true, victory: true }, mutedTripIds: [] },
    }));

    expect(
      await statusOf(updateNotificationPreferences(deps, request({
        body: { types: { progress_marked: true }, mutedTripIds: [] },
      }))),
    ).toBe(400);
    expect(
      await statusOf(updateNotificationPreferences(deps, request({ body: { types: "nope", mutedTripIds: [] } }))),
    ).toBe(400);
    expect(
      await statusOf(updateNotificationPreferences(deps, request({
        body: { types: { progress_marked: true, one_away: true, victory: true }, mutedTripIds: [7] },
      }))),
    ).toBe(400);

    const body = JSON.parse((await getNotificationPreferences(deps, request())).body);
    expect(body.types).toEqual(DEFAULT_PREFERENCES.types);
  });

  it("rejects a signed-out caller on both routes", async () => {
    expect(await statusOf(getNotificationPreferences(deps, request({ userId: null })))).toBe(401);
    expect(await statusOf(updateNotificationPreferences(deps, request({ userId: null, body: { types: DEFAULT_PREFERENCES.types, mutedTripIds: [] } })))).toBe(401);
  });
});
