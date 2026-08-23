import type { ApiClient } from "./apiClient";
import type {
  NotificationList,
  NotificationPreferences,
  StoredNotificationPreferences,
  TripActivityEvent,
} from "./notificationTypes";

// Thin, typed wrapper over the notification routes — the same pattern as
// tripApi.ts. Every call goes through the auth-gated client: notifications are
// an account-only feature, and a signed-out visitor never reaches this module.

export async function listNotifications(api: ApiClient): Promise<NotificationList> {
  return api.request<NotificationList>("/api/me/notifications");
}

export async function markNotificationsRead(api: ApiClient): Promise<void> {
  await api.request<void>("/api/me/notifications/read", { method: "POST" });
}

export async function getNotificationPreferences(
  api: ApiClient,
): Promise<StoredNotificationPreferences> {
  return api.request<StoredNotificationPreferences>("/api/me/notification-preferences");
}

export async function updateNotificationPreferences(
  api: ApiClient,
  preferences: NotificationPreferences,
): Promise<StoredNotificationPreferences> {
  return api.request<StoredNotificationPreferences>("/api/me/notification-preferences", {
    method: "PUT",
    body: preferences,
  });
}

export async function getTripActivity(api: ApiClient, tripId: string): Promise<TripActivityEvent[]> {
  const body = await api.request<{ events: TripActivityEvent[] }>(
    `/api/trips/${encodeURIComponent(tripId)}/activity`,
  );
  return body.events ?? [];
}
