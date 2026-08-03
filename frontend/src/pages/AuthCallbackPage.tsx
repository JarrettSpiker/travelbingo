import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "../auth/authContext";
import { parseCallback } from "../lib/auth";
import { clearPending, loadPending } from "../lib/authSession";

/**
 * The registered OAuth redirect URI. It exists as its own route so the callback
 * handler cannot race the editor's ?card= import — both read the query string,
 * and on one path they would fight over it.
 */
export function AuthCallbackPage() {
  const { completeSignIn } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in development; an authorization code
    // is single-use, so a second exchange would fail and look like a real error.
    if (started.current) return;
    started.current = true;

    const result = parseCallback(window.location.search);
    const pending = loadPending();
    clearPending();

    if (result.kind === "error") {
      setError("Sign-in was cancelled or refused.");
      return;
    }

    if (result.kind === "none" || !pending) {
      setError("This sign-in link is no longer valid. Please try signing in again.");
      return;
    }

    // The CSRF check: a code delivered with a state we did not issue is not
    // from a flow this tab started.
    if (result.state !== pending.state) {
      setError("This sign-in link is no longer valid. Please try signing in again.");
      return;
    }

    void (async () => {
      const ok = await completeSignIn(result.code, pending.codeVerifier);
      if (!ok) {
        setError("We could not complete sign-in. Please try again.");
        return;
      }

      // replace, not push: the callback URL still holds the authorization code,
      // and Back should not return to it.
      void navigate(pending.returnTo, { replace: true });
    })();
  }, [completeSignIn, navigate]);

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 6 }}>
      {error ? (
        <Stack spacing={2}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={() => void navigate("/", { replace: true })}>
            Back to the card editor
          </Button>
        </Stack>
      ) : (
        <Stack spacing={2} sx={{ alignItems: "center" }}>
          <CircularProgress />
          <Typography>Signing you in…</Typography>
        </Stack>
      )}
    </Container>
  );
}
