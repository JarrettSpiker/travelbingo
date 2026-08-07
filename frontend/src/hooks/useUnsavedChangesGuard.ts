import { useEffect } from "react";
import { useBlocker, type Blocker } from "react-router";

/**
 * Stops a navigation from silently discarding the editor's unsaved work.
 *
 * Two mechanisms, because no single one covers both halves of "leaving":
 *
 *  - `useBlocker` is one interception point at the router for every in-app
 *    navigation — the header wordmark and links, the account menu's library
 *    entry, opening another saved card, and in-app back/forward. Blocking at
 *    the router rather than at each link is what makes it complete: there is no
 *    per-link wiring to forget, and back/forward could not be wrapped anyway.
 *    It needs a data router, which is why `main.tsx` mounts one.
 *  - `beforeunload` covers what the router never sees: reload, tab or window
 *    close, and navigation to an external URL. Its copy is not customisable —
 *    browsers show their own generic message — so it is the last-resort guard,
 *    and the in-app dialog carries the real wording.
 *
 * The caller renders the confirmation when the returned blocker is "blocked",
 * and resolves it with `blocker.proceed()` or `blocker.reset()`.
 */
export function useUnsavedChangesGuard(isDirty: boolean): Blocker {
  // Passed as a function, re-created on every render, so the router always
  // evaluates the current value rather than one captured at mount.
  const blocker = useBlocker(() => isDirty);

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // Both, deliberately: preventDefault is the current standard, and
      // returnValue is what older browsers still require.
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    // Cleanup removes the same reference it added, so StrictMode's
    // mount-unmount-mount cannot leave a listener behind that would prompt on
    // a clean editor.
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  return blocker;
}
