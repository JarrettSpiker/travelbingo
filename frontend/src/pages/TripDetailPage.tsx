import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import {
  Activity,
  CalendarDays,
  Copy,
  Download,
  LayoutGrid,
  Link2,
  Lock,
  Pencil,
  Plus,
  Target,
  Trash2,
  TriangleAlert,
  UserMinus,
  Users,
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { AuthMenu } from "@/components/AuthMenu";
import { ActivityFeed } from "@/components/ActivityFeed";
import { CardGrid } from "@/components/CardGrid";
import { CardWinStatus } from "@/components/CardWinStatus";
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
import { useNotifications } from "@/notifications/notificationsContext";
import { listCards } from "@/lib/cardsApi";
import type { SavedCardSummary } from "@/lib/savedCard";
import { cardFromSlots } from "@/lib/bingo";
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
import { downloadCardPng } from "@/lib/cardPngExport";
import { getTripActivity } from "@/lib/notificationApi";
import type { TripActivityEvent } from "@/lib/notificationTypes";
import { playWindowState } from "@/lib/playWindow";
import {
  WIN_CONDITION_LABELS,
  DEFAULT_WIN_CONDITION,
  hasWon,
  markableSlots,
  squaresFromWin,
} from "@/lib/winCondition";
import { markedSlotsFor, useTripProgress } from "@/hooks/useTripProgress";
import { formatTripDate, formatTripRange, formatTripTimestamp } from "@/lib/tripDates";
import type { TripCard, TripDetail, TripMember } from "@/lib/tripTypes";
import { ROUTES } from "@/lib/routes";
import { brand } from "@/brand";

/* Capitalized so JSX reads it as a component; a build-time constant. */
const TripIcon = brand.TripIcon;

/** The detail page names specific days, so unlike the list it carries the year. */
const DATE_FORMAT: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };

/**
 * A label that identifies a member, never a raw user id.
 *
 * Both `displayName` and `email` are optional — a profile has no display name
 * until its owner visits Settings — so the fallback has to stay *distinct* per
 * member rather than reading "Unknown member" for everyone. Two identical rows
 * each with a Remove button, or two identical entries in the assign dropdown,
 * leave the admin no way to tell who they are acting on.
 *
 * The disambiguator is the member's position in the trip's roster, which the
 * server returns in join order. A slice of the user id would also be unique,
 * but ids are opaque only in production — anywhere they carry a readable
 * suffix, "Member arol" reads as a corrupted name rather than a placeholder.
 */
function memberLabel(
  member: TripMember,
  index: number,
  currentUserId: string | null,
  email: string | null,
  displayName: string | null,
): string {
  // For the caller, their own auth-cached name/email is the freshest source.
  if (member.userId === currentUserId) {
    return member.displayName ?? displayName ?? member.email ?? email ?? `Member ${index + 1}`;
  }
  return member.displayName ?? member.email ?? `Member ${index + 1}`;
}

/** A member's display label looked up by id, or null when they are no longer in the trip. */
function memberLabelById(
  trip: TripDetail,
  userId: string | undefined,
  currentUserId: string | null,
  email: string | null,
  displayName: string | null,
): string | null {
  if (!userId) return null;
  const index = trip.members.findIndex((m) => m.userId === userId);
  if (index === -1) return null;
  return memberLabel(trip.members[index]!, index, currentUserId, email, displayName);
}

/**
 * The label for a card's assignee. "Unassigned" when nobody holds the card;
 * "Unknown member" only when the assignment points at someone no longer in the
 * member list, which is the one genuinely unresolvable case.
 */
function assigneeLabel(
  trip: TripDetail,
  assignedMemberId: string | undefined,
  currentUserId: string | null,
  email: string | null,
  displayName: string | null,
): string {
  if (!assignedMemberId) return "Unassigned";
  return (
    memberLabelById(trip, assignedMemberId, currentUserId, email, displayName) ?? "Unknown member"
  );
}

