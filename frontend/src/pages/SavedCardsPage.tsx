import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActionArea from "@mui/material/CardActionArea";
import CardContent from "@mui/material/CardContent";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import GridViewIcon from "@mui/icons-material/GridView";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ShareIcon from "@mui/icons-material/Share";
import { useAuth } from "../auth/authContext";
import { deleteCard, getCard, listCards, renameCard } from "../lib/cardsApi";
import { editorPathWithCard } from "../lib/cardParam";
import type { SavedCardSummary } from "../lib/savedCard";
import { ShareLinkDialog } from "../components/ShareLinkDialog";

export function SavedCardsPage() {
  const { api, status, signIn, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<SavedCardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ cardId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** Per-card menu anchor, plus the cardId it belongs to. */
  const [menu, setMenu] = useState<{ cardId: string; anchor: HTMLElement } | null>(null);
  /** The card whose share-link dialog is open. */
  const [shareCardId, setShareCardId] = useState<string | null>(null);
  /** CardIds whose thumbnail failed to load, so a placeholder is shown instead. */
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setCards(await listCards(api));
      setError(null);
      setFailedThumbs(new Set());
    } catch {
      setError("Could not load your saved cards.");
      setCards([]);
    }
  }, [api]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void load();
  }, [status, load]);

  async function handleOpen(cardId: string) {
    setBusy(true);
    try {
      const card = await getCard(api, cardId);
      if (!card) {
        setError("That card could not be opened.");
        return;
      }
      // Handed to the editor through navigation state for an instant first
      // paint; the id is also in the URL (?card=<id>) so a reload, back/forward,
      // or bookmark can restore the same card without the in-memory state.
      void navigate(editorPathWithCard(cardId), { state: { card, cardId } });
    } catch {
      setError("That card could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renaming) return;
    setBusy(true);
    try {
      await renameCard(api, renaming.cardId, renaming.title);
      setRenaming(null);
      await load();
    } catch {
      setError("Could not rename that card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cardId: string) {
    setBusy(true);
    try {
      await deleteCard(api, cardId);
      await load();
    } catch {
      setError("Could not delete that card.");
    } finally {
      setBusy(false);
    }
  }

  function markThumbFailed(cardId: string) {
    setFailedThumbs((prev) => {
      if (prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
  }

  if (!accountsEnabled) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={2}>
          <Alert severity="info">Accounts are not enabled in this build.</Alert>
          <Button variant="contained" onClick={() => void navigate("/")}>
            Back to the card editor
          </Button>
        </Stack>
      </Container>
    );
  }

  if (status === "loading") {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress />
        </Stack>
      </Container>
    );
  }

  if (status === "anonymous") {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            Saved cards
          </Typography>
          <Typography color="text.secondary">Sign in to see the cards you have saved.</Typography>
          <Button variant="contained" onClick={() => signIn("/cards")}>
            Sign in
          </Button>
          <Button onClick={() => void navigate("/")}>Back to the card editor</Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="h5" component="h1">
            Saved cards
          </Typography>
          <Button onClick={() => void navigate("/")}>Back to the editor</Button>
        </Stack>

        {error && <Alert severity="error">{error}</Alert>}

        {cards === null && <CircularProgress />}

        {cards?.length === 0 && (
          <Typography color="text.secondary">
            You have not saved any cards yet. Build one in the editor and choose “Save card”.
          </Typography>
        )}

        <Grid container spacing={2}>
          {cards?.map((card) => {
            const isRenaming = renaming?.cardId === card.cardId;
            const showThumb = Boolean(card.thumbnailUrl) && !failedThumbs.has(card.cardId);

            return (
              <Grid key={card.cardId} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card sx={{ height: "100%" }}>
                  <Box sx={{ position: "relative" }}>
                    <CardActionArea
                      onClick={() => void handleOpen(card.cardId)}
                      disabled={busy}
                      aria-label={`Open ${card.title || "Untitled card"}`}
                    >
                      {showThumb && card.thumbnailUrl ? (
                        <Box
                          component="img"
                          src={card.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          onError={() => markThumbFailed(card.cardId)}
                          sx={{
                            display: "block",
                            width: "100%",
                            height: 180,
                            objectFit: "contain",
                            bgcolor: "grey.100",
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 180,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: "grey.100",
                          }}
                          aria-hidden="true"
                        >
                          <GridViewIcon sx={{ fontSize: 48, color: "grey.400" }} />
                        </Box>
                      )}
                    </CardActionArea>
                    {/* Sibling of the action area, so opening the card never fires
                        when the menu button is clicked. */}
                    <IconButton
                      size="small"
                      aria-label="Card actions"
                      disabled={busy}
                      onClick={(event) =>
                        setMenu({ cardId: card.cardId, anchor: event.currentTarget })
                      }
                      sx={{ position: "absolute", top: 4, right: 4, bgcolor: "background.paper" }}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <CardContent>
                    {isRenaming ? (
                      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <TextField
                          size="small"
                          fullWidth
                          autoFocus
                          value={renaming.title}
                          onChange={(event) =>
                            setRenaming({ ...renaming, title: event.target.value })
                          }
                          onKeyDown={(event) => {
                            if (event.key === "Enter") void handleRename();
                            if (event.key === "Escape") setRenaming(null);
                          }}
                        />
                        <Button onClick={() => void handleRename()} disabled={busy}>
                          Save
                        </Button>
                        <Button onClick={() => setRenaming(null)}>Cancel</Button>
                      </Stack>
                    ) : (
                      <Box
                        role="button"
                        tabIndex={0}
                        onClick={() => void handleOpen(card.cardId)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            void handleOpen(card.cardId);
                          }
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        <Typography noWrap>{card.title || "Untitled card"}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(card.updatedAt).toLocaleString()}
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Stack>

      {/* One menu, repositioned to whichever card's button was clicked. The
          cardId travels on the menu state, so the items know which card to act
          on. */}
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={menu !== null}
        onClose={() => setMenu(null)}
        slotProps={{ paper: { sx: { minWidth: 220 } } }}
      >
        <MenuItem
          onClick={() => {
            const target = cards?.find((c) => c.cardId === menu?.cardId);
            if (target) setRenaming({ cardId: target.cardId, title: target.title });
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) setShareCardId(menu.cardId);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <ShareIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Manage share links</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menu) void handleDelete(menu.cardId);
            setMenu(null);
          }}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* The card is already saved here, so onSaveFirst is unreachable: the
          dialog's create path uses cardId directly. The prop is still required,
          so it returns the id it was given. */}
      {accountsEnabled && (
        <ShareLinkDialog
          open={shareCardId !== null}
          onClose={() => setShareCardId(null)}
          cardId={shareCardId}
          onSaveFirst={async () => shareCardId}
        />
      )}
    </Container>
  );
}
