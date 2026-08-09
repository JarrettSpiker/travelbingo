## Context

The account backend is one DynamoDB table where every entity is a `(PK, SK)` pair, every read and write is authorized by a single routine in `backend/src/auth.ts`, and there are no migrations by design — new entity types are new key prefixes, new fields are read schema-on-read. `add-trips` established the trip half of that model:

- `backend/src/lib/keys.ts` owns the key format. A trip card is `TRIP#<tripId>` / `TRIPCARD#<id>` carrying `snapshot{}`, `ownerId`, `assignedMemberId?`, `createdAt`.
- `backend/src/auth.ts` holds `requireCardRole` and `requireTripRole` as deliberate siblings — the add-trips design rejected generalizing them, on the grounds that routing the frozen card path through a new abstraction risks it for no real savings.
- `backend/src/routes/trips.ts:277` (`getTrip`) already pages the entire `TRIP#<tripId>` partition and returns members, cards, and (for admins) invites from that one query.
- `frontend/src/components/CardGrid.tsx` plus the `.bingo-*` rules in the unlayered `frontend/src/App.css` are the frozen renderer, guarded by `frontend/src/components/cardGrid.guard.test.ts` and documented in `frontend/DESIGN.md`.
- `frontend/src/components/CardView.tsx:56-74` holds the only PNG export implementation, using `html-to-image`'s `toPng` on the `.bingo-card` node and `buildImageFilename` from `frontend/src/lib/imageExport.ts`.

The add-trips design's open questions listed gameplay transport — polling, WebSocket, or SSE — as deferrable precisely because "this change's schema (`tripCardId` as the stable progress anchor, assignment per card) is transport-agnostic." This change picks polling and explains why.

See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals**
- Add per-square marked state to a trip card as a new attribute on the **existing** trip-card item — no new key prefix, no new table, no GSI, no migration.
- Authorize marking through one new routine in `auth.ts`, a third sibling of the two that exist, preserving the 404-on-missing / 403-on-insufficient non-leak rule exactly.
- Enforce the trip's date window on the server, from a pure function that the frontend also uses for its own explanation.
- Render the mark **inside** the frozen renderer so screen, print, PNG, and thumbnail agree — and update the guard, the design document, and the export checklist as part of the same change.
- Make one member's progress visible to the others while the trip page is open, without adding infrastructure.

**Non-Goals**
- Win conditions, near-win detection, or winner recording — `add-win-conditions`.
- Notifications of any kind — `add-play-notifications` and `add-email-notifications`.
- Real-time push. Progress refresh is polling; no WebSocket API enters Terraform in this change.
- Per-member private progress in a cooperative trip. Cooperative means one shared state per card.
- An audit trail of who marked which square. The event log that would carry that arrives with notifications.
- Progress on a saved card outside a trip. Cards in the library remain account-free documents with no play state.
- Any change to `TripCardSnapshot`, the saved-card shape, or the two contract tests.

## Decisions

### Decision: Marks are a number set on the existing trip-card item

`TRIP#<tripId>` / `TRIPCARD#<id>` gains two attributes:

```
TRIP#<tripId>   TRIPCARD#<id>   snapshot{}, ownerId, assignedMemberId?, createdAt,
                                markedSlots: Set<Number>,   <- marked square indices
                                progressUpdatedAt: string   <- ISO, for polling and display
```

`markedSlots` is a DynamoDB **number set**, updated with `ADD markedSlots :one` to mark and `DELETE markedSlots :one` to unmark. That makes each toggle an atomic, commutative operation on a single attribute: in a cooperative trip, two members marking two different squares in the same second cannot lose each other's write, with no read-modify-write cycle, no version attribute, and no conditional-update retry loop. `progressUpdatedAt` is set in the same `UpdateCommand`.

Because `getTrip` already pages the whole trip partition, progress arrives with the trip detail at no additional read cost.

**Set semantics to encode explicitly:** a DynamoDB set cannot be empty. Unmarking the last square removes the attribute entirely, so an absent `markedSlots` and an empty set are the same state — "nothing marked" — and every reader must treat them identically. The API always serializes it as a JSON array, sorted ascending, so the wire shape has no such wrinkle.

**Alternative considered:** a separate `PROGRESS#<tripCardId>` item, keeping the snapshot item immutable. Rejected — the snapshot attribute is never rewritten under either design, so there is no isolation to gain, and a second item doubles the write path, the cascade-delete surface, and the number of items `getTrip` pages through. **Also considered:** a 25-element boolean list with `SET markedSlots[i] = :v`. Rejected — it is equally atomic per index but requires the list to be initialized at add time, which would mean touching every trip card that already exists.

