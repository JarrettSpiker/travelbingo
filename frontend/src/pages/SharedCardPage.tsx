import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Info, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { CardGrid } from "@/components/CardGrid";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { cardStateFrom } from "@/lib/cardState";
import { createCard, resolveShare } from "@/lib/cardsApi";
import type { CardUrlData } from "@/lib/cardData";
import { ROUTES } from "@/lib/routes";
import { brand } from "@/brand";

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
    void navigate(ROUTES.editor, { state: { card } });
  }

  if (error) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="warning">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate(ROUTES.editor)}>Make your own card</Button>
        </div>
      </AppShell>
    );
  }

  if (!card) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-center gap-3 py-12">
          <Spinner label="Opening the shared card" />
          <p className="text-sm text-muted-foreground">Opening the shared card…</p>
        </div>
      </AppShell>
    );
  }

  const state = cardStateFrom(card);

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-4">
        <header className="grid gap-1">
          <h1 className="font-display text-2xl font-semibold">
            {card.title || brand.copy.share.fallbackCardName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Someone shared a copy of this card with you. It is yours — changes you make will not
            affect theirs.
          </p>
        </header>

        {saveMessage && (
          <Alert variant="info">
            <Info />
            <AlertDescription>{saveMessage}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button onClick={handleOpenInEditor}>Open in the editor</Button>
          {status === "authenticated" ? (
            <Button variant="outline" onClick={() => void handleSaveCopy()} disabled={busy}>
              {busy ? "Saving…" : "Save a copy"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => signIn(window.location.pathname)}>
              Sign in to save a copy
            </Button>
          )}
        </div>

        {/*
          Same panel as the editor's preview, minus the perforated edge — that
          motif belongs to exactly one surface, and this is not it.
        */}
        <div className="inline-block justify-self-start bg-paper p-4 shadow-raised print:block print:bg-transparent print:p-0 print:shadow-none">
          <CardGrid
            card={state.card}
            title={card.title}
            colorScheme={card.colorScheme}
            fontScheme={card.fontScheme}
            emojiScheme={card.emojiScheme}
          />
        </div>
      </div>
    </AppShell>
  );
}
