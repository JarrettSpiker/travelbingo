import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/auth/authContext";
import { listNotifications } from "@/lib/notificationApi";
import { NotificationsContext } from "./notificationsContext";

/**
 * Provides the bell's unread count (see notificationsContext.ts for the shape
 * and the no-second-timer rule). Inside AuthProvider, because it reads the
 * auth state; renders children immediately and gates nothing — like
 * AuthProvider, it must never hold up first paint or the signed-out experience.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { api, status, accountsEnabled } = useAuth();
  const [unread, setUnread] = useState<number | null>(null);

  // The api object is stable per session, but the fetch must not re-run on
  // every render-triggered identity change, so it is read through a ref.
  const apiRef = useRef(api);
  apiRef.current = api;

  const refresh = useCallback(async () => {
    try {
      const list = await listNotifications(apiRef.current);
      setUnread(list.unreadCount);
    } catch {
      // The bell is not worth an error surface; the next poll or mount
      // refreshes it. A signed-out or stale session simply keeps the last
      // known count.
    }
  }, []);

  useEffect(() => {
    // One fetch per session, when there is a session. A signed-out visitor
    // makes no notification request at all.
    if (accountsEnabled && status === "authenticated") void refresh();
  }, [accountsEnabled, status, refresh]);

  return (
    <NotificationsContext.Provider value={{ unread, setUnread, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}
