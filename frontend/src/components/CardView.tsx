import { useEffect, useRef, useState } from "react";
import { toPng } from "html-to-image";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import type { BingoCard } from "../lib/bingo";
import type { ColorScheme } from "../lib/colorScheme";
import { buildImageFilename } from "../lib/imageExport";
import type { EmojiScheme } from "../lib/emojiScheme";
import type { FontScheme } from "../lib/fontScheme";
import { CardGrid } from "./CardGrid";

interface CardViewProps {
  card: BingoCard;
  title: string;
  colorScheme: ColorScheme;
  fontScheme: FontScheme;
  emojiScheme: EmojiScheme;
  onRandomize: () => void;
  onExportUrl: () => string;
  /** Opens the revocable server-side share dialog. Omitted when accounts are off. */
  onCreateShareLink?: () => void;
}

export function CardView({
  card,
  title,
  colorScheme,
  fontScheme,
  emojiScheme,
  onRandomize,
  onExportUrl,
  onCreateShareLink,
}: CardViewProps) {
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);
  const [pngError, setPngError] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (exportedUrl) {
      urlInputRef.current?.focus();
      urlInputRef.current?.select();
    }
  }, [exportedUrl]);

  function closeMenu() {
    setMenuAnchorEl(null);
  }

  function handleExportUrl() {
    const url = onExportUrl();
    setExportedUrl(url);
    navigator.clipboard?.writeText(url).catch(() => {
      // Clipboard access can fail/be unavailable (non-secure context, lost
      // focus, permission denied); the visible, selected URL field below is
      // the fallback way to copy it.
    });
  }

  function handlePrint() {
    document.fonts.ready.then(() => window.print());
  }

  async function handlePng() {
    const node = cardRef.current;
    if (!node) {
      return;
    }
    setPngError(false);
    try {
      await document.fonts.ready;
      const dataUrl = await toPng(node, { pixelRatio: 2 });
      const link = document.createElement("a");
      link.download = buildImageFilename(title);
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setPngError(true);
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
          <Button
            type="button"
            variant="outlined"
            size="small"
            onClick={(event) => setMenuAnchorEl(event.currentTarget)}
          >
            Export
          </Button>
          <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={closeMenu}>
            {/*
              The two sharing mechanisms are deliberately worded so it is clear
              which one needs an account and which one can be revoked. They are
              not alternatives to each other: the URL export works with no
              account, forever, and is never going away.
            */}
            <MenuItem
              onClick={() => {
                closeMenu();
                handleExportUrl();
              }}
            >
              Copy card link (no account, permanent)
            </MenuItem>
            {onCreateShareLink && (
              <MenuItem
                onClick={() => {
                  closeMenu();
                  onCreateShareLink();
                }}
              >
                Create share link (short, revocable)
              </MenuItem>
            )}
            <MenuItem
              onClick={() => {
                closeMenu();
                handlePrint();
              }}
            >
              PDF
            </MenuItem>
            <MenuItem
              onClick={() => {
                closeMenu();
                void handlePng();
              }}
            >
              PNG
            </MenuItem>
          </Menu>
        </Stack>
      </Stack>

      {pngError && (
        <Typography className="no-print" color="error" variant="body2" sx={{ mb: 2, maxWidth: 420 }}>
          Sorry, the PNG could not be generated. Please try again.
        </Typography>
      )}

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

      <CardGrid
        ref={cardRef}
        card={card}
        title={title}
        colorScheme={colorScheme}
        fontScheme={fontScheme}
        emojiScheme={emojiScheme}
      />
    </Box>
  );
}