export function TripDetailPage() {
  const { tripId = "" } = useParams();
  const location = useLocation();
  const { api, status, accountsEnabled, email, displayName, userId: currentUserId } = useAuth();
  const { setUnread } = useNotifications();
  const navigate = useNavigate();

  const [trip, setTrip] = useState<TripDetail | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  /** The tripCardId currently being assigned, so that card alone shows a spinner. */
  const [assigningId, setAssigningId] = useState<string | null>(null);
  /**
   * Cards whose completed target the viewer has just been told about — the
   * celebration follows their own completing mark, and each is dismissed
   * individually.
   */
  const [celebrations, setCelebrations] = useState<ReadonlySet<string>>(new Set());
  /** The trip's activity feed, most-recent-first. Null = loading, false = failed. */
  const [activity, setActivity] = useState<TripActivityEvent[] | null | false>(null);

  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);

  // Add-card dialog state.
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [library, setLibrary] = useState<SavedCardSummary[] | null>(null);
  /** CardIds whose thumbnail failed to load, so a placeholder is shown instead. */
  const [failedThumbs, setFailedThumbs] = useState<Set<string>>(new Set());

  const isAdmin = trip?.role === "admin";
  const isCompetitive = trip?.mode === "competitive";

  const {
    progress,
    error: progressError,
    clearError: clearProgressError,
    toggle,
  } = useTripProgress(
    api,
    tripId,
    trip?.cards,
    accountsEnabled && status === "authenticated",
    // The poll response carries the bell's unread count; the header refreshes
    // on this interval instead of running a timer of its own.
    setUnread,
  );

  /**
   * Each rendered card's `.bingo-card` node, so an export can hand the right one
   * to `downloadCardPng`. A map rather than a ref per card because the number of
   * cards is data, and hooks are not.
   */
  const cardNodes = useRef(new Map<string, HTMLDivElement | null>());

  /**
   * Which side of the trip's dates today falls on, or null while it is running.
   * Evaluated with the same rule the server enforces (`lib/playWindow.ts`), but
   * only to disable controls and explain why — the server re-decides every mark.
   */
  const windowState = trip ? playWindowState(trip, new Date()) : null;

  /**
   * Whether the viewer may change this card's marks. Cooperative trips are
   * played by every member; competitive ones only by the assignee, with no
   * administrator exemption — administering a trip is not playing its cards.
   */
  function canPlay(card: TripCard): boolean {
    if (!trip || windowState !== null) return false;
    return trip.mode === "cooperative" ? true : card.assignedMemberId === currentUserId;
  }

  /**
   * Why a visible card is read-only, when the reason is specific to that card.
   * The trip-wide reason — its dates — is stated once above the list rather than
   * repeated on all fifty cards.
   */
  function readOnlyReason(card: TripCard): string | null {
    if (!trip || windowState !== null || trip.mode !== "competitive") return null;
    if (!card.assignedMemberId) return "Unassigned — nobody can mark this card yet.";
    if (card.assignedMemberId !== currentUserId) return "Assigned to someone else. You can watch, but not mark.";
    return null;
  }

  /**
   * Toggles a square and, when the viewer's own *mark* completes the trip's
   * target, celebrates on that card. The winning evaluation runs on the
   * optimistic mark set the toggle is about to apply — the same pure function
   * the backend records the win with — and only celebrates when the server
   * accepted the mark.
   */
  async function handleToggleMark(card: TripCard, index: number) {
    if (!trip) return;
    const current = markedSlotsFor(progress, card.tripCardId);
    const marking = !current.has(index);
    const next = new Set(current);
    next.add(index);
    const completing = marking && hasWon(next, winCondition);

    const accepted = await toggle(card.tripCardId, index);
    if (accepted && completing) {
      setCelebrations((prev) => new Set(prev).add(card.tripCardId));
    }
    // The viewer's own mark is the one event they always learn about at once;
    // refresh the feed so it lands immediately.
    void loadActivity();
  }

  function dismissCelebration(tripCardId: string) {
    setCelebrations((prev) => {
      if (!prev.has(tripCardId)) return prev;
      const next = new Set(prev);
      next.delete(tripCardId);
      return next;
    });
  }

  async function handleExportPng(card: TripCard) {
    const node = cardNodes.current.get(card.tripCardId);
    if (!node) return;
    setError(null);
    try {
      await downloadCardPng(node, card.snapshot.title);
    } catch {
      setError("Sorry, the PNG could not be generated. Please try again.");
    }
  }

  const load = useCallback(async () => {
    try {
      setTrip(await getTrip(api, tripId));
      setError(null);
    } catch {
      setError(`Could not load this ${brand.copy.noun.trip}.`);
      setTrip(null);
    }
  }, [api, tripId]);

  // The activity feed loads with the trip and after any of the viewer's own
  // actions that change it (a mark, an assignment change). Other members'
  // events arrive on the next visit or when their own poll nudges a refresh —
  // the feed is pull, not push.
  const loadActivity = useCallback(async () => {
    try {
      setActivity(await getTripActivity(api, tripId));
    } catch {
      // Say the feed failed rather than "nothing has happened" — an empty
      // trip and a dead fetch are different truths.
      setActivity(false);
    }
  }, [api, tripId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    void load();
    void loadActivity();
  }, [status, load, loadActivity]);

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
        setFailedThumbs(new Set());
      } catch {
        setLibrary([]);
      }
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

  async function handleAddCard(cardId: string) {
    setBusy(true);
    setError(null);
    try {
      await addTripCard(api, tripId, cardId);
      setAddCardOpen(false);
      await load();
    } catch {
      setError(`Could not add that card to the ${brand.copy.noun.trip}.`);
    } finally {
      setBusy(false);
    }
  }

  async function handleAssign(card: TripCard, value: string) {
    // "unassigned" maps to no-op here; competitive reassignment clears via the
    // server only when a member is chosen. (Clearing on member removal is the
    // server's job; the admin picks a new member to reassign.)
    if (value === "unassigned" || value === card.assignedMemberId) return;
    // Scoped loading state: only this card shows a spinner while the assignment
    // round-trip is in flight, so the rest of the page stays interactive.
    setAssigningId(card.tripCardId);
    setError(null);
    try {
      await assignTripCard(api, tripId, card.tripCardId, value);
      await load();
    } catch {
      setError("Could not assign that card.");
    } finally {
      setAssigningId(null);
    }
  }

  if (!accountsEnabled || status === "anonymous") {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <TriangleAlert />
            <AlertDescription>Sign in to view this {brand.copy.noun.trip}.</AlertDescription>
          </Alert>
          <Button onClick={() => void navigate(ROUTES.trips)}>Back to {brand.copy.noun.trips}</Button>
        </div>
      </AppShell>
    );
  }

  if (status === "loading" || trip === undefined) {
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="flex justify-center py-12">
          <Spinner label={`Loading ${brand.copy.noun.trip}`} />
        </div>
      </AppShell>
    );
  }

  if (trip === null) {
    // Arriving from a notification that points at a trip the viewer can no
    // longer open — removed from it, or the trip is gone — reads as the trip
    // no longer being available, not as an error or a broken link.
    const fromNotification = (location.state as { fromNotification?: boolean } | null)?.fromNotification === true;
    return (
      <AppShell size="narrow" headerActions={<AuthMenu />}>
        <div className="grid justify-items-start gap-4">
          <Alert variant="info">
            <TriangleAlert />
            <AlertDescription>
              {fromNotification
                ? brand.copy.trips.noLongerAvailable
                : brand.copy.trips.notFoundOrNotMember}
            </AlertDescription>
          </Alert>
          <Button onClick={() => void navigate(ROUTES.trips)}>Back to {brand.copy.noun.trips}</Button>
        </div>
      </AppShell>
    );
  }

  // The wire always carries winCondition once the API change deploys; until
  // then a local bundle can be ahead of it, and "line" is the correct reading
  // of a trip the old API never stored one for.
  const winCondition = trip.winCondition ?? DEFAULT_WIN_CONDITION;

  const range = formatTripRange(trip.startDate, trip.endDate, DATE_FORMAT);

  return (
    <AppShell headerActions={<AuthMenu />}>
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h1 className="font-display text-2xl font-semibold">{trip.title || `Untitled ${brand.copy.noun.trip}`}</h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <Badge variant={isAdmin ? "default" : "secondary"}>
                <Users className="size-3" aria-hidden /> {isAdmin ? "Admin" : "Member"}
              </Badge>
              <Badge variant="outline">{trip.mode}</Badge>
              <Badge variant="outline">
                <Target className="size-3" aria-hidden /> {WIN_CONDITION_LABELS[winCondition]}
              </Badge>
              {range && (
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="size-3" aria-hidden /> {range}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => void navigate(ROUTES.trips)}>
              Back to {brand.copy.noun.trips}
            </Button>
            {isAdmin && (
              <>
                <Button variant="outline" onClick={() => void navigate(ROUTES.editTrip(tripId))}>
                  <Pencil aria-hidden /> Edit
                </Button>
                <Button
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    setConfirm({
                      title: `Delete this ${brand.copy.noun.trip}?`,
                      description: brand.copy.trips.deleteWarning,
                      action: async () => {
                        await deleteTrip(api, tripId);
                        navigate(ROUTES.trips, { replace: true });
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

        {progressError && (
          <Alert variant="destructive">
            <TriangleAlert />
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              <span>{progressError}</span>
              {/* A refused mark usually means the trip moved under the viewer —
                  reassigned, or its dates edited. Reloading is the action that
                  actually resolves it. */}
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  clearProgressError();
                  void load();
                }}
              >
                Reload
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {notice && (
          <Alert variant="info">
            <Copy />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}

        {/* Members */}
        <Panel title="Members" icon={Users}>
          <ul className="grid gap-2">
            {trip.members.map((member, index) => {
              const isSelf = member.userId === currentUserId;
              const name = memberLabel(member, index, currentUserId, email, displayName);
              return (
                <li
                  key={member.userId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 p-3"
                >
                  {/* `min-w-0` so a long email truncates instead of widening
                      the row past the panel and taking Remove off-screen. */}
                  <span className="grid min-w-0 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {name}
                      {isSelf && <span className="text-muted-foreground"> (you)</span>}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {member.role === "admin" ? "Administrator" : "Member"}
                    </span>
                  </span>
                  {isAdmin && member.role !== "admin" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      disabled={busy}
                      onClick={() =>
                        setConfirm({
                          title: "Remove this member?",
                          description: brand.copy.trips.removeMemberWarning,
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
        <Panel
          title="Cards"
          icon={TripIcon}
          actions={
            <Button variant="outline" size="sm" onClick={() => void handleOpenAddCard()} disabled={busy}>
              <Plus aria-hidden /> Add a card
            </Button>
          }
        >
          {/* The whole-trip reason a card is read-only, stated once rather than
              repeated on every card in the list. */}
          {windowState !== null && (
            <Alert variant="info" className="mb-4">
              <CalendarDays />
              <AlertDescription>
                {windowState === "before"
                  ? `This ${brand.copy.noun.trip} hasn't started yet, so its cards can't be marked. Marking opens on ${
                      trip.startDate ? formatTripDate(trip.startDate, DATE_FORMAT) : "the start date"
                    }.`
                  : brand.copy.trips.endedNotice}
              </AlertDescription>
            </Alert>
          )}

          {trip.cards.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cards yet. Add one from your library.</p>
          ) : (
            <ul className="grid gap-6 sm:grid-cols-2">
              {trip.cards.map((card) => {
                const bingoCard = cardFromSlots(card.snapshot.slots, {
                  hasFreeSpace: card.snapshot.hasFreeSpace,
                  freeSpaceText: card.snapshot.freeSpaceText,
                });
                const playable = canPlay(card);
                const reason = readOnlyReason(card);
                // Live distance from the current marks — optimistic ones
                // included — against the trip's target. A recorded win and
                // this number are two separate truths, shown side by side.
                const distance = squaresFromWin(
                  markedSlotsFor(progress, card.tripCardId),
                  markableSlots(card.snapshot),
                  winCondition,
                );
                return (
                  // `1fr auto`: a card with a title renders taller than one
                  // without, so without this the meta boxes in a row start and
                  // end at different heights and read as a rendering glitch.
                  // The preview takes the slack; the controls stay aligned.
                  <li key={card.tripCardId} className="grid grid-rows-[1fr_auto] gap-3">
                    <div className="mx-auto w-full max-w-sm">
                      <CardGrid
                        ref={(node) => {
                          cardNodes.current.set(card.tripCardId, node);
                        }}
                        card={bingoCard}
                        title={card.snapshot.title}
                        colorScheme={card.snapshot.colorScheme}
                        fontScheme={card.snapshot.fontScheme}
                        emojiScheme={card.snapshot.emojiScheme}
                        markedSlots={markedSlotsFor(progress, card.tripCardId)}
                        // Omitted entirely when the viewer may not mark: the
                        // cells then render exactly as they do for a card
                        // nobody is playing, with no affordance to mislead.
                        onToggleSlot={
                          playable ? (index) => void handleToggleMark(card, index) : undefined
                        }
                      />
                    </div>
                    <div className="grid gap-2 rounded-md border border-border bg-background/40 p-3 text-sm">
                      <span className="text-muted-foreground">
                        Added {formatTripTimestamp(card.createdAt, DATE_FORMAT)}
                      </span>
                      <CardWinStatus
                        distance={distance}
                        wonAt={card.wonAt}
                        winnerLabel={
                          memberLabelById(trip, card.winnerId, currentUserId, email, displayName) ??
                          undefined
                        }
                        formatTimestamp={(iso) => formatTripTimestamp(iso, DATE_FORMAT)}
                        celebration={
                          celebrations.has(card.tripCardId)
                            ? `Bingo! You completed ${WIN_CONDITION_LABELS[winCondition].toLowerCase()}.`
                            : null
                        }
                        onDismissCelebration={() => dismissCelebration(card.tripCardId)}
                      />
                      {reason && (
                        <span className="inline-flex items-start gap-1.5 text-muted-foreground">
                          <Lock className="mt-0.5 size-3 shrink-0" aria-hidden /> {reason}
                        </span>
                      )}
                      {isCompetitive && (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground">Assigned to</span>
                          {isAdmin && assigningId === card.tripCardId ? (
                            <Spinner label="Assigning" className="size-4" />
                          ) : isAdmin ? (
                            <Select
                              value={card.assignedMemberId ?? "unassigned"}
                              onValueChange={(value) => void handleAssign(card, value)}
                            >
                              <SelectTrigger size="sm" className="w-auto">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unassigned">Unassigned</SelectItem>
                                {trip.members.map((member, index) => (
                                  <SelectItem key={member.userId} value={member.userId}>
                                    {memberLabel(member, index, currentUserId, email, displayName)}
                                    {member.userId === currentUserId ? " (you)" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="secondary">
                              {assigneeLabel(trip, card.assignedMemberId, currentUserId, email, displayName)}
                            </Badge>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {/* Available to every member who can see the card, not
                            only the player: sharing a trip-mate's near-miss is
                            half the point. */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleExportPng(card)}
                        >
                          <Download aria-hidden /> PNG
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              setConfirm({
                                title: `Remove this card from the ${brand.copy.noun.trip}?`,
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

        {/* Activity: the "show everything" surface, for every member —
            including one who has muted the trip, whose bell stays quiet while
            this feed does not. */}
        <Panel title="Activity" icon={Activity}>
          {activity === null ? (
            <div className="flex justify-center py-4">
              <Spinner label="Loading activity" />
            </div>
          ) : activity === false ? (
            <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
              <span>Could not load this {brand.copy.noun.trip}&apos;s activity.</span>
              <Button variant="ghost" size="sm" onClick={() => void loadActivity()}>
                Retry
              </Button>
            </div>
          ) : (
            <ActivityFeed
              events={activity}
              formatTimestamp={(iso) => formatTripTimestamp(iso, DATE_FORMAT)}
            />
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
                    {/*
                      An invite URL has no break opportunities, so without
                      `min-w-0` + `truncate` its min-content width becomes a
                      floor that propagates out through the panel to the page
                      grid — widening every panel and pushing Copy and Revoke,
                      the only way to share or kill a link, off a 390px screen.
                      Nothing is lost to truncation: Copy carries the full URL.
                    */}
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-mono text-xs">{inviteUrl(invite.token)}</span>
                      <span className="text-xs text-muted-foreground">
                        Created {formatTripTimestamp(invite.createdAt, DATE_FORMAT)}
                      </span>
                    </span>
                    <div className="flex shrink-0 gap-1">
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
            <DialogTitle>Add a card to the {brand.copy.noun.trip}</DialogTitle>
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
            <ul className="max-h-96 overflow-auto grid gap-1">
              {library.map((card) => {
                const showThumb = Boolean(card.thumbnailUrl) && !failedThumbs.has(card.cardId);
                return (
                  <li key={card.cardId}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleAddCard(card.cardId)}
                      className="flex w-full items-center gap-3 rounded-md border border-transparent p-2 text-left transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
                    >
                      {showThumb && card.thumbnailUrl ? (
                        <img
                          src={card.thumbnailUrl}
                          alt=""
                          loading="lazy"
                          onError={() => markThumbFailed(card.cardId)}
                          className="size-14 shrink-0 rounded-md border border-border bg-muted object-contain"
                        />
                      ) : (
                        <span
                          className="flex size-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted"
                          aria-hidden="true"
                        >
                          <LayoutGrid className="size-6 text-muted-foreground/50" />
                        </span>
                      )}
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate text-sm font-medium">{card.title || "Untitled card"}</span>
                        <span className="text-xs text-muted-foreground">
                          Updated {formatTripTimestamp(card.updatedAt, DATE_FORMAT)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
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
