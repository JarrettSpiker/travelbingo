import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  CalendarDays,
  Compass,
  Copy,
  Link2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { CardGrid } from "@/components/CardGrid";
import { Panel } from "@/components/Panel";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/auth/authContext";
import { createCard, listCards } from "@/lib/cardsApi";
import type { SavedCardSummary } from "@/lib/savedCard";
import { cardFromSlots } from "@/lib/bingo";
import type { CardUrlData } from "@/lib/cardData";
import {
  addTripCard,
  assignTripCard,
  createInvite,
  deleteTrip,
  getTrip,
  inviteUrl,
  removeMember,
  removeTripCard,
  revokeInvite,
} from "@/lib/tripApi";
import type { TripCard, TripDetail } from "@/lib/tripTypes";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRange(startDate?: string, endDate?: string): string | null {
  if (!startDate && !endDate) return null;
  const fmt = (iso?: string) => (iso ? formatDate(iso) : "…");
  return `${fmt(startDate)} – ${fmt(endDate)}`;
}

/** Builds an editable card from a frozen snapshot, deriving the entry pool from the grid. */
function snapshotToCardData(card: TripCard): CardUrlData {
  const s = card.snapshot;
  return {
    slots: s.slots,
    title: s.title,
    hasFreeSpace: s.hasFreeSpace,
    freeSpaceText: s.freeSpaceText,
    colorScheme: s.colorScheme,
    fontScheme: s.fontScheme,
    emojiScheme: s.emojiScheme,
  };
}

