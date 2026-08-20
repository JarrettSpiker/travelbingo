import { BellRing, PartyPopper, Square } from "lucide-react";
import type { NotificationEventType } from "./notificationTypes";

// Presentation vocabulary shared by the bell's dropdown and the activity feed:
// one verb and one icon per event kind, so the two surfaces cannot drift apart.
// Lives beside notificationTypes.ts but apart from it — that file is the
// hand-mirrored wire vocabulary and stays free of UI imports.

/** What a member did, in plain language. */
export const EVENT_VERBS: Readonly<Record<NotificationEventType, string>> = {
  progress_marked: "marked a square",
  one_away: "is one square from winning",
  victory: "won a card",
};

/** One icon per kind, so a full list scans without reading every verb. */
export const EVENT_ICONS: Readonly<Record<NotificationEventType, typeof BellRing>> = {
  progress_marked: Square,
  one_away: BellRing,
  victory: PartyPopper,
};
