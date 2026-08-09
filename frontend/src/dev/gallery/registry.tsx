import { type ReactNode } from "react";
import { ShareLinkDialog } from "../../components/ShareLinkDialog";
import { SuggestionsDialog } from "../../components/SuggestionsDialog";
import { UnsavedChangesDialog } from "../../components/UnsavedChangesDialog";
import { DEFAULT_COLOR_SCHEME } from "../../lib/colorScheme";
import { DEFAULT_EMOJI_SCHEME } from "../../lib/emojiScheme";
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
  PlayableCardGridSample,
  SettingsPageSample,
} from "./samples";

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
