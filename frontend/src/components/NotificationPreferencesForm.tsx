import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationEventType,
  type StoredNotificationPreferences,
} from "@/lib/notificationTypes";

const TYPE_LABELS: Record<NotificationEventType, string> = {
  progress_marked: "Individual marks",
  one_away: "One square away",
  victory: "Wins",
};

const TYPE_HINTS: Record<NotificationEventType, string> = {
  progress_marked: "Every square a member marks. Off by default — in a busy trip this is constant.",
  one_away: "A card comes within one square of the trip's target. On by default.",
  victory: "A member completes the trip's target. On by default.",
};

/**
 * The notification-preferences section of the settings page: which event kinds
 * notify this user, and which of their trips are muted.
 *
 * The initial values always show a real state — for a user who has never saved,
 * the server returns the defaults, so the form reads as "these are in effect"
 * rather than blank.
 */
export function NotificationPreferencesForm({
  initial,
  trips,
  saving,
  onSave,
}: {
  initial: StoredNotificationPreferences;
  trips: { tripId: string; title: string }[];
  saving: boolean;
  onSave: (preferences: {
    types: Record<NotificationEventType, boolean>;
    mutedTripIds: string[];
  }) => void;
}) {
  const [types, setTypes] = useState(initial.types);
  const [muted, setMuted] = useState(() => new Set(initial.mutedTripIds));

  // Re-sync when a fresh `initial` arrives (the page's fetch landing after the
  // form mounted on defaults). Edits are held only in local state, so this
  // only ever reflects values the page believes are current.
  useEffect(() => {
    setTypes(initial.types);
    setMuted(new Set(initial.mutedTripIds));
  }, [initial]);

  const dirty =
    Object.keys(types).some(
      (type) => types[type as NotificationEventType] !== initial.types[type as NotificationEventType],
    ) || muted.size !== initial.mutedTripIds.length;

  function toggleMute(tripId: string, next: boolean) {
    setMuted((current) => {
      const nextSet = new Set(current);
      if (next) nextSet.add(tripId);
      else nextSet.delete(tripId);
      return nextSet;
    });
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Choose which play events from your trips reach your notification list.
      </p>

      <div className="grid gap-3">
        {(Object.keys(TYPE_LABELS) as NotificationEventType[]).map((type) => (
          <label
            key={type}
            className="flex items-start justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
          >
            <span className="grid gap-0.5">
              <span className="text-sm font-medium">
                {TYPE_LABELS[type]}
                {initial.types[type] === DEFAULT_NOTIFICATION_PREFERENCES.types[type] && (
                  <span className="ml-1.5 text-xs font-normal text-muted-foreground">(default)</span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">{TYPE_HINTS[type]}</span>
            </span>
            <Switch
              checked={types[type]}
              onCheckedChange={(next) => setTypes((current) => ({ ...current, [type]: next }))}
            />
          </label>
        ))}
      </div>

      {trips.length > 0 && (
        <div className="grid gap-2">
          <p className="text-sm font-medium text-muted-foreground">Muted trips</p>
          <p className="text-xs text-muted-foreground">
            A muted trip never notifies you; its activity feed still shows everything.
          </p>
          <div className="grid gap-2">
            {trips.map((trip) => (
              <label
                key={trip.tripId}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
              >
                <span className="min-w-0 truncate text-sm">{trip.title}</span>
                <Switch
                  checked={muted.has(trip.tripId)}
                  onCheckedChange={(next) => toggleMute(trip.tripId, next)}
                  aria-label={`Mute ${trip.title}`}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <Button disabled={saving || !dirty} onClick={() => onSave({ types, mutedTripIds: [...muted] })}>
          <Bell aria-hidden /> {saving ? "Saving…" : "Save preferences"}
        </Button>
      </div>
    </div>
  );
}
