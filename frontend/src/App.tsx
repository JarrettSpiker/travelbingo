import { useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import "./App.css";
import { EntryInput } from "./components/EntryInput";
import { CardDetailsForm } from "./components/CardDetailsForm";
import { ColorSchemeForm } from "./components/ColorSchemeForm";
import { EmojiSchemeForm } from "./components/EmojiSchemeForm";
import { FontSchemeForm } from "./components/FontSchemeForm";
import { CardView } from "./components/CardView";
import { SuggestionsDialog } from "./components/SuggestionsDialog";
import { AuthMenu } from "./components/AuthMenu";
import { ShareLinkDialog } from "./components/ShareLinkDialog";
import { useAuth } from "./auth/authContext";
import { buildCard, cardToSlots, randomizeCard, type BingoCard, type BingoEntry } from "./lib/bingo";
import { type ColorScheme } from "./lib/colorScheme";
import { type EmojiScheme } from "./lib/emojiScheme";
import { type FontScheme } from "./lib/fontScheme";
import { type SuggestedTheme } from "./lib/suggestions";
import { decodeCardFromUrl, encodeCardToUrl, type CardUrlData } from "./lib/cardUrl";
import { cardStateFrom } from "./lib/cardState";
import { createCard, replaceCard } from "./lib/cardsApi";

const initialImport = decodeCardFromUrl();

interface AppProps {
  /**
   * A card handed over from another route — a saved card being opened, or a
   * share snapshot. Null means the editor starts from the ?card= URL, exactly
   * as it did before accounts existed.
   */
  initialCard?: CardUrlData | null;
  /** Set when initialCard came from a saved card, so saving updates it in place. */
  initialCardId?: string | null;
}

function App({ initialCard = null, initialCardId = null }: AppProps = {}) {
  // One source for initial editor state, shared by the ?card= import, opening a
  // saved card, and importing a share snapshot. See lib/cardState.ts.
  const initialState = cardStateFrom(initialCard ?? initialImport);

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
      title,
      hasFreeSpace,
      freeSpaceText,
      colorScheme,
      fontScheme,
      emojiScheme,
    };
  }

  function handleExportUrl(): string {
    return encodeCardToUrl(currentCardData());
  }

  /** Saves the editor's card, updating it in place once it has an id. */
  async function saveCurrentCard(): Promise<string | null> {
    const data = currentCardData();
    try {
      if (savedCardId) {
        await replaceCard(api, savedCardId, data);
        return savedCardId;
      }
      const created = await createCard(api, data);
      setSavedCardId(created.cardId);
      return created.cardId;
    } catch {
      return null;
    }
  }

  async function handleSaveCard(): Promise<string> {
    return (await saveCurrentCard()) ? "Saved" : "Could not save";
  }

  return (
    <Container component="main" maxWidth="md" className="app" sx={{ py: 3 }}>
      <Box
        className="no-print"
        sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2 }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          Bingo Card Generator
        </Typography>
        <AuthMenu onSaveCard={handleSaveCard} />
      </Box>

      <Stack className="no-print" spacing={3} sx={{ mb: 4 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            gap: 3,
            alignItems: "start",
          }}
        >
          <CardDetailsForm
            title={title}
            onTitleChange={setTitle}
            hasFreeSpace={hasFreeSpace}
            onHasFreeSpaceChange={handleHasFreeSpaceChange}
            freeSpaceText={freeSpaceText}
            onFreeSpaceChange={handleFreeSpaceChange}
          />
          <Stack spacing={3}>
            <ColorSchemeForm colorScheme={colorScheme} onChange={setColorScheme} />
            <FontSchemeForm fontScheme={fontScheme} onChange={setFontScheme} />
            <EmojiSchemeForm emojiScheme={emojiScheme} onChange={setEmojiScheme} />
          </Stack>
        </Box>

        <EntryInput
          entries={entries}
          hasFreeSpace={hasFreeSpace}
          onAdd={handleAddEntry}
          onEdit={handleEditEntry}
          onToggleMandatory={handleToggleMandatory}
          onToggleEnabled={handleToggleEnabled}
          onRemove={handleRemoveEntry}
          onOpenSuggestions={() => setSuggestionsOpen(true)}
        />
      </Stack>

      <CardView
        card={card}
        title={title}
        colorScheme={colorScheme}
        fontScheme={fontScheme}
        emojiScheme={emojiScheme}
        onRandomize={handleRandomize}
        onExportUrl={handleExportUrl}
        // Undefined when accounts are off, so the menu shows only the
        // account-free "Copy card link".
        onCreateShareLink={accountsEnabled ? () => setShareOpen(true) : undefined}
      />

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
    </Container>
  );
}

export default App;