### Decision: A third authorization sibling, `requireTripCardPlayer`

AGENTS.md is explicit: all authorization happens in `backend/src/auth.ts`, and no route writes its own permission check. Marking needs a rule neither existing routine expresses, so it gets a third sibling rather than a per-endpoint check:

```ts
requireTripCardPlayer(deps, userId, tripId, tripCardId): Promise<TripCardPlayer>
```

It calls `requireTripRole(deps, userId, tripId, ADMIN_OR_MEMBER)` first — inheriting the trip-level non-leak rule unchanged — then reads the trip `META` and the trip-card item, and applies:

| Trip mode | Rule |
|---|---|
| `cooperative` | Any member may mark. Assignment does not exist in this mode. |
| `competitive`, card assigned | Only the member in `assignedMemberId` may mark. |
| `competitive`, card unassigned | Nobody may mark, including the administrator. |

A trip-card item that does not exist is a **404**, matching the sibling rule that absence and inaccessibility are indistinguishable — a caller who is a member of the trip already knows the trip exists, but must not be able to probe which `tripCardId` values are real. A caller who holds trip membership but is not this card's player is a **403**, which reveals only that the card exists in a trip they are already in.

**Administrator is deliberately not privileged here.** An admin can assign, reassign, and remove cards, but marking is playing, and playing someone else's card is not an administrative act. Making the admin a universal player would also make the competitive-mode rule untestable in practice, since the admin is a member of every trip they run.

**Alternative considered:** folding the rule into `requireTripRole` with an extra parameter. Rejected — `requireTripRole` is called by a dozen handlers that have nothing to do with cards, and widening its signature would push a card lookup into all of them.

### Decision: The play window is a pure function, evaluated generously in UTC, enforced on the server

Trip dates are plain calendar dates (`^\d{4}-\d{2}-\d{2}$`, validated in `backend/src/lib/tripPayload.ts`) with no timezone, which is the right storage choice — "the trip runs the 3rd to the 10th" is a fact about a calendar, not about an instant. But marking happens at an instant, so the two have to be reconciled somewhere.

New `backend/src/lib/playWindow.ts`:

```ts
export function isWithinPlayWindow(
  trip: { startDate?: string; endDate?: string },
  now: Date,
): boolean
```

- No dates at all → always open.
- `startDate` only → open from its start, no upper bound. `endDate` only → open until its end, no lower bound.
- The window runs from `startDate`T00:00:00Z **minus 24 hours** to `endDate`T23:59:59Z **plus 24 hours**.

The ±24 hours is the generous reading, and it is deliberate rather than sloppy. Real offsets span UTC−12 to UTC+14, so without it a traveller in New Zealand cannot mark on the morning of their own first day, and a traveller in Hawaii loses the evening of their last. Erring the other way costs nothing: the window is a courtesy that keeps a finished trip from accumulating new marks, not a security boundary, and nobody is harmed by it opening a few hours early.

`deps.now` already exists in `backend/src/context.ts` and `makeTestDeps()` supplies a fixed clock, so the rule is directly testable with no date mocking.

The function is hand-mirrored to `frontend/src/lib/playWindow.ts`, following the same cross-package convention as `tripTypes.ts` (whose header comment documents the practice) — each with its own co-located tests over the same table of cases. **The frontend copy exists only to disable controls and explain why.** The server rejects an out-of-window mark regardless of what the client believes, and a client whose clock is wrong gets a clear error rather than a silent no-op.

**Alternative considered:** having the client send its local calendar date. Rejected outright — it contradicts the repo's rule that a request never carries trust, and it would let any member play whenever they liked by changing their clock.

### Decision: The mark lives inside the frozen renderer, added on purpose

The X has to appear in the exported PNG and the printed PDF. `html-to-image` clones the `.bingo-card` node and `@media print` isolates that same subtree, so anything outside it does not exist to either consumer. An overlay positioned over the card from a wrapper component would look right on screen and vanish from every export — the exact failure `frontend/DESIGN.md` was written to prevent. So the renderer is extended, deliberately, with the guard updated in the same commit.

`frontend/src/components/CardGrid.tsx` gains two optional props:

```ts
markedSlots?: ReadonlySet<number>;
onToggleSlot?: (index: number) => void;
```

Neither is required, so every existing caller — the editor, the shared-card page, the thumbnail generator — compiles and renders exactly as before.

