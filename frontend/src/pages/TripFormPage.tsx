import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router";
import { Compass, TriangleAlert } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { Panel } from "@/components/Panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { createTrip, getTrip, updateTrip } from "@/lib/tripApi";
import type { TripMode } from "@/lib/tripTypes";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Mirrors the backend title bound. The server rejects anything over it; this
 * keeps the client from sending a value the server would refuse.
 */
const MAX_TITLE_LENGTH = 200;

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime());
}

export function TripFormPage() {
  const { tripId } = useParams();
  const isEdit = Boolean(tripId);
  const { api, status, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<TripMode>("cooperative");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!isEdit || status !== "authenticated") return;
    let cancelled = false;
    void (async () => {
      try {
        const trip = await getTrip(api, tripId!);
        if (cancelled) return;
        setTitle(trip.title);
        setMode(trip.mode);
        setStartDate(trip.startDate ?? "");
        setEndDate(trip.endDate ?? "");
      } catch {
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, isEdit, status, tripId]);

  if (!accountsEnabled || status === "anonymous") {
    // Account-only: signed-out visitors never reach the form and make zero
    // trip requests. SettingsPage handles the same gate the same way.
    return <Navigate to="/trips" replace />;
  }

  if (status === "loading" || loading) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label={isEdit ? "Loading trip" : "Starting"} />
        </div>
      </AppShell>
    );
  }

  if (notFound) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>That trip could not be found.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate("/trips")}>Back to trips</Button>
        </div>
      </AppShell>
    );
  }

  const titleError = title.trim() === "" ? "Give the trip a name." : undefined;
  const startBad = startDate !== "" && !isValidDate(startDate);
  const endBad = endDate !== "" && !isValidDate(endDate);
  const outOfOrder =
    startDate !== "" && endDate !== "" && !startBad && !endBad && endDate < startDate;
  const dateError = startBad
    ? "Start date must be a calendar date (YYYY-MM-DD)."
    : endBad
      ? "End date must be a calendar date (YYYY-MM-DD)."
      : outOfOrder
        ? "End date can't be before the start date."
        : undefined;
  const canSubmit = !saving && !titleError && !dateError;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      const dates = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };
      if (isEdit) {
        await updateTrip(api, tripId!, { title: title.trim(), ...dates });
        navigate(`/trips/${tripId}`, { replace: true });
      } else {
        const { tripId: newId } = await createTrip(api, { title: title.trim(), mode, ...dates });
        navigate(`/trips/${newId}`, { replace: true });
      }
    } catch {
      setError(isEdit ? "Could not save the trip. Please try again." : "Could not create the trip. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell size="narrow" headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">
            {isEdit ? "Edit trip" : "New trip"}
          </h1>
          <Button variant="ghost" onClick={() => void navigate(isEdit ? `/trips/${tripId}` : "/trips")}>
            Cancel
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Panel title="Trip details" icon={Compass}>
          <div className="grid gap-6">
            <Field htmlFor="trip-title" label="Title" error={titleError}>
              {({ id, describedBy }) => (
                <Input
                  id={id}
                  aria-describedby={describedBy}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                  aria-invalid={Boolean(titleError)}
                  autoFocus
                />
              )}
            </Field>

            {/* The mode is fixed once the trip exists; show it read-only on edit. */}
            {isEdit ? (
              <Field htmlFor="trip-mode" label="Mode" hint="A trip's mode can't be changed after it's created.">
                {({ id }) => (
                  <Input id={id} value={mode === "cooperative" ? "Cooperative" : "Competitive"} readOnly disabled />
                )}
              </Field>
            ) : (
              <Field
                htmlFor="trip-mode"
                label="Mode"
                hint="Cooperative: everyone plays every card. Competitive: you assign each card to a player."
              >
                {({ id }) => (
                  <Select
                    value={mode}
                    onValueChange={(value) => setMode(value as TripMode)}
                  >
                    <SelectTrigger id={id} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cooperative">Cooperative</SelectItem>
                      <SelectItem value="competitive">Competitive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Field htmlFor="trip-start" label="Start date (optional)" error={startBad ? dateError : undefined}>
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    aria-invalid={startBad}
                    placeholder="YYYY-MM-DD"
                  />
                )}
              </Field>
              <Field
                htmlFor="trip-end"
                label="End date (optional)"
                error={endBad || outOfOrder ? dateError : undefined}
              >
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    aria-describedby={describedBy}
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    aria-invalid={endBad || outOfOrder}
                    placeholder="YYYY-MM-DD"
                  />
                )}
              </Field>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => void submit()} disabled={!canSubmit}>
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create trip"}
              </Button>
            </div>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
