import { useRef, useState, type ReactNode } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthMenu } from "../../components/AuthMenu";
import { CardDetailsForm } from "../../components/CardDetailsForm";
import { CardGrid } from "../../components/CardGrid";
import { CardView } from "../../components/CardView";
import { ColorSchemeForm } from "../../components/ColorSchemeForm";
import { EmojiSchemeForm } from "../../components/EmojiSchemeForm";
import { EntryInput } from "../../components/EntryInput";
import { FontSchemeForm } from "../../components/FontSchemeForm";
import { Panel } from "../../components/Panel";
import { MAX_DISPLAY_NAME_LENGTH } from "../../lib/profileApi";
import { type BingoEntry } from "../../lib/bingo";
import { type ColorScheme } from "../../lib/colorScheme";
import { type EmojiScheme } from "../../lib/emojiScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "../../lib/fontScheme";
import { SAMPLE_CARD, sampleEntry } from "./sampleData";

/**
 * Interactive samples for the gallery. Each owns its own state, so the gallery
 * is usable rather than a static picture — typing into a form here exercises the
 * real component.
 */

export function CardDetailsFormSample() {
  const [title, setTitle] = useState("Road Trip Bingo");
  const [hasFreeSpace, setHasFreeSpace] = useState(true);
  const [freeSpaceText, setFreeSpaceText] = useState("FREE");
  return (
    <CardDetailsForm
      title={title}
      onTitleChange={setTitle}
      hasFreeSpace={hasFreeSpace}
      onHasFreeSpaceChange={setHasFreeSpace}
      freeSpaceText={freeSpaceText}
      onFreeSpaceChange={setFreeSpaceText}
    />
  );
}

export function ColorSchemeFormSample({ initial }: { initial: ColorScheme }) {
  const [colorScheme, setColorScheme] = useState(initial);
  return <ColorSchemeForm colorScheme={colorScheme} onChange={setColorScheme} onApplyTheme={(t) => setColorScheme(t.colorScheme)} onSeeMoreThemes={() => {}} />;
}

export function FontSchemeFormSample() {
  const [fontScheme, setFontScheme] = useState<FontScheme>(DEFAULT_FONT_SCHEME);
  return <FontSchemeForm fontScheme={fontScheme} onChange={setFontScheme} />;
}

export function EmojiSchemeFormSample({ initial }: { initial: EmojiScheme }) {
  const [emojiScheme, setEmojiScheme] = useState(initial);
  return <EmojiSchemeForm emojiScheme={emojiScheme} onChange={setEmojiScheme} />;
}

export function EntryInputSample({ initial }: { initial: BingoEntry[] }) {
  const [entries, setEntries] = useState(initial);
  return (
    <EntryInput
      entries={entries}
      hasFreeSpace
      onAdd={(text) => setEntries((prev) => [...prev, sampleEntry(text)])}
      onEdit={(index, text) =>
        setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, text } : e)))
      }
      onToggleMandatory={(index) =>
        setEntries((prev) =>
          prev.map((e, i) => (i === index ? { ...e, mandatory: !e.mandatory } : e)),
        )
      }
      onToggleEnabled={(index) =>
        setEntries((prev) =>
          prev.map((e, i) => (i === index ? { ...e, enabled: !(e.enabled ?? true) } : e)),
        )
      }
      onRemove={(index) => setEntries((prev) => prev.filter((_, i) => i !== index))}
    />
  );
}

export function CardViewSample({ colorScheme }: { colorScheme: ColorScheme }) {
  const cardRef = useRef<HTMLDivElement>(null);
  return (
    <CardView
      card={SAMPLE_CARD}
      title="Road Trip Bingo"
      colorScheme={colorScheme}
      fontScheme={DEFAULT_FONT_SCHEME}
      emojiScheme={{ emojis: ["🚗", "🌵", "⛽"] }}
      onRandomize={() => {}}
      cardRef={cardRef}
    />
  );
}

export function CardGridSample({
  colorScheme,
  emojiScheme,
  title,
}: {
  colorScheme: ColorScheme;
  emojiScheme: EmojiScheme;
  title: string;
}) {
  return (
    <CardGrid
      card={SAMPLE_CARD}
      title={title}
      colorScheme={colorScheme}
      fontScheme={DEFAULT_FONT_SCHEME}
      emojiScheme={emojiScheme}
    />
  );
}

export function AuthMenuSample() {
  return <AuthMenu onSaveCard={async () => "Saved"} />;
}

/**
 * The display-name section of the settings page. The full page redirects signed
 * out visitors, so the gallery renders the section in isolation — the same way
 * the other samples wrap a real component with their own state.
 */
export function SettingsPageSample() {
  const [value, setValue] = useState("Road Tripper");
  return (
    <Panel title="Display name" icon={User}>
      <div className="grid gap-3">
        <p className="text-sm text-muted-foreground">
          Shown in place of your email wherever your identity appears to you. Leave it blank to use your
          email instead.
        </p>
        <div className="grid gap-1.5">
          <label htmlFor="gallery-display-name" className="text-sm font-medium">
            Display name
          </label>
          <Input
            id="gallery-display-name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={MAX_DISPLAY_NAME_LENGTH}
          />
          <p className="text-xs text-muted-foreground">Up to {MAX_DISPLAY_NAME_LENGTH} characters.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button>Save</Button>
          <Button variant="ghost">Clear</Button>
        </div>
      </div>
    </Panel>
  );
}

/**
 * Dialogs portal to the body, so they cannot sit inline alongside everything
 * else. Each gets a trigger and is captured on its own pass — noted in
 * DESIGN.md so nobody assumes one screenshot covered them.
 */
export function DialogSample({
  label,
  render,
}: {
  label: string;
  render: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && render(() => setOpen(false))}
    </>
  );
}
