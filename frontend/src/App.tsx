import { useRef, useState } from "react";
import { ListChecks, Palette, SlidersHorizontal } from "lucide-react";
import "./App.css";
import { AppShell } from "./components/AppShell";
import { Panel } from "./components/Panel";
import { Button } from "./components/ui/button";
import { EntryInput } from "./components/EntryInput";
import { CardDetailsForm } from "./components/CardDetailsForm";
import { ColorSchemeForm } from "./components/ColorSchemeForm";
import { EmojiSchemeForm } from "./components/EmojiSchemeForm";
import { FontSchemeForm } from "./components/FontSchemeForm";
import { CardView } from "./components/CardView";
import { SuggestionsDialog } from "./components/SuggestionsDialog";
import { AuthMenu } from "./components/AuthMenu";
import { ShareLinkDialog } from "./components/ShareLinkDialog";
import { UnsavedChangesDialog } from "./components/UnsavedChangesDialog";
import { useAuth } from "./auth/authContext";
import { useUnsavedChangesGuard } from "./hooks/useUnsavedChangesGuard";
import { buildCard, cardToSlots, randomizeCard, type BingoCard, type BingoEntry } from "./lib/bingo";
import { type ColorScheme } from "./lib/colorScheme";
import { type EmojiScheme } from "./lib/emojiScheme";
import { type FontScheme } from "./lib/fontScheme";
import { type SuggestedTheme } from "./lib/suggestions";
import { cardDataEquals, type CardUrlData } from "./lib/cardData";
import { cardStateFrom } from "./lib/cardState";
import { createCard, replaceCard } from "./lib/cardsApi";
import { generateCardThumbnail } from "./lib/cardThumbnail";

interface AppProps {
  /**
   * A card handed over from another route — a saved card being opened, or a
   * share snapshot. Null means the editor starts empty.
   */
  initialCard?: CardUrlData | null;
  /** Set when initialCard came from a saved card, so saving updates it in place. */
  initialCardId?: string | null;
}

