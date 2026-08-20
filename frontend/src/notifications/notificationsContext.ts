import { createContext, useContext } from "react";

// The context and hook live in this plain .ts file, not beside the provider
// component, so react-refresh's only-export-components rule stays quiet — the
// same reason the auth context lives in authContext.ts rather than in
// AuthProvider.tsx.

/**
 * The bell's unread count, shared between the header and the trip pages.
 *
 * The header owns no timer: it fetches once when the session appears, and the
 * trip progress poll — which the backend already decorates with the count —
 * pushes updates through here while a trip page is open. Elsewhere the count is
 * simply whatever it last was, which for a user not looking at a trip is the
 * right staleness.
 */
export interface NotificationsContextValue {
  /** Null before the first fetch completes — "unknown", not "zero". */
  unread: number | null;
  /** Sets the count directly; the trip poll's channel. */
  setUnread: (count: number) => void;
  /** Re-fetches the count (and is what "mark read" calls afterwards). */
  refresh: () => Promise<void>;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function useNotifications(): NotificationsContextValue {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications requires NotificationsProvider");
  return value;
}
