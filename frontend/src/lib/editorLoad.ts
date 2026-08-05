import type { ApiClient } from "./apiClient";
import type { CardUrlData } from "./cardData";
import { getCard } from "./cardsApi";

// Pure decisions for the editor route's load path, extracted so the auth/privacy
// invariants — "no fetch when signed out", "no fetch when there is no card id",
// "a missing or other-user's card is indistinguishable from absent" — are
// unit-testable without rendering the component.
//
// Mirrors AuthStatus from src/auth/authContext.ts as a literal union rather than
// importing it, to keep this module inside the src/lib/ purity boundary.

export type EditorLoadStatus = "loading" | "anonymous" | "authenticated";

export type EditorLoadMode = "instant" | "loading" | "empty";

export interface EditorLoadInput {
  /** A card handed over via in-memory navigation state (the instant-open path). */
  incoming: CardUrlData | null;
  /** The open-card id read from the ?card= query param, if any. */
  urlCardId: string | null;
  status: EditorLoadStatus;
}

/**
 * Decides what the editor route should render around the reload-fetch.
 *
 * "loading" covers both "auth status still resolving" and "authenticated and
 * fetching" — in both cases a spinner is shown, and critically a returning
 * signed-in user with a card in the URL never sees a flash of the empty editor
 * while the auth check resolves.
 */
export function editorLoadMode(input: EditorLoadInput): EditorLoadMode {
  if (input.incoming) return "instant";
  if (input.urlCardId && (input.status === "authenticated" || input.status === "loading")) {
    return "loading";
  }
  return "empty";
}

/**
 * True only when the route should fire a card fetch this render: a card id is
 * present in the URL, no card was handed over in memory, and the visitor is
 * signed in. This is the single gate that enforces the signed-out zero-API-call
 * invariant for the reload-restore path.
 */
export function shouldFetchCard(input: EditorLoadInput): boolean {
  return input.incoming === null && input.urlCardId !== null && input.status === "authenticated";
}

/**
 * Fetches the open card for the reload-restore path.
 *
 * Any failure — a missing card, another user's card (both 404 from the server,
 * by design), or a network error — resolves to null. The editor then degrades
 * to empty, revealing nothing about whether the card exists. The privacy
 * boundary itself is the server's (requireCardRole returns 404 for non-members);
 * this wrapper simply refuses to distinguish the cases client-side.
 */
export async function fetchCardForReload(api: ApiClient, cardId: string): Promise<CardUrlData | null> {
  try {
    return await getCard(api, cardId);
  } catch {
    return null;
  }
}
