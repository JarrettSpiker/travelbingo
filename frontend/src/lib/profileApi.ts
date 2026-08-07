import type { ApiClient } from "./apiClient";

// Thin, typed wrapper over the API's profile routes — the same pattern as
// cardsApi.ts. The paths live here so pages stay free of URL strings.

/**
 * Mirrors MAX_DISPLAY_NAME_LENGTH in backend/src/lib/profilePayload.ts. Kept in
 * sync by hand and a comment: a single bounded string is far lower risk than the
 * saved-card shape, so the mirrored constant is the proportionate safeguard
 * rather than a cross-package contract test. The backend rejects anything over
 * the bound regardless of what the client allows.
 */
export const MAX_DISPLAY_NAME_LENGTH = 50;

export interface Profile {
  displayName: string | null;
  updatedAt: string | null;
}

export async function getProfile(api: ApiClient): Promise<Profile> {
  return api.request<Profile>("/api/me/profile");
}

export async function updateProfile(api: ApiClient, displayName: string): Promise<Profile> {
  return api.request<Profile>("/api/me/profile", {
    method: "PUT",
    body: { displayName },
  });
}
