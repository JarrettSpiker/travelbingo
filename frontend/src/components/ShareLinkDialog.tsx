import { useCallback, useEffect, useState } from "react";
import { Info, Trash2, TriangleAlert } from "lucide-react";
import { useAuth } from "@/auth/authContext";
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
import { Input } from "@/components/ui/input";
import { createShare, listShares, revokeShare, shareUrl, type ShareLink } from "@/lib/cardsApi";

interface ShareLinkDialogProps {
  open: boolean;
  onClose: () => void;
  /** The saved card to share, or null when the editor's card has not been saved. */
  cardId: string | null;
  onSaveFirst: () => Promise<string | null>;
}

export function ShareLinkDialog({ open, onClose, cardId, onSaveFirst }: ShareLinkDialogProps) {
  const { api, status } = useAuth();
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(
    async (id: string) => {
      try {
        setShares(await listShares(api, id));
      } catch {
        setError("Could not load this card's share links.");
      }
    },
    [api],
  );

  useEffect(() => {
    if (!open || !cardId || status !== "authenticated") return;
    void refresh(cardId);
  }, [open, cardId, status, refresh]);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      // A share link is a snapshot of a *saved* card, so an unsaved editor card
      // is saved first rather than silently sharing nothing.
      const id = cardId ?? (await onSaveFirst());
      if (!id) {
        setError("Could not save this card, so it could not be shared.");
        return;
      }
      await createShare(api, id);
      await refresh(id);
    } catch {
      setError("Could not create a share link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRevoke(token: string) {
    if (!cardId) return;
    setBusy(true);
    setError(null);
    try {
      await revokeShare(api, cardId, token);
      await refresh(cardId);
    } catch {
      setError("Could not revoke that link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share a copy of this card</DialogTitle>
          <DialogDescription>
            Anyone with the link gets their own copy of this card as it is now. Later edits you make
            will not change their copy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/*
            Stated plainly and not only in the spec: this is the one thing about
            share links that will surprise people.
          */}
          <Alert variant="info">
            <Info />
            <AlertDescription>
              Revoking a link stops anyone new from opening it. It cannot take back a copy someone
              has already made.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <TriangleAlert />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Button onClick={() => void handleCreate()} disabled={busy} className="justify-self-start">
            Create a share link
          </Button>

          {shares.length > 0 && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Active links</p>
              <ul className="grid gap-2">
                {shares.map((share) => (
                  <li key={share.token} className="flex items-center gap-2">
                    <Input
                      value={shareUrl(share.token)}
                      readOnly
                      onFocus={(event) => event.target.select()}
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard?.writeText(shareUrl(share.token)).catch(() => {
                          // Clipboard access can fail; the field above is
                          // selectable as the fallback.
                        });
                      }}
                    >
                      Copy
                    </Button>
                    {/*
                      Ghost, not a solid destructive fill: the palette's
                      terracotta primary and crimson destructive are close
                      enough in hue that two solid buttons side by side would be
                      easy to confuse — and this one revokes access.
                    */}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Revoke this link"
                      onClick={() => void handleRevoke(share.token)}
                      disabled={busy}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