**Interactivity without a new element type.** When `onToggleSlot` is present, the existing cell `<div>` gains `role="button"`, `tabIndex={0}`, an `onClick`, and an `onKeyDown` for Enter/Space, plus the class `bingo-cell-playable`. It stays a `<div>`, which matters: the guard's "renders only elements with no UA typography to lose" rule exists because Tailwind's preflight once silently reset the card title in the app, the PDF, the PNG, and the thumbnail at once. A `<button>` would reintroduce exactly that exposure, and would also carry a UA background and border into the export.

**The mark is two real spans, not a pseudo-element and not an SVG.** A marked cell renders:

```html
<span class="bingo-mark" aria-hidden="true">
  <span class="bingo-mark-stroke"></span>
  <span class="bingo-mark-stroke"></span>
</span>
```

Two absolutely positioned bars, rotated ±45°, forming an X. An `<svg>` would break the tag allowlist for good reason — it is a whole second rendering model inside a node that must serialize identically four ways. A `::before`/`::after` pair is the more tempting option and is rejected for the same reason `oklch()` is: pseudo-element serialization through `html-to-image` is precisely the class of silent export regression the guard exists to catch, and a real element is trivially verifiable.

**Styling obeys the frozen-card rules unchanged.** `.bingo-mark`, `.bingo-mark-stroke`, and `.bingo-cell-playable` go in the unlayered `frontend/src/App.css`. The stroke colour is a fixed `rgba(...)` — no `var(--color-*)`, no `oklch()`, in the same spirit as the deliberate `#ccc`/`#999` borders. Translucency is load-bearing, not decorative: the requirement is that the underlying square stays legible through the mark, so the alpha is chosen to read clearly against both a light and a dark user-chosen `cellColor` and is checked by eye against both. The `@media print` block sets `print-color-adjust: exact` on the strokes, or browsers drop the fill and print an unmarked card. The `:focus-visible` treatment on `.bingo-cell-playable` likewise uses a fixed colour, and — because a cloned node is never focused — never reaches an export.

**The guard is extended, not weakened.** `ALLOWED_CLASSES` in `cardGrid.guard.test.ts` gains `bingo-mark`, `bingo-mark-stroke`, and `bingo-cell-playable`; the tag allowlist is untouched; the "no app design tokens, no `oklch()`" assertions are untouched; and the `className={…}` forms stay literal so the guard's regex keeps seeing them — no `cn(...)`, no variable, or the allowlist check silently passes on nothing. A new assertion is added in the other direction: the print block must pin `print-color-adjust: exact` for the marking layer, so a future tidy-up cannot make marks disappear from paper.

**Accessibility.** The X is `aria-hidden`; the cell carries `aria-pressed` alongside `role="button"` so a screen reader announces marked state rather than inferring it from a decorative glyph.

### Decision: Polling, on one small endpoint, only while the page is visible

Progress refresh is `GET /api/trips/{tripId}/progress`, returning only what changes:

```json
[{ "tripCardId": "…", "markedSlots": [0, 6, 12], "progressUpdatedAt": "…" }]
```

`frontend/src/hooks/useTripProgress.ts` polls it about every 10 seconds while `document.visibilityState === "visible"`, pauses on `visibilitychange`, and clears its timer on unmount. A local mark is applied optimistically and reconciled by the next poll, so the player never waits on a round trip and an observer is at most one interval behind.

Sizing: at the caps in `routes/trips.ts` (`MAX_TRIP_CARDS_PER_TRIP = 50`, `MAX_MEMBERS_PER_TRIP = 50`) the worst case is one small Query every 10s per open page. That is well inside what the existing on-demand Lambda absorbs, and the endpoint deliberately does not re-serialize snapshots, members, or invites — a poll must not carry the payload `getTrip` carries.

**Alternative considered:** an API Gateway WebSocket API. Rejected for now — it means a new API, a connection table, a second authorization path for the connect handler, and a fan-out publisher, all to shave seconds off a turn-based game where the median interval between marks is minutes. The add-trips design already flagged transport as deferrable, and polling keeps that door open: nothing in this change's schema or endpoints assumes it. **Also considered:** polling `getTrip` itself. Rejected — it returns every snapshot on every tick.

### Decision: PNG export is lifted into a shared module, not reimplemented

The `toPng` block in `CardView.tsx` moves to `frontend/src/lib/cardPngExport.ts` as `downloadCardPng(node, title)`, keeping its `await document.fonts.ready`, its `pixelRatio: 2`, and its use of `buildImageFilename` from `lib/imageExport.ts`. `CardView` calls it; the new per-card export control on `TripDetailPage` calls it with the trip card's own `.bingo-card` node and its snapshot title. One implementation, so the shared image of a marked card cannot drift from the editor's export, and a fix to either is a fix to both.