function App({ initialCard = null, initialCardId = null }: AppProps = {}) {
  // One source for initial editor state, shared by opening a saved card and
  // importing a share snapshot. See lib/cardState.ts.
  const initialState = cardStateFrom(initialCard);

  const { api, status, accountsEnabled } = useAuth();

  const [entries, setEntries] = useState<BingoEntry[]>(() => initialState.entries);
  const [title, setTitle] = useState(() => initialState.title);
  const [hasFreeSpace, setHasFreeSpace] = useState(() => initialState.hasFreeSpace);
  const [freeSpaceText, setFreeSpaceText] = useState(() => initialState.freeSpaceText);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => initialState.colorScheme);
  const [fontScheme, setFontScheme] = useState<FontScheme>(() => initialState.fontScheme);
  const [emojiScheme, setEmojiScheme] = useState<EmojiScheme>(() => initialState.emojiScheme);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [card, setCard] = useState<BingoCard>(() => initialState.card);
  const [savedCardId, setSavedCardId] = useState<string | null>(initialCardId);
  const [shareOpen, setShareOpen] = useState(false);
  // Save state for the unsaved-changes dialog only. The header's Save button
  // reports its own result through AuthMenu, and the two must not share a
  // spinner: they are different actions with different consequences.
  const [savingBeforeLeave, setSavingBeforeLeave] = useState(false);
  const [saveAndLeaveError, setSaveAndLeaveError] = useState<string | null>(null);
  // Owned here so the save flow can render a thumbnail from the same node the
  // PNG export uses. Passed down to CardView.
  const cardRef = useRef<HTMLDivElement>(null);
  /**
   * The card as it was last saved — or, before any save, as the editor opened.
   * Unsaved changes are derived by comparing the current snapshot against this,
   * rather than by a flag every mutating handler must remember to set. Seeded
   * lazily below, once the first render has state to snapshot.
   */
  const baselineRef = useRef<CardUrlData | null>(null);

  function handleAddEntry(text: string) {
    const next = [...entries, { text, mandatory: false }];
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleEditEntry(index: number, text: string) {
    const next = entries.map((existing, i) => (i === index ? { ...existing, text } : existing));
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleToggleMandatory(index: number) {
    const next = entries.map((existing, i) =>
      i === index ? { ...existing, mandatory: !existing.mandatory } : existing,
    );
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleToggleEnabled(index: number) {
    const next = entries.map((existing, i) =>
      i === index ? { ...existing, enabled: !(existing.enabled ?? true) } : existing,
    );
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleRemoveEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleHasFreeSpaceChange(value: boolean) {
    setHasFreeSpace(value);
    setCard(buildCard(entries, { hasFreeSpace: value, freeSpaceText }));
  }

  function handleFreeSpaceChange(value: string) {
    setFreeSpaceText(value);
    setCard(buildCard(entries, { hasFreeSpace, freeSpaceText: value }));
  }

  function handleRandomize() {
    setCard(randomizeCard(entries, { hasFreeSpace, freeSpaceText }));
  }

  function handleAddEntries(next: BingoEntry[]) {
    setEntries(next);
    setCard(buildCard(next, { hasFreeSpace, freeSpaceText }));
  }

  function handleApplyTheme(theme: SuggestedTheme) {
    setColorScheme(theme.colorScheme);
    setFontScheme(theme.fontScheme);
    setEmojiScheme(theme.emojiScheme);
  }

  function currentCardData(): CardUrlData {
    return {
      slots: cardToSlots(card, hasFreeSpace),
      // The full pool (with flags) is what makes a saved card non-lossy: it
      // carries entries beyond the grid's capacity and disabled entries, which
      // the grid slots alone cannot represent.
      entries,
      title,
      hasFreeSpace,
      freeSpaceText,
      colorScheme,
      fontScheme,
      emojiScheme,
    };
  }

  /** Saves the editor's card, updating it in place once it has an id. */
  async function saveCurrentCard(): Promise<string | null> {
    const data = currentCardData();
    // Render a downscaled thumbnail from the already-styled card DOM. Best
    // effort: a null result (generation failure, or a thumbnail that could not
    // be kept under the cap) saves the card without one — the library shows a
    // placeholder until the next save.
    const thumbnail = cardRef.current ? await generateCardThumbnail(cardRef.current) : null;
    try {
      if (savedCardId) {
        await replaceCard(api, savedCardId, data, thumbnail);
        baselineRef.current = data;
        return savedCardId;
      }
      const created = await createCard(api, data, thumbnail);
      setSavedCardId(created.cardId);
      // Only on success, and only the snapshot that was actually persisted: a
      // failed save leaves the card dirty, and an edit made while the save was
      // in flight is still an unsaved change.
      baselineRef.current = data;
      return created.cardId;
    } catch {
      return null;
    }
  }

  async function handleSaveCard(): Promise<string> {
    return (await saveCurrentCard()) ? "Saved" : "Could not save";
  }

  // Derived during render, not inside a callback, so anything reading it (the
  // navigation guard included) always sees the value for the current state.
  const current = currentCardData();
  baselineRef.current ??= current;
  const isDirty = !cardDataEquals(current, baselineRef.current);
  const blocker = useUnsavedChangesGuard(isDirty);

  async function handleSaveAndLeave() {
    setSaveAndLeaveError(null);
    setSavingBeforeLeave(true);
    // saveCurrentCard refreshes the baseline itself on success, so by the time
    // the navigation proceeds the editor is already clean.
    const saved = await saveCurrentCard();
    setSavingBeforeLeave(false);
    if (!saved) {
      setSaveAndLeaveError("Could not save this card, so you are still here. Try again?");
      return;
    }
    blocker.proceed?.();
  }

  function handleStay() {
    setSaveAndLeaveError(null);
    blocker.reset?.();
  }

  function handleLeaveWithoutSaving() {
    setSaveAndLeaveError(null);
    blocker.proceed?.();
  }

  return (
    // The auth affordance moves into the shell's header, where it is the same
    // control on every page. Only the editor has a card to save, which is why
    // the save action is passed in from here rather than owned by the header.
    <AppShell size="wide" headerActions={<AuthMenu onSaveCard={handleSaveCard} />}>
      {/*
        A two-column workspace at lg+: controls scroll on the left, the card
        stays put on the right. The card is the thing being edited, and it used
        to sit below the fold under every control — you could not see what a
        colour change did without scrolling.

        Below lg it collapses to one column with the preview first, so the same
        "see what you are changing" property holds on a phone.

        The preview column is `auto`, not a fixed fraction: the card panel has a
        fixed width of its own, and pinning the column to a different number
        meant one of the two was always wrong.
      */}
      {/*
        The visual hierarchy does not want a page title — the header already
        names the app, and "Bingo Card Generator" underneath it was saying the
        same thing twice. The document outline still needs one, so it is here
        and only announced.
      */}
      <h1 className="sr-only">Bingo card editor</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="order-2 grid gap-4 lg:order-1">
          {/*
            Ordered to the actual journey: entries first, because a card with no
            entries is not a card; then how it looks; then the details you name
            it with. It used to open on "Card details", which is the last thing
            anyone fills in.
          */}
          <Panel
            title="Entries"
            icon={ListChecks}
            actions={
              <Button variant="outline" size="sm" onClick={() => setSuggestionsOpen(true)}>
                See suggestions
              </Button>
            }
          >
            <EntryInput
              entries={entries}
              hasFreeSpace={hasFreeSpace}
              onAdd={handleAddEntry}
              onEdit={handleEditEntry}
              onToggleMandatory={handleToggleMandatory}
              onToggleEnabled={handleToggleEnabled}
              onRemove={handleRemoveEntry}
            />
          </Panel>

          {/*
            Colour, fonts, and emojis were three bare stacks reading as three
            unrelated features. They are one decision — how the card looks — so
            they are one panel with three sub-sections.
          */}
          <Panel title="Look &amp; feel" icon={Palette}>
            <div className="grid gap-6">
              <div className="grid gap-3">
                <h3 className="text-sm font-medium text-muted-foreground">Colours</h3>
                <ColorSchemeForm
                  colorScheme={colorScheme}
                  onChange={setColorScheme}
                  onApplyTheme={handleApplyTheme}
                  onSeeMoreThemes={() => setSuggestionsOpen(true)}
                />
              </div>
              <div className="grid gap-3 border-t border-border pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Fonts</h3>
                <FontSchemeForm fontScheme={fontScheme} onChange={setFontScheme} />
              </div>
              <div className="grid gap-3 border-t border-border pt-6">
                <h3 className="text-sm font-medium text-muted-foreground">Emojis</h3>
                <EmojiSchemeForm emojiScheme={emojiScheme} onChange={setEmojiScheme} />
              </div>
            </div>
          </Panel>

          <Panel title="Card details" icon={SlidersHorizontal}>
            <CardDetailsForm
              title={title}
              onTitleChange={setTitle}
              hasFreeSpace={hasFreeSpace}
              onHasFreeSpaceChange={handleHasFreeSpaceChange}
              freeSpaceText={freeSpaceText}
              onFreeSpaceChange={handleFreeSpaceChange}
            />
          </Panel>
        </div>

        {/*
          `top-14` clears the sticky header. `print:static` because a sticky
          ancestor of the card would otherwise take its positioning into the
          printed page — this element survives the print isolation, being an
          ancestor of .bingo-card.
        */}
        <div className="order-1 lg:sticky lg:top-18 lg:order-2 print:static">
          <CardView
            card={card}
            title={title}
            colorScheme={colorScheme}
            fontScheme={fontScheme}
            emojiScheme={emojiScheme}
            onRandomize={handleRandomize}
            onCreateShareLink={accountsEnabled ? () => setShareOpen(true) : undefined}
            shareLinkDisabled={status !== "authenticated"}
            cardRef={cardRef}
          />
        </div>
      </div>

      {accountsEnabled && (
        <ShareLinkDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          cardId={status === "authenticated" ? savedCardId : null}
          onSaveFirst={saveCurrentCard}
        />
      )}

      <SuggestionsDialog
        open={suggestionsOpen}
        onClose={() => setSuggestionsOpen(false)}
        entries={entries}
        onAddEntries={handleAddEntries}
        onApplyTheme={handleApplyTheme}
      />

      {/*
        Rendered from the blocker's state, not from a flag set by whatever was
        clicked: every navigation away from a dirty editor — header links, the
        account menu, opening another card, back/forward — arrives here.
      */}
      <UnsavedChangesDialog
        open={blocker.state === "blocked"}
        canSave={accountsEnabled && status === "authenticated"}
        saving={savingBeforeLeave}
        error={saveAndLeaveError}
        onSaveAndLeave={() => void handleSaveAndLeave()}
        onLeaveWithoutSaving={handleLeaveWithoutSaving}
        onStay={handleStay}
      />
    </AppShell>
  );
}

export default App;
