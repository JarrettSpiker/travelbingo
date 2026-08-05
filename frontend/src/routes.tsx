import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import App from "./App";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { SavedCardsPage } from "./pages/SavedCardsPage";
import { SharedCardPage } from "./pages/SharedCardPage";
import { useAuth } from "./auth/authContext";
import { readCardParam } from "./lib/cardParam";
import { editorLoadMode, fetchCardForReload, shouldFetchCard } from "./lib/editorLoad";
import type { CardUrlData } from "./lib/cardData";

interface EditorNavigationState {
  card?: CardUrlData;
  cardId?: string;
}

/** Non-blocking spinner shown only while the reload-restore fetch is in flight. */
function EditorLoading() {
  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
      <Stack spacing={2} sx={{ alignItems: "center" }}>
        <CircularProgress />
      </Stack>
    </Container>
  );
}

/**
 * The editor route.
 *
 * App keeps its useState initializers rather than gaining an effect, so a card
 * arriving by navigation is applied by remounting: a fresh `location.key` gives
 * new initial state. The key is held constant when no card is being handed
 * over, so simply navigating back from /cards does not discard work in progress.
 *
 * A card can arrive two ways:
 *  - instantly, via in-memory `location.state` (the library's "open" action),
 *    which paints immediately with no refetch; or
 *  - durably, via a `?card=<id>` query param, which survives reload and
 *    bookmark. On reload the state is gone, so the route fetches the card by id
 *    and hands it to App as the initial card, reusing the same cardStateFrom
 *    path. The fetch runs only for a signed-in visitor with an id in the URL; a
 *    signed-out visitor or a plain load makes zero API requests.
 */
function EditorRoute() {
  const location = useLocation();
  const { api, status } = useAuth();
  const state = (location.state ?? null) as EditorNavigationState | null;
  const incoming = state?.card ?? null;
  const urlCardId = readCardParam(location.search);

  const loadInput = { incoming, urlCardId, status };
  const mode = editorLoadMode(loadInput);
  const willFetch = shouldFetchCard(loadInput);

  // undefined = not yet resolved; CardUrlData | null = fetch completed (null is
  // absent/other-user's card, rendered as an empty editor).
  const [fetched, setFetched] = useState<CardUrlData | null | undefined>(undefined);

  useEffect(() => {
    if (!willFetch || urlCardId === null) return;
    let cancelled = false;
    setFetched(undefined);
    void (async () => {
      const card = await fetchCardForReload(api, urlCardId);
      if (!cancelled) setFetched(card);
    })();
    return () => {
      cancelled = true;
    };
  }, [willFetch, api, urlCardId]);

  // Instant open via navigation state — App remounts on a fresh location key so
  // its initializers see the incoming card.
  if (mode === "instant") {
    return <App key={location.key} initialCard={incoming} initialCardId={state?.cardId ?? null} />;
  }

  // Empty editor: no card id in the URL, a signed-out visitor with one (prompt
  // to sign in is the AuthMenu, which is part of App), or otherwise nothing to
  // load. Never fetches.
  if (mode === "empty") {
    return <App key="editor" initialCard={null} initialCardId={null} />;
  }

  // mode === "loading": awaiting auth resolution or the card fetch.
  if (willFetch && fetched !== undefined) {
    // A null result is an absent or other-user's card; render empty and do not
    // seed the id, so a subsequent save creates a fresh card rather than trying
    // to replace one the visitor has no membership for.
    return (
      <App
        key={urlCardId ?? "editor"}
        initialCard={fetched}
        initialCardId={fetched ? urlCardId : null}
      />
    );
  }

  return <EditorLoading />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<EditorRoute />} />
      <Route path="/cards" element={<SavedCardsPage />} />
      <Route path="/s/:token" element={<SharedCardPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      {/* Anything else lands on the editor rather than a dead end. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
