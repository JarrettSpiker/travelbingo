import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { CardGrid } from "../components/CardGrid";
import { useAuth } from "../auth/authContext";
import { cardStateFrom } from "../lib/cardState";
import { createCard, resolveShare } from "../lib/cardsApi";
import type { CardUrlData } from "../lib/cardData";

export function SharedCardPage() {
  const { token } = useParams<{ token: string }>();
  const { api, status, signIn } = useAuth();
  const navigate = useNavigate();

  const [card, setCard] = useState<CardUrlData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    if (!token || loaded.current) return;
    loaded.current = true;

    void (async () => {
      try {
        const resolved = await resolveShare(api, token);
        if (!resolved) {
          setError("This share link is no longer available.");
          return;
        }
        setCard(resolved);

        // The token is a capability: anyone holding it can open the card. Once
        // the snapshot is in memory the URL no longer needs it, so it is
        // scrubbed from the address bar and from the session's history entry,
        // which is where a link most often leaks from.
        window.history.replaceState(null, "", "/s");
      } catch {
        // A revoked link and one that never existed are indistinguishable here,
        // which is deliberate — the server returns the same 404 for both.
        setError("This share link is no longer available.");
      }
    })();
  }, [token, api]);

  async function handleSaveCopy() {
    if (!card) return;
    setBusy(true);
    setSaveMessage(null);
    try {
      await createCard(api, card);
      setSaveMessage("Saved to your cards.");
    } catch {
      setSaveMessage("Could not save this card.");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenInEditor() {
    if (!card) return;
    void navigate("/", { state: { card } });
  }

  if (error) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={2}>
          <Alert severity="warning">{error}</Alert>
          <Button variant="contained" onClick={() => void navigate("/")}>
            Make your own card
          </Button>
        </Stack>
      </Container>
    );
  }

  if (!card) {
    return (
      <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress />
          <Typography>Opening the shared card…</Typography>
        </Stack>
      </Container>
    );
  }

  const state = cardStateFrom(card);

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h5" component="h1">
          {card.title || "A shared bingo card"}
        </Typography>
        <Typography color="text.secondary">
          Someone shared a copy of this card with you. It is yours — changes you make will not affect
          theirs.
        </Typography>

        {saveMessage && <Alert severity="info">{saveMessage}</Alert>}

        <Stack direction="row" spacing={1} className="no-print">
          <Button variant="contained" onClick={handleOpenInEditor}>
            Open in the editor
          </Button>
          {status === "authenticated" ? (
            <Button variant="outlined" onClick={() => void handleSaveCopy()} disabled={busy}>
              {busy ? "Saving…" : "Save a copy"}
            </Button>
          ) : (
            <Button variant="outlined" onClick={() => signIn(window.location.pathname)}>
              Sign in to save a copy
            </Button>
          )}
        </Stack>

        <CardGrid
          card={state.card}
          title={card.title}
          colorScheme={card.colorScheme}
          fontScheme={card.fontScheme}
          emojiScheme={card.emojiScheme}
        />
      </Stack>
    </Container>
  );
}