export function TripDetailPage() {
  const { tripId = "" } = useParams();
  const { api, status, accountsEnabled } = useAuth();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<TripDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Add-card dialog state.
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [library, setLibrary] = useState<SavedCardSummary[] | null>(null);

  const isAdmin = trip?.role === "admin";
  const isCompetitive = trip?.mode === "competitive";

  const load = useCallback(async () => {
    try {
      setTrip(await getTrip(api, tripId));
      setError(null);
    } catch {
      setError("Could not load this trip.");
      setTrip(null);
    }
  }, [api, tripId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void load();
  }, [status, load]);

  async function run(action: () => Promise<void>, failureMessage: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch {
      setError(failureMessage);
    } finally {
      setBusy(false);
    }
  }

  // The admin-only invite panel needs the latest invite list; getTrip returns
  // invites only for the admin, so this is non-empty only then.
  const invites = trip?.invites ?? [];

  async function handleMintInvite() {
    setBusy(true);
    setError(null);
    try {
      await createInvite(api, tripId);
      await load();
      setNotice("Invite link created. Copy it from the list to share.");
    } catch {
      setError("Could not create an invite link.");
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenAddCard() {
    setAddCardOpen(true);
    if (library === null) {
      try {
        setLibrary(await listCards(api));
      } catch {
        setLibrary([]);
      }
    }
  }

  async function handleAddCard(cardId: string) {
    setBusy(true);
    setError(null);
    try {
      await addTripCard(api, tripId, cardId);
      setAddCardOpen(false);
      await load();
    } catch {
      setError("Could not add that card to the trip.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyToLibrary(card: TripCard) {
    setBusy(true);
    setError(null);
    try {
      await createCard(api, snapshotToCardData(card));
      setCopiedCardId(card.tripCardId);
      setNotice("Copied to your cards.");
    } catch {
      setError("Could not copy that card to your library.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(card: TripCard, value: string) {
    // "unassigned" maps to no-op here; competitive reassignment clears via the
    // server only when a member is chosen. (Clearing on member removal is the
    // server's job; the admin picks a new member to reassign.)
    if (value === "unassigned" || value === card.assignedMemberId) return;
    await run(() => assignTripCard(api, tripId, card.tripCardId, value), "Could not assign that card.");
  }

  if (!accountsEnabled || status === "anonymous") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <TriangleAlert />
            <AlertDescription>Sign in to view this trip.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate("/trips")}>Back to trips</Button>
        </div>
      </AppShell>
    );
  }

  if (status === "loading" || trip === undefined) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label="Loading trip" />
        </div>
      </AppShell>
    );
  }

  if (trip === null) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>This trip could not be found, or you are not a member.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate("/trips")}>Back to trips</Button>
        </div>
      </AppShell>
    );
  }

  const range = formatRange(trip.startDate, trip.endDate);

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-2xl font-semibold">{trip.title || "Untitled trip"}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                <Users className="size-3" aria-hidden /> {isAdmin ? "Admin" : "Member"}
              </Badge>
              <Badge variant="outline">{trip.mode}</Badge>
              {range && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden /> {range}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void navigate("/trips")}>
              Back to trips
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => void navigate(`/trips/${tripId}/edit`)}>
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      title: "Delete this trip?",
                      description:
                        "The trip, its members, its cards, and its invite links will all be removed. This cannot be undone.",
                      action: async () => {
                        await deleteTrip(api, tripId);
                        navigate("/trips", { replace: true });
                      },
                    })
                  }
                >
                  <Trash2 aria-hidden /> Delete
                </Button>
              </>
            )}
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant="info">
            <Copy />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {/* Members */}
        <Panel
          title="Members"
          icon={Users}
          actions={
            <Button variant="outline" size="sm" onClick={() => void handleOpenAddCard()} disabled={busy}>
              <Plus aria-hidden /> Add a card
            </Button>
          }
        >
          <ul className="grid gap-2">
            {trip.members.map((member) => {
              // Memberships carry only user ids — no display name — so a member
              // is shown by role plus a short id. The admin's is identifiable by
              // role; everyone else by their id.
              return (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
                >
                  <span className="grid gap-0.5">
                    <span className="text-sm font-medium">
                      {member.role === "admin" ? "Administrator" : "Member"}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{member.userId}</span>
                  </span>
                  {isAdmin && member.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: "Remove this member?",
                          description: "They will immediately lose access to the trip and its cards. Any cards they added stay.",
                          action: () => removeMember(api, tripId, member.userId),
                        })
                      }
                    >
                      <UserMinus aria-hidden /> Remove
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Cards */}
        <Panel title="Cards" icon={Compass}>
          {trip.cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet. Add one from your library.</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {trip.cards.map((card) => {
                const bingoCard = cardFromSlots(card.snapshot.slots, {
                  hasFreeSpace: card.snapshot.hasFreeSpace,
                  freeSpaceText: card.snapshot.freeSpaceText,
                });
                return (
                  <li key={card.tripCardId} className="grid gap-3">
                    <div className="mx-auto w-full max-w-sm">
                      <CardGrid
                        card={bingoCard}
                        title={card.snapshot.title}
                        colorScheme={card.snapshot.colorScheme}
                        fontScheme={card.snapshot.fontScheme}
                        emojiScheme={card.snapshot.emojiScheme}
                      />
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-background/40 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Added {formatDate(card.createdAt)}
                      </span>
                      {isCompetitive && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Assigned to</span>
                          {isAdmin ? (
                            <Select
                              value={card.assignedMemberId ?? "unassigned"}
                              onValueChange={(value) => void handleAssign(card, value)}
                            >
                              <SelectTrigger size="sm" className="w-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {trip.members.map((member) => (
                                  <SelectItem key={member.userId} value={member.userId}>
                                    {member.role === "admin" ? "Admin" : "Member"} · {member.userId}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">
                              {card.assignedMemberId ? card.assignedMemberId : "Unassigned"}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void handleCopyToLibrary(card)}
                        >
                          {copiedCardId === card.tripCardId ? "Copied" : "Copy to my cards"}
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                title: "Remove this card from the trip?",
                                description: "The original card in its owner's library is not affected.",
                                action: () => removeTripCard(api, tripId, card.tripCardId),
                              })
                            }
                          >
                            <Trash2 aria-hidden /> Remove
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        {/* Admin: invites */}
        {isAdmin && (
          <Panel
            title="Invite links"
            icon={Link2}
            actions={
              <Button variant="outline" size="sm" onClick={() => void handleMintInvite()} disabled={busy}>
                <Plus aria-hidden /> New invite
              </Button>
            }
          >
            {invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Mint a link to invite friends. Anyone who redeems it joins as a member.
              </p>
            ) : (
              <ul className="grid gap-2">
                {invites.map((invite) => (
                  <li
                    key={invite.token}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
                  >
                    <span className="grid gap-0.5">
                      <span className="font-mono text-xs">{inviteUrl(invite.token)}</span>
                      <span className="text-xs text-muted-foreground">Created {formatDate(invite.createdAt)}</span>
                    </span>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          void navigator.clipboard?.writeText(inviteUrl(invite.token));
                          setNotice("Invite link copied to clipboard.");
                        }}
                      >
                        <Copy aria-hidden /> Copy
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        onClick={() =>
                          setConfirm({
                            title: "Revoke this invite?",
                            description: "Anyone holding the link will no longer be able to join.",
                            action: () => revokeInvite(api, tripId, invite.token),
                          })
                        }
                      >
                        <Trash2 aria-hidden /> Revoke
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      {/* Generic confirmation dialog for destructive admin actions. */}
      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm?.title}</DialogTitle>
            <DialogDescription>{confirm?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={async () => {
                if (!confirm) return;
                const action = confirm.action;
                setConfirm(null);
                await run(action, "That action could not be completed.");
              }}
            >
              {busy ? "Working…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add-card-from-library picker. */}
      <Dialog open={addCardOpen} onOpenChange={setAddCardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a card to the trip</DialogTitle>
            <DialogDescription>
              A frozen snapshot of the card is added. Editing your original later won't change it.
            </DialogDescription>
          </DialogHeader>
          {library === null ? (
            <Spinner label="Loading your cards" />
          ) : library.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You have no saved cards. Build one in the editor first.
            </p>
          ) : (
            <ul className="max-h-80 overflow-auto grid gap-1">
              {library.map((card) => (
                <li key={card.cardId}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleAddCard(card.cardId)}
                    className="grid w-full gap-0.5 rounded-md border border-transparent p-3 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                  >
                    <span className="text-sm font-medium">{card.title || "Untitled card"}</span>
                    <span className="text-xs text-muted-foreground">
                      Updated {formatDate(card.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAddCardOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
