import { Navigate, Route, Routes, useLocation } from "react-router";
import App from "./App";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { SavedCardsPage } from "./pages/SavedCardsPage";
import { SharedCardPage } from "./pages/SharedCardPage";
import type { CardUrlData } from "./lib/cardUrl";

interface EditorNavigationState {
  card?: CardUrlData;
  cardId?: string;
}

/**
 * The editor route.
 *
 * App keeps its useState initializers rather than gaining an effect, so a card
 * arriving by navigation is applied by remounting: a fresh `location.key` gives
 * new initial state. The key is held constant when no card is being handed
 * over, so simply navigating back from /cards does not discard work in progress.
 */
function EditorRoute() {
  const location = useLocation();
  const state = (location.state ?? null) as EditorNavigationState | null;
  const incoming = state?.card ?? null;

  return (
    <App
      key={incoming ? location.key : "editor"}
      initialCard={incoming}
      initialCardId={state?.cardId ?? null}
    />
  );
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
