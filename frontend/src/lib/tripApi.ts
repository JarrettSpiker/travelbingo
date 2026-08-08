import type { ApiClient } from "./apiClient";
import type {
  Invite,
  TripCard,
  TripDetail,
  TripInput,
  TripSummary,
  TripUpdate,
} from "./tripTypes";

// Thin, typed wrapper over the API's trip and invite routes — the same pattern
// as cardsApi.ts. The paths live here so pages stay free of URL strings, and
// every call goes through the auth-gated client (signed-out visitors never
// reach this module).

export async function listTrips(api: ApiClient): Promise<TripSummary[]> {
  const body = await api.request<{ trips: TripSummary[] }>("/api/trips");
  return body.trips ?? [];
}

/**
 * Creates a trip. `email` is the caller's own, sent so trip-mates can identify
 * them before a display name is set — display only, never authoritative (the
 * backend still derives identity from the verified `sub`).
 */
export async function createTrip(
  api: ApiClient,
  input: TripInput,
  email: string | null,
): Promise<{ tripId: string }> {
  return api.request<{ tripId: string }>("/api/trips", {
    method: "POST",
    body: { ...input, ...(email ? { email } : {}) },
  });
}

export async function getTrip(api: ApiClient, tripId: string): Promise<TripDetail> {
  return api.request<TripDetail>(`/api/trips/${encodeURIComponent(tripId)}`);
}

export async function updateTrip(api: ApiClient, tripId: string, input: TripUpdate): Promise<void> {
  await api.request<void>(`/api/trips/${encodeURIComponent(tripId)}`, { method: "PATCH", body: input });
}

export async function deleteTrip(api: ApiClient, tripId: string): Promise<void> {
  await api.request<void>(`/api/trips/${encodeURIComponent(tripId)}`, { method: "DELETE" });
}

export async function createInvite(api: ApiClient, tripId: string): Promise<Invite> {
  return api.request<Invite>(`/api/trips/${encodeURIComponent(tripId)}/invites`, { method: "POST" });
}

export async function listInvites(api: ApiClient, tripId: string): Promise<Invite[]> {
  const body = await api.request<{ invites: Invite[] }>(
    `/api/trips/${encodeURIComponent(tripId)}/invites`,
  );
  return body.invites ?? [];
}

export async function revokeInvite(api: ApiClient, tripId: string, token: string): Promise<void> {
  await api.request<void>(
    `/api/trips/${encodeURIComponent(tripId)}/invites/${encodeURIComponent(token)}`,
    { method: "DELETE" },
  );
}

export async function removeMember(api: ApiClient, tripId: string, userId: string): Promise<void> {
  await api.request<void>(
    `/api/trips/${encodeURIComponent(tripId)}/members/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}

export async function addTripCard(api: ApiClient, tripId: string, cardId: string): Promise<TripCard> {
  return api.request<TripCard>(`/api/trips/${encodeURIComponent(tripId)}/cards`, {
    method: "POST",
    body: { cardId },
  });
}

export async function removeTripCard(api: ApiClient, tripId: string, tripCardId: string): Promise<void> {
  await api.request<void>(
    `/api/trips/${encodeURIComponent(tripId)}/cards/${encodeURIComponent(tripCardId)}`,
    { method: "DELETE" },
  );
}

export async function assignTripCard(
  api: ApiClient,
  tripId: string,
  tripCardId: string,
  assignedMemberId: string,
): Promise<void> {
  await api.request<void>(
    `/api/trips/${encodeURIComponent(tripId)}/cards/${encodeURIComponent(tripCardId)}`,
    { method: "PATCH", body: { assignedMemberId } },
  );
}

/** The one call reachable without an account: shows the trip title on the invite landing page. */
export async function resolveInvite(
  api: ApiClient,
  token: string,
): Promise<{ title: string; createdAt: string }> {
  return api.request<{ title: string; createdAt: string }>(
    `/api/invites/${encodeURIComponent(token)}`,
    { anonymous: true },
  );
}

export async function redeemInvite(
  api: ApiClient,
  token: string,
  email: string | null,
): Promise<{ tripId: string }> {
  return api.request<{ tripId: string }>(`/api/invites/${encodeURIComponent(token)}/redeem`, {
    method: "POST",
    body: email ? { email } : {},
  });
}

/** The shareable URL for an invite, paralleling `shareUrl` for share links. */
export function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}
