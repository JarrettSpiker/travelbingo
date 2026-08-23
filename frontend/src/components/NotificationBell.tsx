import { useState, type ComponentProps } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useAuth } from "@/auth/authContext";
import { useNotifications } from "@/notifications/notificationsContext";
import { NotificationList } from "@/components/NotificationList";
import { listNotifications, markNotificationsRead } from "@/lib/notificationApi";
import type { Notification } from "@/lib/notificationTypes";
import { formatTripTimestamp } from "@/lib/tripDates";

const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

/**
 * The bell's trigger: the icon and its unread badge, and nothing else.
 *
 * Split out of `NotificationBell` so the gallery can render the real button
 * rather than a copy of its markup — the popover needs a session and a
 * provider, this does not. `...props` carries what `PopoverTrigger asChild`
 * hands down — including a className, which Radix's Slot always sets and which
 * would otherwise clobber the `relative` the badge is positioned against.
 */
export function NotificationBellButton({
  unread,
  className,
  ...props
}: { unread: number | null } & ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
      {...props}
      className={cn("relative", className)}
    >
      <Bell aria-hidden />
      {unread !== null && unread > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground"
          aria-hidden
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}

/**
 * The bell in the header. Shown only when signed in: notifications are an
 * account-only feature and a signed-out visitor sees no surface and triggers no
 * request.
 *
 * The unread count comes from the shared provider (refreshed by the trip
 * progress poll while a trip page is open); the entries are fetched when the
 * dropdown opens, because that is the only moment they are needed.
 */
export function NotificationBell() {
  const { api } = useAuth();
  const { unread, setUnread, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Notification[] | null>(null);
  const [loading, setLoading] = useState(false);
  /** Set when the entries fetch failed, so the dropdown says so rather than asserting an empty bell. */
  const [loadFailed, setLoadFailed] = useState(false);

  async function openDropdown(next: boolean) {
    setOpen(next);
    if (!next) return;
    setLoading(true);
    setLoadFailed(false);
    try {
      const list = await listNotifications(api);
      setEntries(list.notifications);
      setUnread(list.unreadCount);
    } catch {
      // Admit the failure instead of rendering "Nothing yet" over a dead
      // fetch; the count keeps whatever it last was.
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    // Optimistic: the rows dim immediately, and a failed write only means the
    // count comes back on the next refresh.
    setEntries((current) => current?.map((entry) => ({ ...entry, read: true })) ?? current);
    setUnread(0);
    try {
      await markNotificationsRead(api);
    } finally {
      void refresh();
    }
  }

  return (
    <Popover open={open} onOpenChange={(next) => void openDropdown(next)}>
      <PopoverTrigger asChild>
        <NotificationBellButton unread={unread} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {loading && entries === null ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : loadFailed ? (
          <p className="px-1 py-6 text-center text-sm text-muted-foreground">
            Could not load your notifications. Close and reopen the bell to retry.
          </p>
        ) : (
          <NotificationList
            notifications={entries ?? []}
            onMarkAllRead={entries && entries.length > 0 ? () => void markAllRead() : undefined}
            formatTimestamp={(iso) => formatTripTimestamp(iso, DATE_FORMAT)}
            onOpened={() => setOpen(false)}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
