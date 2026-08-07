import { badRequest } from "../http.ts";

/**
 * Mirrors MAX_DISPLAY_NAME_LENGTH in frontend/src/lib/profileApi.ts. A single
 * bounded string is far lower risk than the saved-card shape, so the mirrored
 * constant (with a comment) is the proportionate safeguard rather than a
 * cross-package contract test.
 */
export const MAX_DISPLAY_NAME_LENGTH = 50;

/**
 * Parses a display name submitted on a profile write.
 *
 * Follows the "validate, never correct" rule from cardPayload.ts: a value that
 * violates the bound is rejected with 400 rather than silently stored. Rejects
 * non-strings and over-length values, trims surrounding whitespace, and returns
 * null for an empty-after-trim value so an empty submit clears the stored name.
 */
export function parseDisplayName(input: unknown): string | null {
  if (typeof input !== "string") {
    throw badRequest("displayName must be a string");
  }
  if (input.length > MAX_DISPLAY_NAME_LENGTH) {
    throw badRequest(`displayName must be at most ${MAX_DISPLAY_NAME_LENGTH} characters`);
  }
  const trimmed = input.trim();
  return trimmed === "" ? null : trimmed;
}
