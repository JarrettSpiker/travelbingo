import type { BrandCopy } from "../types";

/**
 * Travel Bingo's wording.
 *
 * Every value here is what the app said before the brand seam existed, moved
 * rather than rewritten — phase 3 of this change moves strings and must not
 * move pixels.
 */
export const travelCopy: BrandCopy = {
  noun: {
    trip: "trip",
    trips: "trips",
    Trip: "Trip",
    Trips: "Trips",
  },

  nav: {
    trips: "Trips",
  },

  trips: {
    signedOutPitch: "Sign in to gather friends and bingo cards under one trip.",
    emptyState:
      "You are not in any trips yet. Create one to gather friends and cards for an event.",
    modeHint: "A trip's mode can't be changed after it's created.",
    winConditionUnreachable: (count) =>
      count === 1
        ? "One card already in this trip can't reach this target — its blank squares can never be marked. You can still choose it, and fuller cards can be added later."
        : `${count} cards already in this trip can't reach this target — their blank squares can never be marked. You can still choose it, and fuller cards can be added later.`,
    deleteWarning:
      "The trip, its members, its cards, and its invite links will all be removed. This cannot be undone.",
    removeMemberWarning:
      "They will immediately lose access to the trip and its cards. Any cards they added stay.",
    endedNotice:
      "This trip has ended, so its cards can no longer be marked. Everyone's progress stays visible.",
    noLongerAvailable:
      "That trip is no longer available — you may have been removed from it, or it may have been deleted.",
    notFoundOrNotMember: "This trip could not be found, or you are not a member.",
    inviteInvalidReason: "unknown, revoked, or trip deleted",
  },

  editor: {
    titlePlaceholder: "e.g. Our Cross Country Road Trip",
    entryPlaceholder: "e.g. See local wildlife",
  },

  share: {
    fallbackCardName: "A shared bingo card",
  },

  exportFile: {
    defaultPngName: "bingo-card.png",
  },

  feedback: {
    linkLabel: "Send feedback",
    intro: "Found something broken, or something missing? Tell us — it goes straight to the person who builds this.",
    messageLabel: "What's on your mind?",
    messagePlaceholder: "e.g. The printed card cut off the bottom row",
    contactLabel: "Your email (optional)",
    contactHint: "Only used to write back to you about this. Leave it blank and we won't.",
    submitLabel: "Send",
    successMessage: "Thanks — that's been sent.",
    capReachedMessage: "You've sent a lot of feedback today. Try again tomorrow.",
    errorMessage: "That didn't send. Have another go in a moment.",
    signedOutPrompt: "Sign in to send feedback. Signing in uses your Google account.",
  },
};
