import { useState } from "react";
import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import "./App.css";
import { EntryInput } from "./components/EntryInput";
import { CardDetailsForm } from "./components/CardDetailsForm";
import { ColorSchemeForm } from "./components/ColorSchemeForm";
import { FontSchemeForm } from "./components/FontSchemeForm";
import { CardView } from "./components/CardView";
import { buildCard, cardFromSlots, cardToSlots, randomizeCard, type BingoCard, type BingoEntry } from "./lib/bingo";
import { DEFAULT_COLOR_SCHEME, type ColorScheme } from "./lib/colorScheme";
import { DEFAULT_FONT_SCHEME, type FontScheme } from "./lib/fontScheme";
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
  const [freeSpaceText, setFreeSpaceText] = useState(() => initialImport?.freeSpaceText ?? "");
  const [colorScheme, setColorScheme] = useState<ColorScheme>(() => initialImport?.colorScheme ?? DEFAULT_COLOR_SCHEME);
  const [fontScheme, setFontScheme] = useState<FontScheme>(() => initialImport?.fontScheme ?? DEFAULT_FONT_SCHEME);
  const [card, setCard] = useState<BingoCard>(() =>
    initialImport ? cardFromSlots(initialImport.slots, initialImport.freeSpaceText) : buildCard([]),
  );

  function handleAddEntry(text: string) {
    const next = [...entries, { text, mandatory: false }];
    setEntries(next);
    setCard(buildCard(next, freeSpaceText));
  }

  function handleEditEntry(index: number, text: string) {
    const next = entries.map((existing, i) => (i === index ? { ...existing, text } : existing));
    setEntries(next);
    setCard(buildCard(next, freeSpaceText));
  }

  function handleToggleMandatory(index: number) {
    const next = entries.map((existing, i) =>
      i === index ? { ...existing, mandatory: !existing.mandatory } : existing,
    );
    setEntries(next);
    setCard(buildCard(next, freeSpaceText));
  }

  function handleRemoveEntry(index: number) {
    const next = entries.filter((_, i) => i !== index);
    setEntries(next);
    setCard(buildCard(next, freeSpaceText));
  }

  function handleFreeSpaceChange(value: string) {
    setFreeSpaceText(value);
    setCard(buildCard(entries, value));
  }

  function handleRandomize() {
    setCard(randomizeCard(entries, freeSpaceText));
  }

  function handleExportUrl(): string {
    return encodeCardToUrl({ slots: cardToSlots(card), title, freeSpaceText, colorScheme, fontScheme });
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
            freeSpaceText={freeSpaceText}
            onFreeSpaceChange={handleFreeSpaceChange}
          />
          <Stack spacing={3}>
            <ColorSchemeForm colorScheme={colorScheme} onChange={setColorScheme} />
            <FontSchemeForm fontScheme={fontScheme} onChange={setFontScheme} />
          </Stack>
        </Box>

        <EntryInput
          entries={entries}
          onAdd={handleAddEntry}
          onEdit={handleEditEntry}
          onToggleMandatory={handleToggleMandatory}
          onRemove={handleRemoveEntry}
        />
      </Stack>

      <CardView
        card={card}
        title={title}
        colorScheme={colorScheme}
        fontScheme={fontScheme}
        onRandomize={handleRandomize}
        onExportUrl={handleExportUrl}
      />
    </Container>
  );
}

export default App;
