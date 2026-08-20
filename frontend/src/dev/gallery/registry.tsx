import { type ReactNode } from "react";
import { ShareLinkDialog } from "../../components/ShareLinkDialog";
import { SuggestionsDialog } from "../../components/SuggestionsDialog";
import { UnsavedChangesDialog } from "../../components/UnsavedChangesDialog";
import { CardWinStatus } from "../../components/CardWinStatus";
import { DEFAULT_COLOR_SCHEME } from "../../lib/colorScheme";
import { DEFAULT_EMOJI_SCHEME } from "../../lib/emojiScheme";
import type { Notification } from "../../lib/notificationTypes";
import {
  FEW_ENTRIES,
  MANDATORY_OVERFLOW_ENTRIES,
  OVER_CAPACITY_ENTRIES,
  MIDNIGHT_COLORS,
  SAMPLE_FULL_MARKS,
  SAMPLE_MARKED_SLOTS,
  SUNSET_COLORS,
} from "./sampleData";
import {
  AppShellSample,
  PanelSample,
  SiteHeaderSample,
  ThemeToggleSample,
  TokenStrip,
} from "./designSamples";
import {
  AuthMenuSample,
  CardDetailsFormSample,
  CardGridSample,
  CardViewSample,
  ColorSchemeFormSample,
  DialogSample,
  EmojiSchemeFormSample,
  EntryInputSample,
  FontSchemeFormSample,
  NotificationBellButtonSample,
  NotificationListSample,
  NotificationPreferencesFormSample,
  ActivityFeedSample,
  PlayableCardGridSample,
  SettingsPageSample,
  WinConditionSelectSample,
} from "./samples";

/** Fixed date formatting for the win-status states, so captures are stable. */
const sampleWinDate = () => "Aug 4, 2026";

/** A fixed notification fixture, so the list states are comparable. */
const sampleNotification = (overrides: Partial<Notification>): Notification => ({
  type: "one_away",
  tripId: "trip-1",
  tripTitle: "Summer Road Trip",
  actorId: "user-b",
  actorName: "Priya",
  tripCardId: "tc-1",
  createdAt: "2026-08-02T12:00:00.000Z",
  read: false,
  ...overrides,
});

/**
 * The gallery registry.
 *
 * Every entry renders the REAL component — never a copy — so a change to a
 * component shows up here without anyone remembering to update the gallery.
 * `source` names the file in `src/components/` the entry covers; the coverage
 * test in this directory reads those names and fails when a component has none.
 */
export interface GalleryState {
  label: string;
  node: ReactNode;
}

export interface GalleryEntry {
  /**
   * Repo-relative file this entry covers, e.g. "src/components/EntryInput.tsx".
   *
   * A full path rather than a bare filename because not everything reviewable
   * here is a component — the token strip covers `src/index.css`.
   */
  source: string;
  title: string;
  states: GalleryState[];
}