Print (`window.print()`) is not offered per trip card in this change: the print stylesheet isolates *a* `.bingo-card`, and choosing which one on a page showing up to fifty is a separate problem. The marks print correctly wherever `.bingo-card` prints today; the on-demand control for a trip card is PNG only.

### Decision: A blank square is not a square

A card built from fewer than 25 entries has `null` slots, rendered as `bingo-cell-blank`. Marking one is rejected server-side (the handler inspects `snapshot.slots[index]`) and it is not interactive in the UI. A blank is absence, not an unclaimed square, and letting it be marked would make an under-filled card trivially "complete" for the win conditions arriving in the next change.

The free space is the opposite case and gets no special treatment at all: it is a real square with real text, it starts unmarked, and the player taps it like any other. This is a deliberate product choice over the classic-bingo convention of a free space that starts filled.

## Risks / Trade-offs

- **The frozen renderer is being changed, which is the one thing the repo says not to do casually.** → The mitigation is that it is changed *loudly*: guard allowlist, `DESIGN.md`, and the full export regression checklist (print, PNG, thumbnail) in the same change, plus the invariant that an **unmarked** card renders byte-for-byte as it does today — no rule fires without `markedSlots`, so every card saved or exported before this change is unaffected.
- **A translucent X can be unreadable against some user-chosen cell colours.** → The alpha is tuned against both extremes and reviewed at 390px and 1440px in light and dark. It cannot be solved perfectly, because the cell colour is user data and the mark colour cannot be: a mark that adapted to the cell would be application logic painting inside the frozen card.
- **Polling is visibly not real-time.** → Up to ~10s of lag for an observer, and none for the player, whose own marks are optimistic. Acceptable for a game whose events are minutes apart, and revisitable without touching the data model.
- **The generous ±24h window lets marks land slightly outside the stated dates.** → Deliberate. The window is a courtesy, not a boundary; being locked out on your own first day is a much worse failure than a mark arriving an hour early.
- **A cooperative trip's shared progress means one member can undo another's mark.** → Follows directly from "every member plays every card," which the trips spec already states. There is no per-member state to protect, and unmarking is the same operation as marking. A trip that wants individual progress uses competitive mode, which is what it is for.
- **Concurrent marks are atomic per square but the response is not a snapshot.** → Two members marking simultaneously each get a response reflecting their own write; the next poll reconciles both. Set semantics guarantee no lost mark, which is the property that matters.
- **`requireTripCardPlayer` reads three items where `requireTripRole` reads one.** → The membership Get, the trip `META` Get, and the trip-card Get. Three point reads on a write path that happens at human speed; `fakeDdb`'s `sendCount` assertion pins the number so it cannot quietly grow.

## Migration Plan

Additive and reversible. There is no data migration: `markedSlots` is a new attribute read schema-on-read, and its absence means "nothing marked", which is the correct state for every trip card that exists today.

1. Backend first: `lib/playWindow.ts` (+tests) → `auth.ts` `requireTripCardPlayer` (+tests) → mark/unmark/progress handlers in `routes/trips.ts` (+tests) → route registration in `router.ts`. Update the table-layout comment at the top of `lib/keys.ts` in the same step, even though no key helper changes.
2. Infra: three authenticated route keys in `infra/apigateway.tf`. No new Lambda, table, bucket, or Cognito change; `terraform plan` should show route additions only.
3. Frontend, renderer first so the export checklist runs early: `CardGrid.tsx` + `App.css` + `cardGrid.guard.test.ts` + `DESIGN.md` → `lib/cardPngExport.ts` (with `CardView.tsx` switched over) → `lib/playWindow.ts` → `lib/tripTypes.ts` and `lib/tripApi.ts` → `hooks/useTripProgress.ts` → `pages/TripDetailPage.tsx` → gallery entries.
4. Deploy to dev by merging to `main`. Verify multi-member behaviour with `scripts/dev-user.sh`; a Gmail plus-alias yields the same `sub` and cannot be used.

Rollback is removing the three routes and the play controls. `markedSlots` left on items is inert — nothing reads it, and it does not appear in any snapshot or contract.

## Open Questions

- **Whether the poll interval should adapt.** 10 seconds is a first guess. Backing off while a trip is idle and tightening while marks are arriving is a pure frontend change and needs no spec revision.
- **Whether print should offer a single trip card.** Deferred with the reasoning above; PNG covers the sharing case this change is actually for.
- **Whether progress should be exportable for the whole trip at once.** A contact sheet of every member's card is an appealing artifact and a clearly separate feature.
