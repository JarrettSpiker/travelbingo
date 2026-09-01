import type { BrandCopy } from "../types";

/**
 * Office Lingo Bingo's wording.
 *
 * The noun is **"meeting"**, not "meeting series". Both were considered: the
 * thing being named really is a series of meetings, but "meeting series" is
 * four syllables that has to survive every sentence in the app, and the
 * possessive ("a meeting series's mode") is unsayable. "Meeting" is what
 * someone would actually call it, and the satire lands harder for being plain.
 *
 * The register is the joke: this brand says "stakeholders" where the travel
 * brand says "friends", and nothing here is written with a smile.
 */
export const officeCopy: BrandCopy = {
  noun: {
    trip: "meeting",
    trips: "meetings",
    Trip: "Meeting",
    Trips: "Meetings",
  },

  nav: {
    trips: "Meetings",
  },

  trips: {
    signedOutPitch: "Sign in to align stakeholders and bingo cards under one meeting.",
    emptyState:
      "You are not in any meetings yet. Create one to bring stakeholders and cards together for a recurring sync.",
    modeHint: "A meeting's mode cannot be changed after it has been created.",
    winConditionUnreachable: (count) =>
      count === 1
        ? "One card already in this meeting can't reach this target — its blank squares can never be marked. You can still choose it, and fuller cards can be added later."
        : `${count} cards already in this meeting can't reach this target — their blank squares can never be marked. You can still choose it, and fuller cards can be added later.`,
    deleteWarning:
      "The meeting, its attendees, its cards, and its invite links will all be removed. This cannot be undone.",
    removeMemberWarning:
      "They will immediately lose access to the meeting and its cards. Any cards they added stay.",
    endedNotice:
      "This meeting has concluded, so its cards can no longer be marked. Everyone's progress stays visible.",
    noLongerAvailable:
      "That meeting is no longer available — you may have been removed from it, or it may have been deleted.",
    notFoundOrNotMember: "This meeting could not be found, or you are not an attendee.",
    inviteInvalidReason: "unknown, revoked, or meeting deleted",
  },

  editor: {
    titlePlaceholder: "e.g. Q3 Planning Sync",
    entryPlaceholder: "e.g. Says 'synergy'",
  },

  share: {
    fallbackCardName: "A shared bingo card",
  },

  exportFile: {
    defaultPngName: "bingo-card.png",
  },
};
