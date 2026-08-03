import type { ApiClient } from "./apiClient";
import type { CardUrlData } from "./cardUrl";
import { fromSavedCardPayload, toSavedCardPayload, type SavedCardSummary } from "./savedCard";

// Thin, typed wrapper over the API's card and share routes. Keeping the paths
// in one place means a route change is one edit, and keeps the pages free of
// URL strings.

export interface ShareLink {
  token: string;
  createdAt: string;
}

export async function listCards(api: ApiClient): Promise<SavedCardSummary[]> {
  const body = await api.request<{ cards: SavedCardSummary[] }>("/api/cards");
  return body.cards ?? [];
}

export async function createCard(api: ApiClient, data: CardUrlData): Promise<SavedCardSummary> {
  return api.request<SavedCardSummary>("/api/cards", {
    method: "POST",
    body: toSavedCardPayload(data),
  });
}

export async function getCard(api: ApiClient, cardId: string): Promise<CardUrlData | null> {
  const body = await api.request<{ card: unknown }>(`/api/cards/${encodeURIComponent(cardId)}`);
  return fromSavedCardPayload(body.card);
}

export async function replaceCard(
  api: ApiClient,
  cardId: string,
  data: CardUrlData,
): Promise<SavedCardSummary> {
  return api.request<SavedCardSummary>(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: "PUT",
    body: toSavedCardPayload(data),
  });
}

export async function renameCard(api: ApiClient, cardId: string, title: string): Promise<SavedCardSummary> {
  return api.request<SavedCardSummary>(`/api/cards/${encodeURIComponent(cardId)}`, {
    method: "PATCH",
    body: { title },
  });
}

export async function deleteCard(api: ApiClient, cardId: string): Promise<void> {
  await api.request<void>(`/api/cards/${encodeURIComponent(cardId)}`, { method: "DELETE" });
}

export async function listShares(api: ApiClient, cardId: string): Promise<ShareLink[]> {
  const body = await api.request<{ shares: ShareLink[] }>(
    `/api/cards/${encodeURIComponent(cardId)}/shares`,
  );
  return body.shares ?? [];
}

export async function createShare(api: ApiClient, cardId: string): Promise<ShareLink> {
  return api.request<ShareLink>(`/api/cards/${encodeURIComponent(cardId)}/shares`, { method: "POST" });
}

export async function revokeShare(api: ApiClient, cardId: string, token: string): Promise<void> {
  await api.request<void>(
    `/api/cards/${encodeURIComponent(cardId)}/shares/${encodeURIComponent(token)}`,
    { method: "DELETE" },
  );
}

/** The one call that works with no account. */
export async function resolveShare(api: ApiClient, token: string): Promise<CardUrlData | null> {
  const body = await api.request<{ card: unknown }>(`/api/shares/${encodeURIComponent(token)}`, {
    anonymous: true,
  });
  return fromSavedCardPayload(body.card);
}

export function shareUrl(token: string): string {
  return `${window.location.origin}/s/${token}`;
}
