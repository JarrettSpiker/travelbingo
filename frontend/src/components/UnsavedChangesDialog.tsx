import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

interface UnsavedChangesDialogProps {
  open: boolean;
  /**
   * Whether the card can be saved from here — true only for a signed-in user.
   * Saving to the library needs an account, and account features are additive,
   * so a signed-out user gets the warning without the save action rather than
   * being sent to sign in halfway through a navigation.
   */
  canSave: boolean;
  /** A save started from this dialog is in flight. */
  saving: boolean;
  /** Message for a save that failed, or null. The navigation has not happened. */
  error: string | null;
  onSaveAndLeave: () => void;
  onLeaveWithoutSaving: () => void;
  onStay: () => void;
}

/**
 * The confirmation shown when a navigation would discard the editor's unsaved
 * card.
 *
 * It reports the user's choice through callbacks and holds no state of its own:
 * the pending navigation belongs to the router's blocker in App, and so does
 * the save. Dismissing the dialog any other way — Escape, the close button, a
 * click outside — means "stay", which is the choice that loses nothing.
 */
export function UnsavedChangesDialog({
  open,
  canSave,
  saving,
  error,
  onSaveAndLeave,
  onLeaveWithoutSaving,
  onStay,
}: UnsavedChangesDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onStay()}>
      {/*
        Wide enough for three actions on one row: at the default max-w-md the
        footer overflowed the panel and clipped both the last button and the
        description beside it.
      */}
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>You have unsaved changes</DialogTitle>
          <DialogDescription>
            {canSave
              ? "Leaving this page now will discard the changes you have made to this card. You can save them first."
              : // Deliberately says nothing about signing in: this copy also
                // shows when accounts are switched off entirely, where there is
                // no sign-in to point at.
                "Leaving this page now will discard the changes you have made to this card. Stay here if you want to print or download it first."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/*
          Ordered least- to most-preferred: DialogFooter lays this out left to
          right on desktop and column-reversed on a phone, so either way the
          recommended action is where the eye ends up and "leave without saving"
          is the one you have to travel to. "Stay" becomes the primary when
          there is nothing to save, so the dialog always offers one obvious safe
          choice.
        */}
        <DialogFooter className="sm:flex-wrap">
          <Button
            variant="ghost"
            onClick={onLeaveWithoutSaving}
            disabled={saving}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Leave without saving
          </Button>
          <Button variant={canSave ? "outline" : "default"} onClick={onStay} disabled={saving}>
            Stay
          </Button>
          {canSave && (
            <Button onClick={onSaveAndLeave} disabled={saving}>
              {/* text-current: the spinner's default muted grey all but vanishes
                  against the primary button's fill. */}
              {saving && <Spinner className="size-4 text-current" label="Saving" />}
              {saving ? "Saving…" : "Save and leave"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
