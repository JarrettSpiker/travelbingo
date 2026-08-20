import { Fragment } from "react";
import { Link } from "react-router";
import { BellRing, CircleAlert, PartyPopper, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EVENT_VERBS, type Notification } from "@/lib/notificationTypes";

/** Icon per event kind, so a full list scans without reading every verb. */
const EVENT_ICONS: Record<Notification["type"], typeof BellRing> = {
  progress_marked: Square,
  one_away: BellRing,
  victory: PartyPopper,
};

/**
 * The bell's dropdown contents: the caller's notifications, most-recent-first,
 * each leading to its trip. Rendered inside the bell's popover on the page and
 * inline in the gallery.
 *
 * An entry whose trip can no longer be opened (the member left, or the trip was
 * deleted) is indistinguishable from any other until followed — the trip page
 * then says so in the language of unavailability rather than an error.
 */
export function NotificationList({
  notifications,
  onMarkAllRead,
  formatTimestamp,
  onOpened,
}: {
  notifications: Notification[];
  onMarkAllRead?: () => void;
  formatTimestamp: (iso: string) => string;
  /** Fired when a row is followed, so the popover can close. */
  onOpened?: () => void;
}) {
  if (notifications.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-muted-foreground">
        Nothing yet. Wins and near-misses from your trips will appear here.
      </p>
    );
  }

  return (
    <div className="grid gap-1">
      <ul className="grid max-h-80 gap-1 overflow-y-auto">
        {notifications.map((notification) => {
          const Icon = EVENT_ICONS[notification.type];
          return (
            <li key={`${notification.tripId}:${notification.createdAt}:${notification.type}`}>
              <Link
                to={`/trips/${encodeURIComponent(notification.tripId)}`}
                state={{ fromNotification: true }}
                onClick={onOpened}
                className={cn(
                  "flex items-start gap-2 rounded-md p-2 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                  !notification.read && "bg-secondary/50",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {/* `min-w-0` so a long trip title truncates inside the row. */}
                <span className="grid min-w-0 gap-0.5">
                  <span className="text-sm">
                    <span className="font-medium">
                      {notification.actorName ?? "A member"} {EVENT_VERBS[notification.type]}
                    </span>{" "}
                    <span className="text-muted-foreground">in {notification.tripTitle}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatTimestamp(notification.createdAt)}
                    {!notification.read && (
                      <Fragment>
                        {" · "}
                        <span className="font-medium text-foreground">New</span>
                      </Fragment>
                    )}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {onMarkAllRead && (
        <Button variant="ghost" size="sm" className="justify-start" onClick={onMarkAllRead}>
          <CircleAlert className="size-3.5" aria-hidden /> Mark all as read
        </Button>
      )}
    </div>
  );
}
