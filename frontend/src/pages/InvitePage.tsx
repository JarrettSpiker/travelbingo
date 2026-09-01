import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { redeemInvite, resolveInvite } from "@/lib/tripApi";
import { ROUTES } from "@/lib/routes";
import { brand } from "@/brand";

/* Capitalized so JSX reads it as a component; a build-time constant. */
const TripIcon = brand.TripIcon;

type Phase = "loading" | "not_found" | "ready" | "redeeming" | "done" | "error";

/**
 * The public invite landing. Anyone holding a link can see the trip title
 * before joining; the token is the capability, exactly like a share link.
 *
 * - Signed out: prompt to sign in, preserving this URL through the OAuth
 *   callback (the existing `returnTo` mechanism), then auto-redeem on return.
 * - Signed in: redeem immediately and route to the trip.
 *
 * The route makes one anonymous request (resolving the invite) and, for a
 * signed-in visitor, one authenticated redeem. A signed-out visitor makes only
 * the anonymous resolve — no account requests until they sign in.
 */
export function InvitePage() {
  const { token = "" } = useParams();
  const { api, status, signIn, accountsEnabled, email } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("loading");
  const [title, setTitle] = useState<string | null>(null);
  const startedRedeem = useRef(false);

  // Resolve the invite once: the public call that works for anyone holding the
  // token. A 404 here is any of the reasons in `copy.trips.inviteInvalidReason`
  // — all identical from here.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const invite = await resolveInvite(api, token);
        if (cancelled) return;
        setTitle(invite.title);
        setPhase("ready");
      } catch {
        if (!cancelled) setPhase("not_found");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, token]);

  // Once signed in, redeem once and route to the trip.
  useEffect(() => {
    if (status !== "authenticated" || phase !== "ready" || startedRedeem.current) return;
    startedRedeem.current = true;
    setPhase("redeeming");
    void (async () => {
      try {
        const { tripId } = await redeemInvite(api, token, email);
        navigate(ROUTES.trip(tripId), { replace: true });
      } catch {
        setPhase("error");
      }
    })();
  }, [api, navigate, status, phase, token, email]);

  function handleSignIn() {
    // Preserve the full invite URL so the OAuth callback returns here, now
    // signed in, and the effect above redeems automatically.
    signIn(`/invite/${token}`);
  }

  if (!accountsEnabled) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <Alert variant="info">
          <TriangleAlert />
          <AlertDescription>Accounts are not enabled in this build.</AlertDescription>
        </Alert>
      </AppShell>
    );
  }

  return (
    <AppShell size="narrow" headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        {phase === "loading" && (
          <div className="grid justify-items-center gap-3 py-12">
            <Spinner label="Checking invite" />
          </div>
        )}

        {phase === "not_found" && (
          <div className="grid justify-items-start gap-4">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                This invite is no longer valid. It may have been revoked, or the{" "}
                {brand.copy.noun.trip} may be gone.
              </AlertDescription>
            </Alert>
            <Button onClick={() => void navigate(ROUTES.editor)}>Back to the card editor</Button>
          </div>
        )}

        {(phase === "ready" || phase === "redeeming") && (
          <div className="grid justify-items-center gap-4 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
              <TripIcon className="size-6" aria-hidden />
            </span>
            <div className="grid gap-1">
              <h1 className="font-display text-2xl font-semibold">You're invited</h1>
              <p className="text-lg">{title ?? `a ${brand.copy.noun.trip}`}</p>
            </div>

            {phase === "redeeming" ? (
              <Spinner label={`Joining the ${brand.copy.noun.trip}`} />
            ) : status === "authenticated" ? (
              <p className="text-sm text-muted-foreground">Joining…</p>
            ) : (
              <div className="grid gap-2">
                <p className="text-sm text-muted-foreground">
                  Sign in to join this {brand.copy.noun.trip}.
                </p>
                <div className="flex justify-center gap-2">
                  <Button onClick={handleSignIn}>Sign in to join</Button>
                  <Button variant="ghost" onClick={() => void navigate(ROUTES.editor)}>
                    Maybe later
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {phase === "error" && (
          <div className="grid justify-items-start gap-4">
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>
                Could not join this {brand.copy.noun.trip}. The invite may no longer be valid.
              </AlertDescription>
            </Alert>
            <Button onClick={() => void navigate(ROUTES.trips)}>Back to {brand.copy.noun.trips}</Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
