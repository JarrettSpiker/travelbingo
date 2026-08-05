// Pure helpers for the editor route's ?card=<id> query param.
//
// The durable identity of the card open in the editor lives in the URL so a
// reload, back/forward, or bookmark can restore it. These helpers are kept out
// of the route component so the parse/build logic is unit-testable without a
// DOM (the rest of the app's testable logic lives in src/lib/ for the same
// reason).

export const CARD_QUERY_PARAM = "card";

/**
 * Reads the open-card id from a search string (or URLSearchParams). Returns
 * null when the param is absent or empty, so a caller can treat "no card in the
 * URL" as a single null branch.
 */
export function readCardParam(search: string | URLSearchParams): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get(CARD_QUERY_PARAM);
  return value && value.length > 0 ? value : null;
}

/** Builds the editor path with the given card id encoded as the ?card= param. */
export function editorPathWithCard(cardId: string): string {
  return `/?${CARD_QUERY_PARAM}=${encodeURIComponent(cardId)}`;
}
