import { PartyPopper, TriangleAlert, Trophy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * What a trip card's play adds up to, shown around the card — never on it.
 *
 * Three separate truths, deliberately not reconciled:
 *  - a recorded win (`wonAt`/`winnerLabel`) is history, and stays even if the
 *    marks are later unmarked below the target;
 *  - the distance is computed live from the current marks, so a won-then-
 *    unmarked card reads correctly as both "won on the 4th" and "3 squares
 *    to go";
 *  - the celebration follows the viewer's own completing mark, and is
 *    dismissible.
 */
export function CardWinStatus({
  distance,
  wonAt,
  winnerLabel,
  formatTimestamp,
  celebration,
  onDismissCelebration,
}: {
  /** From squaresFromWin: 0 means the target is met, Infinity means unreachable. */
  distance: number;
  /** The recorded win, if any — passed through as stored. */
  wonAt?: string;
  /** The winning member's display label, resolved by the page. */
  winnerLabel?: string;
  formatTimestamp: (iso: string) => string;
  /** Present while the viewer's own mark just completed the target. */
  celebration?: string | null;
  onDismissCelebration?: () => void;
}) {
  return (
    <div className="grid gap-2">
      {celebration && (
        <Alert>
          <PartyPopper />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{celebration}</span>
            {onDismissCelebration && (
              <Button variant="ghost" size="sm" onClick={onDismissCelebration}>
                Dismiss
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {wonAt !== undefined && (
        <Badge variant="secondary" className="w-fit gap-1">
          <Trophy className="size-3" aria-hidden /> Won by {winnerLabel ?? "a member"} on{" "}
          {formatTimestamp(wonAt)}
        </Badge>
      )}

      <span className="inline-flex items-start gap-1.5 text-muted-foreground">
        {distance === Infinity ? (
          <>
            <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden /> Can&apos;t reach this trip&apos;s
            target — the card has blank squares that can never be marked.
          </>
        ) : distance === 0 ? (
          <>Target met</>
        ) : (
          <>
            {distance} square{distance === 1 ? "" : "s"} to go
          </>
        )}
      </span>
    </div>
  );
}
