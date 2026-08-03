import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useAuth } from "../auth/authContext";
import { deleteCard, getCard, listCards, renameCard } from "../lib/cardsApi";
import type { SavedCardSummary } from "../lib/savedCard";

export function SavedCardsPage() {
  const { api, status, signIn, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<SavedCardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ cardId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setCards(await listCards(api));
      setError(null);
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
      // Handed to the editor through navigation state; the editor route
      // remounts on a fresh location key so its initializers see it.
      void navigate("/", { state: { card, cardId } });
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

        <List>
          {cards?.map((card) => (
            <ListItem
              key={card.cardId}
              disableGutters
              secondaryAction={
                <Stack direction="row" spacing={0.5}>
                  <IconButton
                    aria-label="Rename this card"
                    onClick={() => setRenaming({ cardId: card.cardId, title: card.title })}
                    disabled={busy}
                  >
                    <EditIcon />
                  </IconButton>
                  <IconButton
                    aria-label="Delete this card"
                    onClick={() => void handleDelete(card.cardId)}
                    disabled={busy}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              }
            >
              {renaming?.cardId === card.cardId ? (
                <Stack direction="row" spacing={1} sx={{ flexGrow: 1, pr: 12 }}>
                  <TextField
                    size="small"
                    fullWidth
                    autoFocus
                    value={renaming.title}
                    onChange={(event) => setRenaming({ ...renaming, title: event.target.value })}
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
                <ListItemButton onClick={() => void handleOpen(card.cardId)} disabled={busy}>
                  <ListItemText
                    primary={card.title || "Untitled card"}
                    secondary={new Date(card.updatedAt).toLocaleString()}
                  />
                </ListItemButton>
              )}
            </ListItem>
          ))}
        </List>
      </Stack>
    </Container>
  );
}
