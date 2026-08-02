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
import { buildCard, cardFromSlots, cardToSlots, randomizeCard, type BingoCard, type BingoEntry } from "./lib/bingo";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./lib/colorScheme";
import { DEFAULT_EMOJI_SCHEME, type EmojiScheme } from "./lib/emojiScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "./lib/fontScheme";
import { type SuggestedTheme } from "./lib/suggestions";
import { decodeCardFromUrl, encodeCardToUrl } from "./lib/cardUrl";

const initialImport = decodeCardFromUrl();

function App() {
  const [entries, setEntries] = useState<BingoEntry[]>(
    () =>
      initialImport?.slots
        .filter((slot): slot is string => slot !== null)
        .map((text) => ({ text, mandatory: false })) ?? [],
  );
  const [title, setTitle] = useState(() => initialImport?.title ?? "");
  const [hasFreeSpace, setHasFreeSpace] = useState(() => initialImport?.hasFreeSpace ?? true);
  const [freeSpaceText, setFreeSpaceText] = useState(() => initialImport?.freeSpaceText ?? "");
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => initialImport?.colorScheme ?? DEFAULT_COLOR_SCHEME);
  const [fontScheme, setFontScheme] = useState<FontScheme>(() => initialImport?.fontScheme ?? DEFAULT_FONT_SCHEME);
  const [emojiScheme, setEmojiScheme] = useState<EmojiScheme>(() => initialImport?.emojiScheme ?? DEFAULT_EMOJI_SCHEME);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [card, setCard] = useState<BingoCard>(() =>
    initialImport
      ? cardFromSlots(initialImport.slots, { hasFreeSpace: initialImport.hasFreeSpace, freeSpaceText: initialImport.freeSpaceText })
      : buildCard([]),
  );

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

  function handleExportUrl(): string {
    return encodeCardToUrl({
      slots: cardToSlots(card, hasFreeSpace),
      title,
      hasFreeSpace,
      freeSpaceText,
      colorScheme,
      fontScheme,
      emojiScheme,
    });
  }

  return (
    <Container component="main" maxWidth="md" className="app" sx={{ py: 3 }}>
      <Box className="no-print">
        <Typography variant="h4" component="h1" gutterBottom>
          Bingo Card Generator
        </Typography>
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
      />

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
