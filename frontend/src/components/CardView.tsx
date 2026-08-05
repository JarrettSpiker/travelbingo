import { useState, type RefObject } from "react";
import { toPng } from "html-to-image";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
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
  /** Opens the revocable server-side share dialog. Omitted when accounts are off. */
  onCreateShareLink?: () => void;
  /** True when the user is signed out; the share item is shown disabled with a hint. */
  shareLinkDisabled?: boolean;
  /**
   * The rendered card's DOM node, owned by the editor so the save flow can
   * generate a thumbnail from it. Also used here for PNG export.
   */
  cardRef: RefObject<HTMLDivElement | null>;
}

export function CardView({
  card,
  title,
  colorScheme,
  fontScheme,
  emojiScheme,
  onRandomize,
  onCreateShareLink,
  shareLinkDisabled,
  cardRef,
}: CardViewProps) {
  const [pngError, setPngError] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  function closeMenu() {
    setMenuAnchorEl(null);
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
            {onCreateShareLink && (
              shareLinkDisabled ? (
                // A disabled MenuItem doesn't receive pointer events, so the
                // Tooltip has to wrap a block-level element to show the hint.
                <Tooltip title="Sign in to share this card" placement="left">
                  <Box component="span" sx={{ display: "block" }}>
                    <MenuItem disabled>Create share link (short, revocable)</MenuItem>
                  </Box>
                </Tooltip>
              ) : (
                <MenuItem
                  onClick={() => {
                    closeMenu();
                    onCreateShareLink();
                  }}
                >
                  Create share link (short, revocable)
                </MenuItem>
              )
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
