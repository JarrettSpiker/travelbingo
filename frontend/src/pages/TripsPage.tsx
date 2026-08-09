import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Compass, Info, Plus, RotateCw, TriangleAlert, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { formatTripRange } from "@/lib/tripDates";
import { listTrips } from "@/lib/tripApi";
import type { TripSummary } from "@/lib/tripTypes";

/** The list is compact and scanned in bulk, so it drops the year. */
const RANGE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

export function TripsPage() {
  const { api, status, signIn, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [trips, setTrips] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTrips(await listTrips(api));
      setError(null);
    } catch {
      setError("Could not load your trips.");
      // Deliberately not `[]`: an empty array is indistinguishable from "you
      // have no trips", and the empty-state copy would render under the
      // failure telling the user their trips do not exist.
      setTrips(null);
    }
  }, [api]);

  const retry = useCallback(() => {
    setError(null);
    setTrips(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void load();
  }, [status, load]);

  if (!accountsEnabled) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <Info />
            <AlertDescription>Accounts are not enabled in this build.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate("/")}>Back to the card editor</Button>
        </div>
      </AppShell>
    );
  }

  if (status === "loading") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label="Loading your trips" />
        </div>
      </AppShell>
    );
  }

  if (status === "anonymous") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <h1 className="font-display text-2xl font-semibold">Trips</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to gather friends and bingo cards under one trip.
          </p>
          <div className="flex gap-2">
            <Button onClick={() => signIn("/trips")}>Sign in</Button>
            <Button variant="ghost" onClick={() => void navigate("/")}>
              Back to the card editor
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        {/* Wraps like the detail page's equivalent row: below ~360px the
            heading and both buttons do not fit on one line, and without this
            they push the whole page into horizontal scroll. */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Trips</h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void navigate("/")}>
              Back to the editor
            </Button>
            <Button onClick={() => void navigate("/trips/new")}>
              <Plus aria-hidden /> New trip
            </Button>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>
              {error}
              <Button variant="outline" size="sm" onClick={retry}>
                <RotateCw aria-hidden /> Try again
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* A failed load leaves `trips` null too, so both the spinner and the
            empty state stand down until the retry resolves. */}
        {trips === null && !error && (
          <div className="flex justify-center py-12">
            <Spinner label="Loading your trips" />
          </div>
        )}

        {trips?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You are not in any trips yet. Create one to gather friends and cards for an event.
          </p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips?.map((trip) => {
            const range = formatTripRange(trip.startDate, trip.endDate, RANGE_FORMAT);
            return (
              <li key={trip.tripId}>
                <button
                  type="button"
                  onClick={() => void navigate(`/trips/${trip.tripId}`)}
                  className="grid w-full gap-3 rounded-lg border border-border bg-card p-4 text-left shadow-postcard transition-transform focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none hover:-translate-y-0.5"
                >
                  <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">
                    <Compass className="size-5" aria-hidden />
                  </span>
                  <span className="grid gap-1">
                    <span className="block font-medium">{trip.title}</span>
                    {range && <span className="text-sm text-muted-foreground">{range}</span>}
                    <span className="flex items-center gap-2 pt-1">
                      <Badge variant={trip.role === "admin" ? "default" : "secondary"}>
                        <Users className="size-3" aria-hidden /> {trip.role === "admin" ? "Admin" : "Member"}
                      </Badge>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
