import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The app's one loading indicator, replacing MUI's `CircularProgress`.
 *
 * `role="status"` with an accessible name, so a screen reader announces that
 * something is happening rather than nothing at all — a spinning icon is
 * invisible to anyone not looking at it.
 */
export function Spinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span role="status" aria-label={label}>
      <Loader2 className={cn("size-6 animate-spin text-muted-foreground", className)} aria-hidden />
    </span>
  );
}
