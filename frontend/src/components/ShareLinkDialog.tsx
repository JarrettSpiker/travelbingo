import { useCallback, useEffect, useState } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "../auth/authContext";
import { createShare, listShares, revokeShare, shareUrl, type ShareLink } from "../lib/cardsApi";

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
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Share a copy of this card</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <DialogContentText>
            Anyone with the link gets their own copy of this card as it is now. Later edits you
            make will not change their copy.
          </DialogContentText>

          {/*
            Stated plainly and not only in the spec: this is the one thing
            about share links that will surprise people.
          */}
          <Alert severity="info">
            Revoking a link stops anyone new from opening it. It cannot take back a copy someone
            has already made.
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}

          <Button variant="contained" onClick={() => void handleCreate()} disabled={busy}>
            Create a share link
          </Button>

          {shares.length > 0 && (
            <>
              <Typography variant="subtitle2">Active links</Typography>
              <List dense disablePadding>
                {shares.map((share) => (
                  <ListItem key={share.token} disableGutters sx={{ gap: 1 }}>
                    <TextField
                      value={shareUrl(share.token)}
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { readOnly: true } }}
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      size="small"
                      onClick={() => {
                        navigator.clipboard?.writeText(shareUrl(share.token)).catch(() => {
                          // Clipboard access can fail; the field above is
                          // selectable as the fallback.
                        });
                      }}
                    >
                      Copy
                    </Button>
                    <IconButton
                      aria-label="Revoke this link"
                      onClick={() => void handleRevoke(share.token)}
                      disabled={busy}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