export const GALLERY_ENTRIES: GalleryEntry[] = [
  {
    source: "src/index.css",
    title: "Design tokens",
    states: [{ label: "Every token, in this presentation", node: <TokenStrip /> }],
  },
  {
    source: "src/components/AppShell.tsx",
    title: "App shell",
    states: [{ label: "Header, background layers, and the main column", node: <AppShellSample /> }],
  },
  {
    source: "src/components/Panel.tsx",
    title: "Panel",
    states: [{ label: "A control group as a surface", node: <PanelSample /> }],
  },
  {
    source: "src/components/SiteHeader.tsx",
    title: "Site header",
    states: [{ label: "Sticky and translucent", node: <SiteHeaderSample /> }],
  },
  {
    source: "src/components/ThemeToggle.tsx",
    title: "Theme toggle",
    states: [{ label: "Cycles light / dark / system", node: <ThemeToggleSample /> }],
  },
  {
    source: "src/components/CardDetailsForm.tsx",
    title: "Card details",
    states: [{ label: "Default", node: <CardDetailsFormSample /> }],
  },
  {
    source: "src/components/ColorSchemeForm.tsx",
    title: "Colour scheme",
    states: [
      { label: "Defaults", node: <ColorSchemeFormSample initial={DEFAULT_COLOR_SCHEME} /> },
      { label: "Customised", node: <ColorSchemeFormSample initial={SUNSET_COLORS} /> },
    ],
  },
  {
    source: "src/components/FontSchemeForm.tsx",
    title: "Font scheme",
    states: [{ label: "Default", node: <FontSchemeFormSample /> }],
  },
  {
    source: "src/components/EmojiSchemeForm.tsx",
    title: "Emoji scheme",
    states: [
      { label: "Empty", node: <EmojiSchemeFormSample initial={DEFAULT_EMOJI_SCHEME} /> },
      {
        label: "At the maximum (5)",
        node: <EmojiSchemeFormSample initial={{ emojis: ["🚗", "🌵", "⛽", "🗺️", "🏜️"] }} />,
      },
    ],
  },
  {
    source: "src/components/EntryInput.tsx",
    title: "Entry input",
    states: [
      { label: "Empty", node: <EntryInputSample initial={[]} /> },
      {
        label: "A few entries — one disabled, one mandatory",
        node: <EntryInputSample initial={FEW_ENTRIES} />,
      },
      {
        label: "Over capacity (26 entries, 24 slots)",
        node: <EntryInputSample initial={OVER_CAPACITY_ENTRIES} />,
      },
      {
        label: "More mandatory entries than slots",
        node: <EntryInputSample initial={MANDATORY_OVERFLOW_ENTRIES} />,
      },
    ],
  },
  {
    source: "src/components/CardGrid.tsx",
    title: "Card grid — FROZEN, do not restyle",
    states: [
      {
        label: "With title and emoji ring",
        node: (
          <CardGridSample
            title="Road Trip Bingo"
            colorScheme={DEFAULT_COLOR_SCHEME}
            emojiScheme={{ emojis: ["🚗", "🌵", "⛽"] }}
          />
        ),
      },
      {
        label: "No title, no emojis",
        node: (
          <CardGridSample
            title=""
            colorScheme={DEFAULT_COLOR_SCHEME}
            emojiScheme={DEFAULT_EMOJI_SCHEME}
          />
        ),
      },
      {
        label: "Custom colours",
        node: (
          <CardGridSample
            title="Sunset Drive"
            colorScheme={SUNSET_COLORS}
            emojiScheme={{ emojis: ["🌅"] }}
          />
        ),
      },
      {
        // The state a member sees on a trip-mate's card: marks, no affordance.
        label: "Partly marked, read-only",
        node: (
          <CardGridSample
            title="Road Trip Bingo"
            colorScheme={DEFAULT_COLOR_SCHEME}
            emojiScheme={{ emojis: ["🚗", "🌵", "⛽"] }}
            markedSlots={SAMPLE_MARKED_SLOTS}
          />
        ),
      },
      {
        // The mark's colour is fixed and cannot adapt to the card, so it has to
        // be reviewed against a second scheme, not just the default one.
        label: "Partly marked, custom colours",
        node: (
          <CardGridSample
            title="Sunset Drive"
            colorScheme={SUNSET_COLORS}
            emojiScheme={{ emojis: ["🌅"] }}
            markedSlots={SAMPLE_MARKED_SLOTS}
          />
        ),
      },
      {
        // The densest the layer gets: every entry has to survive being under one.
        label: "Fully marked",
        node: (
          <CardGridSample
            title="Road Trip Bingo"
            colorScheme={DEFAULT_COLOR_SCHEME}
            emojiScheme={{ emojis: ["🚗", "🌵", "⛽"] }}
            markedSlots={SAMPLE_FULL_MARKS}
          />
        ),
      },
      {
        // The hard case for a fixed translucent mark: a dark cell it has to stay
        // visible on, carrying light text it must not swallow.
        label: "Partly marked, dark card",
        node: (
          <CardGridSample
            title="Night Drive"
            colorScheme={MIDNIGHT_COLORS}
            emojiScheme={{ emojis: ["🌙", "⭐"] }}
            markedSlots={SAMPLE_MARKED_SLOTS}
          />
        ),
      },
      {
        label: "Playable — click or tab and press Enter",
        node: (
          <PlayableCardGridSample
            colorScheme={DEFAULT_COLOR_SCHEME}
            emojiScheme={{ emojis: ["🚗", "🌵", "⛽"] }}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/CardView.tsx",
    title: "Card view",
    states: [{ label: "Default", node: <CardViewSample colorScheme={DEFAULT_COLOR_SCHEME} /> }],
  },
  {
    source: "src/components/WinConditionSelect.tsx",
    title: "Win condition select",
    states: [
      { label: "One line", node: <WinConditionSelectSample initial="line" /> },
      { label: "Two lines", node: <WinConditionSelectSample initial="two-lines" /> },
      { label: "Full card", node: <WinConditionSelectSample initial="full-card" /> },
    ],
  },
  {
    source: "src/components/CardWinStatus.tsx",
    title: "Card win status",
    states: [
      {
        label: "One square from winning",
        node: <CardWinStatus distance={1} formatTimestamp={sampleWinDate} />,
      },
      {
        label: "Won — the badge names the member and the date",
        node: (
          <CardWinStatus
            distance={0}
            wonAt="2026-08-04T12:00:00.000Z"
            winnerLabel="Sam"
            formatTimestamp={sampleWinDate}
          />
        ),
      },
      {
        label: "Target unreachable — blank squares in every route",
        node: <CardWinStatus distance={Infinity} formatTimestamp={sampleWinDate} />,
      },
      {
        label: "Won, then unmarked below the target — two truths at once",
        node: (
          <CardWinStatus
            distance={3}
            wonAt="2026-08-04T12:00:00.000Z"
            winnerLabel="Sam"
            formatTimestamp={sampleWinDate}
          />
        ),
      },
      {
        label: "Celebrating the viewer's own completing mark",
        node: (
          <CardWinStatus
            distance={0}
            celebration="Bingo! You completed one line."
            formatTimestamp={sampleWinDate}
            onDismissCelebration={() => {}}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/NotificationBell.tsx",
    title: "Notification bell",
    states: [
      // The button is covered here in its three badge states; the dropdown's
      // contents are the NotificationList entry below, rendered inline because
      // a popover portals off-canvas.
      { label: "No unread", node: <NotificationBellButtonSample unread={0} /> },
      { label: "Some unread", node: <NotificationBellButtonSample unread={3} /> },
      { label: "Many unread (saturates)", node: <NotificationBellButtonSample unread={99} /> },
    ],
  },
  {
    source: "src/components/NotificationList.tsx",
    title: "Notification list",
    states: [
      { label: "Empty", node: <NotificationListSample items={[]} /> },
      {
        label: "Populated — a mix of read and unread",
        node: (
          <NotificationListSample
            items={[
              sampleNotification({ type: "victory", actorName: "Sam", read: true }),
              sampleNotification({ type: "one_away", actorName: "Priya" }),
              sampleNotification({ type: "progress_marked", actorName: null, tripTitle: "Weekend at the Lake" }),
            ]}
          />
        ),
      },
      {
        label: "Pointing at a trip no longer openable — followed, it reads as no longer available",
        node: (
          <NotificationListSample
            items={[sampleNotification({ type: "victory", actorName: "Sam", tripTitle: "Deleted Trip" })]}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/NotificationPreferencesForm.tsx",
    title: "Notification preferences",
    states: [
      {
        label: "Never saved — the defaults in effect",
        node: <NotificationPreferencesFormSample savedBefore={false} />,
      },
      {
        label: "Previously saved, one trip muted",
        node: <NotificationPreferencesFormSample savedBefore />,
      },
    ],
  },
  {
    source: "src/components/ActivityFeed.tsx",
    title: "Activity feed",
    states: [
      { label: "Empty", node: <ActivityFeedSample events={[]} /> },
      {
        label: "Populated — the newest thing a trip did",
        node: (
          <ActivityFeedSample
            events={[
              { type: "victory", actorId: "u1", actorName: "Priya", tripCardId: "tc", createdAt: "2026-08-02T12:00:00.000Z" },
              { type: "one_away", actorId: "u2", actorName: "Sam", tripCardId: "tc", createdAt: "2026-08-02T11:00:00.000Z" },
              { type: "progress_marked", actorId: "u1", actorName: null, tripCardId: "tc", createdAt: "2026-08-02T10:00:00.000Z" },
            ]}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/AuthMenu.tsx",
    title: "Auth menu",
    states: [{ label: "Current auth state", node: <AuthMenuSample /> }],
  },
  {
    source: "src/pages/SettingsPage.tsx",
    title: "Settings page",
    states: [{ label: "Display name section", node: <SettingsPageSample /> }],
  },
  {
    source: "src/components/SuggestionsDialog.tsx",
    title: "Suggestions dialog",
    states: [
      {
        label: "Opens over the page",
        node: (
          <DialogSample
            label="Open suggestions"
            render={(close) => (
              <SuggestionsDialog
                open
                onClose={close}
                entries={FEW_ENTRIES}
                onAddEntries={() => {}}
                onApplyTheme={() => {}}
              />
            )}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/ShareLinkDialog.tsx",
    title: "Share link dialog",
    states: [
      {
        label: "Opens over the page — signed out, so it makes no request",
        node: (
          <DialogSample
            label="Open share links"
            render={(close) => (
              <ShareLinkDialog open onClose={close} cardId={null} onSaveFirst={async () => null} />
            )}
          />
        ),
      },
    ],
  },
  {
    source: "src/components/UnsavedChangesDialog.tsx",
    title: "Unsaved changes dialog",
    states: [
      {
        label: "Signed in — three choices, with saving as the recommended one",
        node: (
          <DialogSample
            label="Open unsaved changes (signed in)"
            render={(close) => (
              <UnsavedChangesDialog
                open
                canSave
                saving={false}
                error={null}
                onSaveAndLeave={close}
                onLeaveWithoutSaving={close}
                onStay={close}
              />
            )}
          />
        ),
      },
      {
        label: "Signed out — no save action, so staying is the primary choice",
        node: (
          <DialogSample
            label="Open unsaved changes (signed out)"
            render={(close) => (
              <UnsavedChangesDialog
                open
                canSave={false}
                saving={false}
                error={null}
                onSaveAndLeave={close}
                onLeaveWithoutSaving={close}
                onStay={close}
              />
            )}
          />
        ),
      },
      {
        label: "Saving — every action disabled until the save settles",
        node: (
          <DialogSample
            label="Open unsaved changes (saving)"
            render={(close) => (
              <UnsavedChangesDialog
                open
                canSave
                saving
                error={null}
                onSaveAndLeave={close}
                onLeaveWithoutSaving={close}
                onStay={close}
              />
            )}
          />
        ),
      },
      {
        label: "The save failed — still here, with the changes intact",
        node: (
          <DialogSample
            label="Open unsaved changes (save failed)"
            render={(close) => (
              <UnsavedChangesDialog
                open
                canSave
                saving={false}
                error="Could not save this card, so you are still here. Try again?"
                onSaveAndLeave={close}
                onLeaveWithoutSaving={close}
                onStay={close}
              />
            )}
          />
        ),
      },
    ],
  },
];
