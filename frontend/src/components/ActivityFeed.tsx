import { BellRing, History, PartyPopper, Square } from "lucide-react";
import { EVENT_VERBS, type TripActivityEvent } from "@/lib/notificationTypes";

const EVENT_ICONS: Record<TripActivityEvent["type"], typeof BellRing> = {
  progress_marked: Square,
  one_away: BellRing,
  victory: PartyPopper,
};

/**
 * The trip's activity feed: what has happened in this trip, most-recent-first,
 * for every member — including one who has muted the trip, because the feed is
 * the "show everything" surface and the bell, not the feed, is what mutes
 * govern.
 */
export function ActivityFeed({
  events,
  formatTimestamp,
}: {
  events: TripActivityEvent[];
  formatTimestamp: (iso: string) => string;
}) {
  if (events.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" aria-hidden /> Nothing has happened in this trip yet.
      </p>
    );
  }

  return (
    <ol className="grid gap-2">
      {events.map((event, index) => {
        const Icon = EVENT_ICONS[event.type];
        return (
          <li
            key={`${event.createdAt}:${event.type}:${event.actorId}:${index}`}
            className="flex items-start gap-2 text-sm"
          >
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="grid min-w-0 gap-0.5">
              <span>
                <span className="font-medium">{event.actorName ?? "A member"}</span>{" "}
                {EVENT_VERBS[event.type]}
              </span>
              <span className="text-xs text-muted-foreground">{formatTimestamp(event.createdAt)}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
