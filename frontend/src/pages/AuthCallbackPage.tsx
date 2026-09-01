import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "../auth/authContext";
import { parseCallback } from "../lib/auth";
import { clearPending, loadPending } from "../lib/authSession";
import { ROUTES } from "@/lib/routes";

/**
 * The registered OAuth redirect URI. It exists as its own route so the callback
 * handler owns the query string during the code exchange and does not collide
 * with any other route's reading of it.
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
    <AppShell size="narrow" headerActions={<AuthMenu />}>
      <h1 className="sr-only">Signing in</h1>
      {error ? (
        <div className="grid gap-4 justify-items-start">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate(ROUTES.editor, { replace: true })}>
            Back to the card editor
          </Button>
        </div>
      ) : (
        <div className="grid justify-items-center gap-3 py-12">
          <Spinner label="Signing you in" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </div>
      )}
    </AppShell>
  );
}
