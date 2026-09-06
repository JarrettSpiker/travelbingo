import { useState } from "react";
import { useAuth } from "@/auth/authContext";
import { brand } from "@/brand";
import { FeedbackDialog } from "@/components/FeedbackDialog";

/**
 * The page footer. Currently one link; it exists as its own surface because
 * about and privacy links will land here too, and because there was previously
 * nowhere in this application to put a link that is not a destination.
 *
 * Carries **no motif**. `AppShell` already claims the page-texture slot for
 * this surface's ancestor, and DESIGN.md allows one motif per surface — so both
 * brands differentiate this through tokens and copy alone. That they can is
 * the seam working, not a limitation.
 *
 * Three states, not two:
 *
 *   accounts disabled  -> nothing. A build with no Cognito configuration has no
 *                         account system, so a feedback link would be a link to
 *                         nothing. This is the state a fresh clone is in, and
 *                         it is the one that gets forgotten.
 *   signed out         -> the link, opening a dialog that explains sign-in is
 *                         required. Shown rather than hidden so the channel is
 *                         at least discoverable to the visitors who cannot use
 *                         it — they are most of them.
 *   signed in          -> the link, opening the form.
 */
export function SiteFooter() {
  const { accountsEnabled } = useAuth();
  const [open, setOpen] = useState(false);

  if (!accountsEnabled) return null;

  return (
    <footer className="mt-auto border-t border-border/60">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-end px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-sm text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {brand.copy.feedback.linkLabel}
        </button>
      </div>
      <FeedbackDialog open={open} onClose={() => setOpen(false)} />
    </footer>
  );
}
