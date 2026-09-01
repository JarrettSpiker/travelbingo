import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import {
  EllipsisVertical,
  Info,
  LayoutGrid,
  Pencil,
  Share2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { ShareLinkDialog } from "@/components/ShareLinkDialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { deleteCard, getCard, listCards, renameCard } from "@/lib/cardsApi";
import { editorPathWithCard } from "@/lib/cardParam";
import type { SavedCardSummary } from "@/lib/savedCard";
import { ROUTES } from "@/lib/routes";

export function SavedCardsPage() {
  const { api, status, signIn, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [cards, setCards] = useState<SavedCardSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ cardId: string; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  /** The card whose share-link dialog is open. */
  const [shareCardId, setShareCardId] = useState<string | null>(null);
  /** CardIds whose thumbnail failed to load, so a placeholder is shown instead. */
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      setCards(await listCards(api));
      setError(null);
      setFailedThumbs(new Set());
    } catch {
      setError("Could not load your saved cards.");
      setCards([]);
    }
  }, [api]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void load();
  }, [status, load]);

  async function handleOpen(cardId: string) {
    setBusy(true);
    try {
      const card = await getCard(api, cardId);
      if (!card) {
        setError("That card could not be opened.");
        return;
      }
      // Handed to the editor through navigation state for an instant first
      // paint; the id is also in the URL (?card=<id>) so a reload, back/forward,
      // or bookmark can restore the same card without the in-memory state.
      void navigate(editorPathWithCard(cardId), { state: { card, cardId } });
    } catch {
      setError("That card could not be opened.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renaming) return;
    setBusy(true);
    try {
      await renameCard(api, renaming.cardId, renaming.title);
      setRenaming(null);
      await load();
    } catch {
      setError("Could not rename that card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(cardId: string) {
    setBusy(true);
    try {
      await deleteCard(api, cardId);
      await load();
    } catch {
      setError("Could not delete that card.");
    } finally {
      setBusy(false);
    }
  }

  function markThumbFailed(cardId: string) {
    setFailedThumbs((prev) => {
      if (prev.has(cardId)) return prev;
      const next = new Set(prev);
      next.add(cardId);
      return next;
    });
  }

  if (!accountsEnabled) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <Info />
            <AlertDescription>Accounts are not enabled in this build.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate(ROUTES.editor)}>Back to the card editor</Button>
        </div>
      </AppShell>
    );
  }

  if (status === "loading") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label="Loading your cards" />
        </div>
      </AppShell>
    );
  }

  if (status === "anonymous") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <h1 className="font-display text-2xl font-semibold">Saved cards</h1>
          <p className="text-sm text-muted-foreground">Sign in to see the cards you have saved.</p>
          <div className="flex gap-2">
            <Button onClick={() => signIn(ROUTES.cards)}>Sign in</Button>
            <Button variant="ghost" onClick={() => void navigate(ROUTES.editor)}>
              Back to the card editor
            </Button>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        <div className="flex items-center justify-between gap-2">
          <h1 className="font-display text-2xl font-semibold">Saved cards</h1>
          <Button variant="ghost" onClick={() => void navigate(ROUTES.editor)}>
            Back to the editor
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {cards === null && (
          <div className="flex justify-center py-12">
            <Spinner label="Loading your cards" />
          </div>
        )}

        {cards?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            You have not saved any cards yet. Build one in the editor and choose “Save card”.
          </p>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards?.map((card) => {
            const isRenaming = renaming?.cardId === card.cardId;
            const showThumb = Boolean(card.thumbnailUrl) && !failedThumbs.has(card.cardId);

            return (
              <li
                key={card.cardId}
                className="relative overflow-hidden rounded-lg border border-border bg-card shadow-raised transition-transform focus-within:-translate-y-0.5 hover:-translate-y-0.5"
              >
                {/*
                  ONE click target, not two. This used to be a CardActionArea
                  over the thumbnail plus a role="button" div over the title,
                  both calling handleOpen — overlapping targets, two tab stops,
                  and a hand-rolled keyboard handler for what a <button> does for
                  free. The menu trigger below is a sibling, never a child, so
                  opening a card and opening its menu can never both fire.
                */}
                <button
                  type="button"
                  onClick={() => void handleOpen(card.cardId)}
                  disabled={busy}
                  className="block w-full cursor-pointer text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:cursor-default"
                >
                  {showThumb && card.thumbnailUrl ? (
                    <img
                      src={card.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      onError={() => markThumbFailed(card.cardId)}
                      className="block h-44 w-full bg-muted object-contain"
                    />
                  ) : (
                    <div
                      className="flex h-44 items-center justify-center bg-muted"
                      aria-hidden="true"
                    >
                      <LayoutGrid className="size-12 text-muted-foreground/50" />
                    </div>
                  )}
                  {!isRenaming && (
                    <span className="block border-t border-border p-3">
                      <span className="block truncate text-sm font-medium">
                        {card.title || "Untitled card"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {new Date(card.updatedAt).toLocaleString()}
                      </span>
                    </span>
                  )}
                </button>

                {isRenaming && (
                  <div className="flex items-center gap-2 border-t border-border p-3">
                    <Input
                      autoFocus
                      aria-label={`Rename ${card.title || "Untitled card"}`}
                      value={renaming.title}
                      onChange={(event) => setRenaming({ ...renaming, title: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") void handleRename();
                        if (event.key === "Escape") setRenaming(null);
                      }}
                    />
                    <Button size="sm" onClick={() => void handleRename()} disabled={busy}>
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRenaming(null)}>
                      Cancel
                    </Button>
                  </div>
                )}

                {/*
                  Per-card trigger, so the `{cardId, anchor}` state the MUI Menu
                  needed collapses into nothing — each menu already knows which
                  card it belongs to.
                */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon-sm"
                      aria-label={`Actions for ${card.title || "Untitled card"}`}
                      disabled={busy}
                      className="absolute top-2 right-2 shadow-raised"
                    >
                      <EllipsisVertical aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuItem
                      onSelect={() => setRenaming({ cardId: card.cardId, title: card.title })}
                    >
                      <Pencil aria-hidden />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setShareCardId(card.cardId)}>
                      <Share2 aria-hidden />
                      Manage share links
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => void handleDelete(card.cardId)}
                    >
                      <Trash2 aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      </div>

      {/* The card is already saved here, so onSaveFirst is unreachable: the
          dialog's create path uses cardId directly. The prop is still required,
          so it returns the id it was given. */}
      {accountsEnabled && (
        <ShareLinkDialog
          open={shareCardId !== null}
          onClose={() => setShareCardId(null)}
          cardId={shareCardId}
          onSaveFirst={async () => shareCardId}
        />
      )}
    </AppShell>
  );
}
