import { useState } from "react";
import { useNavigate } from "react-router";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useAuth } from "../auth/authContext";

interface AuthMenuProps {
  /** Saves the card currently in the editor. Resolves to a status message. */
  onSaveCard: () => Promise<string>;
}

/**
 * Sign-in state and the save action.
 *
 * Renders nothing at all when accounts are not configured for this build, so a
 * local checkout with no .env.local shows the editor exactly as it was before
 * this change.
 */
export function AuthMenu({ onSaveCard }: AuthMenuProps) {
  const { status, email, accountsEnabled, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!accountsEnabled) return null;

  function close() {
    setAnchorEl(null);
  }

  async function handleSave() {
    close();
    setSaving(true);
    setMessage(null);
    try {
      setMessage(await onSaveCard());
    } finally {
      setSaving(false);
    }
  }

  // "loading" is a transient state for a returning visitor. Showing the
  // signed-out affordance meanwhile is honest and never blocks the page.
  if (status !== "authenticated") {
    return (
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Button size="small" variant="text" onClick={() => signIn()} disabled={status === "loading"}>
          Sign in
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
      <Button size="small" variant="outlined" onClick={() => void handleSave()} disabled={saving}>
        {saving ? "Saving…" : "Save card"}
      </Button>
      <Button size="small" variant="text" onClick={(event) => setAnchorEl(event.currentTarget)}>
        {email ?? "Account"}
      </Button>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={close}>
        <MenuItem
          onClick={() => {
            close();
            void navigate("/cards");
          }}
        >
          My saved cards
        </MenuItem>
        <Divider />
        <MenuItem
          onClick={() => {
            close();
            signOut();
          }}
        >
          Sign out
        </MenuItem>
      </Menu>
    </Stack>
  );
}
