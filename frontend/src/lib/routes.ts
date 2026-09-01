/**
 * Every path the app navigates to, in one place.
 *
 * **Paths are brand-invariant.** The office brand renders "Meetings" and still
 * routes `/trips`, and that is a decision rather than an oversight: invite and
 * share links are *persisted capability URLs*, minted once and kept by whoever
 * received them. A brand-dependent path would make every already-issued link a
 * function of the brand that issued it — a broken-link class of bug, for no
 * user benefit. `trip` stays the code word throughout; `brand.copy.noun` is the
 * display word.
 *
 * So this file is a hedge, not a mechanism. It costs about twenty lines and it
 * makes the decision reversible in one file rather than at twenty call sites,
 * which is the only reason it exists.
 *
 * The literals in `routes.tsx`'s `<Route path=…>` are deliberately *not* built
 * from these. A route table that reads from the same constants it defines
 * cannot disagree with itself, and that is exactly the disagreement worth
 * catching — the pattern strings there and the concrete paths here answer
 * different questions.
 */
export const ROUTES = {
  editor: "/",
  cards: "/cards",
  settings: "/settings",
  trips: "/trips",
  newTrip: "/trips/new",
  authCallback: "/auth/callback",

  trip: (tripId: string) => `/trips/${tripId}`,
  editTrip: (tripId: string) => `/trips/${tripId}/edit`,

  /** Capability URLs. Both are minted, persisted, and shared. */
  sharedCard: (token: string) => `/s/${token}`,
  invite: (token: string) => `/invite/${token}`,
} as const;
