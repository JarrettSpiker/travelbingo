import { useEffect, useId, useState } from "react";
import { CircleCheck } from "lucide-react";
import { useAuth } from "@/auth/authContext";
import { brand } from "@/brand";
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
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/apiClient";
import { submitFeedback } from "@/lib/feedbackApi";

/** Matches MAX_MESSAGE_LENGTH in backend/src/lib/feedbackPayload.ts. */
const MAX_MESSAGE_LENGTH = 2000;
/** The code the backend returns when the per-account cap is reached. */
const CAP_REACHED = "feedback_cap_reached";

interface FeedbackDialogProps {
  open: boolean;
  onClose: () => void;
}

type Phase = "editing" | "sending" | "sent";

/**
 * The feedback form, and — for a signed-out visitor — the explanation of why
 * there is no form.
 *
 * Nothing here runs on mount. The signed-out branch renders text and a button
 * and makes no request, which is what keeps the footer compatible with
 * `user-accounts`' rule that a signed-out load touches the account backend not
 * at all.
 */
export function FeedbackDialog({ open, onClose }: FeedbackDialogProps) {
  const { api, status, signIn } = useAuth();
  const copy = brand.copy.feedback;
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [phase, setPhase] = useState<Phase>("editing");
  const [error, setError] = useState<string | null>(null);

  // Reset on close rather than on open, so the dialog's closing animation does
  // not play over a form visibly emptying itself.
  useEffect(() => {
    if (open) return;
    setMessage("");
    setContact("");
    setPhase("editing");
    setError(null);
  }, [open]);

  const signedIn = status === "authenticated";
  const trimmed = message.trim();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed || phase === "sending") return;

    setPhase("sending");
    setError(null);
    try {
      await submitFeedback(api, trimmed, contact);
      setPhase("sent");
    } catch (caught) {
      // The cap is not a failure of the submission — it is a limit that has
      // been reached — so it gets its own words rather than "something went
      // wrong", which would send someone looking for a bug that isn't there.
      const capped = caught instanceof ApiError && caught.code === CAP_REACHED;
      setError(capped ? copy.capReachedMessage : copy.errorMessage);
      setPhase("editing");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{copy.linkLabel}</DialogTitle>
          <DialogDescription>{signedIn ? copy.intro : copy.signedOutPrompt}</DialogDescription>
        </DialogHeader>

        {!signedIn && (
          <DialogFooter>
            {/*
              "Not now" rather than "Close": DialogContent already renders its
              own close control with an sr-only "Close" label, and two buttons
              sharing an accessible name in one dialog is ambiguous to anyone
              navigating by name. Not brand copy — it reads identically in every
              brand, and DESIGN.md's rule is that such text stays out of the
              brand seam.
            */}
            <Button variant="outline" onClick={onClose}>
              Not now
            </Button>
            <Button onClick={() => signIn(window.location.pathname)}>Sign in</Button>
          </DialogFooter>
        )}

        {signedIn && phase === "sent" && (
          <>
            <Alert>
              <CircleCheck />
              <AlertDescription>{copy.successMessage}</AlertDescription>
            </Alert>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </>
        )}

        {signedIn && phase !== "sent" && (
          <FeedbackForm
            message={message}
            contact={contact}
            error={error}
            sending={phase === "sending"}
            onMessageChange={setMessage}
            onContactChange={setContact}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface FeedbackFormProps {
  message: string;
  contact: string;
  error: string | null;
  sending: boolean;
  onMessageChange: (value: string) => void;
  onContactChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
  onCancel: () => void;
}

/**
 * The fields themselves, separate from the dialog and the auth branch around
 * them.
 *
 * Split out so the dev gallery can render the *real* form. The gallery has no
 * signed-in state to render into, and the alternative — a hand-built copy in
 * the gallery, as `SettingsPageSample` does — is a copy that drifts. This is
 * the same problem solved without the drift.
 */
export function FeedbackForm({
  message,
  contact,
  error,
  sending,
  onMessageChange,
  onContactChange,
  onSubmit,
  onCancel,
}: FeedbackFormProps) {
  const copy = brand.copy.feedback;
  const fieldId = useId();
  const trimmed = message.trim();

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Field
        htmlFor={`${fieldId}-message`}
        label={copy.messageLabel}
        hint={`${trimmed.length} / ${MAX_MESSAGE_LENGTH}`}
      >
        {({ id, describedBy }) => (
          <Textarea
            id={id}
            aria-describedby={describedBy}
            value={message}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={copy.messagePlaceholder}
            onChange={(event) => onMessageChange(event.target.value)}
            required
          />
        )}
      </Field>

      <Field htmlFor={`${fieldId}-contact`} label={copy.contactLabel} hint={copy.contactHint}>
        {({ id, describedBy }) => (
          <Input
            id={id}
            type="email"
            aria-describedby={describedBy}
            value={contact}
            onChange={(event) => onContactChange(event.target.value)}
          />
        )}
      </Field>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!trimmed || sending}>
          {copy.submitLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}
