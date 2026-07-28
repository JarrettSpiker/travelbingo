import { useEffect, useRef, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { BingoCard } from "../lib/bingo";
import type { ColorScheme } from "../lib/colorScheme";
import type { FontScheme } from "../lib/fontScheme";
import { CardGrid } from "./CardGrid";

interface CardViewProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  onRandomize: () => void;
  onExportUrl: () => string;
}

export function CardView({ card, title, colorScheme, fontScheme, onRandomize, onExportUrl }: CardViewProps) {
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (exportedUrl) {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    }
  }, [exportedUrl]);

  async function handleExportClick() {
    const url = onExportUrl();
    setExportedUrl(url);
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // Clipboard access can fail/be unavailable; the visible, selected
      // URL field below is the fallback way to copy it.
    }
  }

  return (
    <Box component="section" className="card-view">
      <Stack
        className="no-print"
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: 2, alignItems: { sm: "center" }, justifyContent: "space-between" }}
      >
        <Typography variant="h6" component="h2">
          Your card
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button type="button" variant="outlined" size="small" onClick={onRandomize}>
            Randomize card
          </Button>
          <Button type="button" variant="outlined" size="small" onClick={handleExportClick}>
            Export URL
          </Button>
          <Button type="button" variant="outlined" size="small" onClick={() => window.print()}>
            Print / Save as PDF
          </Button>
        </Stack>
      </Stack>

      {exportedUrl && (
        <Box className="no-print" sx={{ mb: 2, maxWidth: 420 }}>
          <TextField
            id="export-url"
            label="Card URL (copied to clipboard if supported — select and copy otherwise)"
            inputRef={urlInputRef}
            value={exportedUrl}
            slotProps={{ htmlInput: { readOnly: true } }}
            size="small"
            fullWidth
          />
        </Box>
      )}

      <CardGrid card={card} title={title} colorScheme={colorScheme} fontScheme={fontScheme} />
    </Box>
  );
}
