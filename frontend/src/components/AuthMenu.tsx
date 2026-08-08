import { useState } from "react";
import { useNavigate } from "react-router";
import { ChevronDown, Save, UserRound } from "lucide-react";
import { useAuth } from "@/auth/authContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AuthMenuProps {
  /**
   * Saves the card currently in the editor. Resolves to a status message.
   *
   * Optional because this lives in the shell's header on every page, and only
   * the editor has a card to save. Omitting it drops the save action and leaves
   * the account menu, so sign-in state is visible app-wide.
   */
  onSaveCard?: () => Promise<string>;
}

/**
 * Sign-in state and the save action.
 *
 * Renders nothing at all when accounts are not configured for this build, so a
 * local checkout with no .env.local shows the editor exactly as it was before
 * accounts existed.
 */
export function AuthMenu({ onSaveCard }: AuthMenuProps) {
  const { status, email, displayName, accountsEnabled, signIn, signOut } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!accountsEnabled) return null;

  async function handleSave() {
    if (!onSaveCard) return;
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
      <Button variant="ghost" size="sm" onClick={() => signIn()} disabled={status === "loading"}>
        Sign in
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {message && (
        <span className="hidden text-sm text-muted-foreground sm:inline" role="status">
          {message}
        </span>
      )}
      {/*
        Icon-only below `sm` for the same reason as the account name: the
        editor is the one route carrying this button *and* three nav links, and
        with both spelled out the row cannot fit 390px. The nav can scroll, but
        a link clipped mid-word reads as breakage rather than as an affordance.
      */}
      {onSaveCard && (
        <Button variant="outline" size="sm" onClick={() => void handleSave()} disabled={saving}>
          <Save aria-hidden className="sm:hidden" />
          <span className="hidden sm:inline">{saving ? "Saving…" : "Save card"}</span>
          <span className="sr-only sm:hidden">{saving ? "Saving card" : "Save card"}</span>
        </Button>
      )}
      {/*
        `anchorEl` state is gone: Radix's trigger is the anchor, so the open
        state lives inside the menu rather than in this component.
      */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {/*
            Below `sm` the name is an icon: an email at `max-w-40` costs 160px
            of a 390px header that also carries three nav links, and it is the
            one thing in the row that can be dropped without losing a
            destination. The name stays in the accessible name either way.
          */}
          <Button variant="ghost" size="sm" className="max-w-40">
            <UserRound aria-hidden className="sm:hidden" />
            <span className="hidden truncate sm:inline">{displayName ?? email ?? "Account"}</span>
            <span className="sr-only sm:hidden">{displayName ?? email ?? "Account"}</span>
            {/* The chevron is pure decoration next to an icon-only trigger. */}
            <ChevronDown aria-hidden className="hidden sm:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void navigate("/cards")}>
            My saved cards
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void navigate("/settings")}>Settings</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
