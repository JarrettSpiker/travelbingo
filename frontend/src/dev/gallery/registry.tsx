import { type ReactNode } from "react";
import { ShareLinkDialog } from "../../components/ShareLinkDialog";
import { SuggestionsDialog } from "../../components/SuggestionsDialog";
import { DEFAULT_COLOR_SCHEME } from "../../lib/colorScheme";
import { DEFAULT_EMOJI_SCHEME } from "../../lib/emojiScheme";
import {
  FEW_ENTRIES,
  MANDATORY_OVERFLOW_ENTRIES,
  OVER_CAPACITY_ENTRIES,
  SUNSET_COLORS,
} from "./sampleData";
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
  /** File in `src/components/` this entry covers, e.g. "EntryInput.tsx". */
  source: string;
  title: string;
  states: GalleryState[];
}

export const GALLERY_ENTRIES: GalleryEntry[] = [
  {
    source: "CardDetailsForm.tsx",
    title: "Card details",
    states: [{ label: "Default", node: <CardDetailsFormSample /> }],
  },
  {
    source: "ColorSchemeForm.tsx",
    title: "Colour scheme",
    states: [
      { label: "Defaults", node: <ColorSchemeFormSample initial={DEFAULT_COLOR_SCHEME} /> },
      { label: "Customised", node: <ColorSchemeFormSample initial={SUNSET_COLORS} /> },
    ],
  },
  {
    source: "FontSchemeForm.tsx",
    title: "Font scheme",
    states: [{ label: "Default", node: <FontSchemeFormSample /> }],
  },
  {
    source: "EmojiSchemeForm.tsx",
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
    source: "EntryInput.tsx",
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
    source: "CardGrid.tsx",
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
    ],
  },
  {
    source: "CardView.tsx",
    title: "Card view",
    states: [{ label: "Default", node: <CardViewSample colorScheme={DEFAULT_COLOR_SCHEME} /> }],
  },
  {
    source: "AuthMenu.tsx",
    title: "Auth menu",
    states: [{ label: "Current auth state", node: <AuthMenuSample /> }],
  },
  {
    source: "SuggestionsDialog.tsx",
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
    source: "ShareLinkDialog.tsx",
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
];
