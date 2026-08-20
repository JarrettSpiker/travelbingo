## Context

`add-card-progress` (the immediately preceding change) added `markedSlots` — a DynamoDB number set of marked square indices — and `progressUpdatedAt` to the existing `TRIP#<tripId>` / `TRIPCARD#<id>` item, plus a `requireTripCardPlayer` routine in `backend/src/auth.ts` that decides who may modify them. This change reads those marks and asks whether they add up to anything.

The precedents it follows are already in the repo:

- `frontend/src/lib/bingo.ts` owns the grid's geometry — `GRID_SIZE = 5`, `CELLS_PER_CARD = 25`, `FREE_SPACE_INDEX = 12`, and `BingoCell { text, kind: "entry" | "free" | "blank" }`. Pure, framework-free, co-located tests.
- `backend/src/lib/tripPayload.ts` validates the trip's `mode` against an allowlist and rejects rather than corrects, and `updateTrip` in `backend/src/routes/trips.ts` writes the trip `META` plus every member's denormalized listing row in one `TransactWriteCommand` bounded at 51 actions.
- `backend/src/lib/cardPayload.ts` ↔ `frontend/src/lib/savedCard.ts` establish the hand-mirrored cross-package type convention, with contract tests as the only thing linking them.
- The trip `META` already carries `mode`, which is fixed at creation and shown read-only on the edit form (`frontend/src/pages/TripFormPage.tsx:202-206`) — the closest analogue to the new field, and instructive precisely where it differs.

See `proposal.md` for the motivation.

## Goals / Non-Goals

**Goals**
- Let a trip declare which of three targets it is played toward, validated like `mode` is.
- Define a line once, in pure logic, mirrored across both packages with tests, so the frontend's celebration and the backend's recorded win can never disagree.
- Record a win as an authoritative fact at the moment the qualifying mark lands, on the write path that already exists.
- Produce the **distance** to a win, not only the boolean, because `add-play-notifications` needs it.
- Say out loud that some targets are unreachable on some cards, and warn the administrator rather than letting them find out on day four.

**Non-Goals**
- Notifying anybody of anything. This change records; `add-play-notifications` announces.
- Locking a card, ending a trip, or freezing play on a win. Play continues, by decision.
- Scoring, ranking, or a leaderboard. "Who won" is a set, not an ordering.
- Custom or user-defined line patterns. Three targets, one line definition.
- Any change to the card renderer. A win is announced around the card, never drawn on it.
- Any change to `TripCardSnapshot`, the saved-card shape, or the two contract tests.

## Decisions

### Decision: `winCondition` lives on the trip `META` and is not denormalized

```
TRIP#<tripId>   META   ownerId, title, mode, startDate?, endDate?, createdAt, updatedAt,
                       winCondition: "line" | "two-lines" | "full-card"
```

Read schema-on-read: an item without the attribute is a `"line"` trip. There are no migrations in this repo by design, and every trip that exists today was created under an implied single-line game, so the default is not a shrug — it is the correct reading of that data.

It is deliberately **not** denormalized onto the `USER#<sub>` / `TRIP#<tripId>` listing rows the way `title` and the dates are. Those rows exist so the trips list is one Query, and the list shows a trip's name and dates, not its rules. Adding a fourth denormalized field would put another write into `updateTrip`'s transaction — which already fans out to every member's row and is bounded at 51 actions — for a value the list does not render.

**Alternative considered:** storing the condition per trip card, so a trip could mix targets. Rejected — it makes a competitive trip incoherent (members racing toward different finish lines is not a race) and nobody asked for it.

### Decision: The administrator can change the win condition; the mode still cannot

`mode` is fixed for a trip's lifetime because changing it changes *who may play which card* — a cooperative trip has no assignments to fall back on, and flipping to competitive would strand every card in the unassigned pool mid-game. `winCondition` has no such consequence. It is a goalpost, and moving a goalpost invalidates nothing that has already happened:

- Marks are untouched.
- A previously recorded win stays recorded, because a win is a fact about the past (see below). Tightening a trip from a line to a full card does not retroactively un-win the member who already took a line.
- Loosening the target may make cards that already satisfy the new condition eligible to win. Those wins are recorded lazily, on the next mark to that card, rather than by sweeping every card at update time — a sweep would need to touch up to fifty items inside a transaction that is already fanning out to fifty members.

The lazy-recording asymmetry is the one wrinkle worth stating plainly: after a trip is loosened, a card that already meets the new target shows as met in the interface (the frontend evaluates the same pure function against live marks) but carries no recorded win until its next mark. That is acceptable because the recorded win exists to be *announced*, and there is nothing to announce until somebody does something.

`PATCH /api/trips/{tripId}` accepts `winCondition`; `TripUpdateInput` in `backend/src/lib/tripPayload.ts` gains it while continuing to reject `mode`.

**Alternative considered:** freezing the condition once any square on any card is marked. Rejected — the most likely moment to discover the target is wrong is precisely after play has started.

### Decision: One definition of a line, mirrored across packages

`backend/src/lib/winCondition.ts` and `frontend/src/lib/winCondition.ts`, hand-mirrored like `cardPayload.ts` ↔ `savedCard.ts`:

```ts
export type WinCondition = "line" | "two-lines" | "full-card";

/** 5 rows + 5 columns + 2 diagonals = 12 lines of 5 indices each. */
export const LINES: readonly (readonly number[])[];

export function completedLines(marked: ReadonlySet<number>): number;
export function hasWon(marked: ReadonlySet<number>, condition: WinCondition): boolean;
export function squaresFromWin(
  marked: ReadonlySet<number>,
  markable: ReadonlySet<number>,
  condition: WinCondition,
): number;   // 0 when won, Infinity when unreachable
```

`LINES` is derived from `GRID_SIZE` rather than written out, so a grid that is ever not five-by-five does not need the table re-typed. Both diagonals count, per decision: a diagonal is a line in every bingo hall, and excluding it makes the corner squares strictly less valuable than the rest for no reason anyone could explain.

`two-lines` means any two **distinct** lines. They may intersect and share a square — a marked row and a marked column crossing at one cell is two lines, not one and a half. This is worth stating because the alternative (requiring disjoint lines) is a real variant in the wild and would otherwise be a coin-flip for the implementer.

`squaresFromWin` is the primitive `add-play-notifications` consumes, which is why it exists here rather than being invented later. It takes `markable` — the set of positions that hold an entry — so it can distinguish "four squares to go" from "impossible", returning `Infinity` for the latter. For `line` and `two-lines` it is the minimum over the cheapest reachable line (or pair of lines); for `full-card` it is the count of unmarked markable positions.

**Alternative considered:** computing this only in the backend and shipping the answer. Rejected — the frontend needs to show progress toward the target live and optimistically, on marks that have not round-tripped yet, which means it needs the function, not the answer.

### Decision: A win is a recorded fact, not derived state

When a mark completes the condition, the same `UpdateCommand` that adds the square also writes:

```
TRIP#<tripId>   TRIPCARD#<id>   …, markedSlots, progressUpdatedAt,
                                wonAt: string,      <- ISO, first achievement
                                winnerId: string    <- the member who won it
```

guarded by `attribute_not_exists(wonAt)` so the first achievement is the one that sticks and a concurrent second mark cannot overwrite it.

Recording rather than deriving is the load-bearing decision, and it follows from "celebrate and keep playing". If a win were computed from current marks, then unmarking a square — which the player is explicitly allowed to do, since unmarking is how a misclick is fixed — would silently un-win the card, retract a celebration, and (once notifications land) contradict an announcement that has already been sent. A recorded `wonAt` cannot be retracted by a later edit, which is the only behaviour consistent with having told everyone.

`winnerId` is the member entitled to play the card: the assignee in a competitive trip, and in a cooperative trip the member who placed the winning mark. That second case is a judgement call — a cooperative card is shared, so arguably the whole trip won it — but attributing it to the person who placed the final square is what a room full of people would do, and it gives notifications a name to use.

**Alternative considered:** a separate `WIN#` item per card. Rejected — it is one-to-one with the trip card, it would need its own cascade-delete handling, and `getTrip` already pages the partition the trip card lives in.

### Decision: Evaluation happens on the mark path only, and never on unmark

`markTripCardSlot` in `backend/src/routes/trips.ts` gains a step: after the set update, evaluate `hasWon` against the resulting marks and the trip's condition, and conditionally write `wonAt`/`winnerId`. Adding a square can only ever move a card toward the target, so a mark is the only operation that can create a win. `unmarkTripCardSlot` skips evaluation entirely — it cannot create a win, and by decision it cannot destroy one.

This keeps evaluation off every read path. `getTrip` and `getTripProgress` return `wonAt`/`winnerId` as stored, and the frontend separately computes live progress toward the target from the marks it already has, for the "two squares to go" affordance. The two are allowed to differ in exactly the loosened-target case described above.

**Cost:** the mark handler's single `UpdateCommand` grows a conditional expression and, when the win fires, becomes two updates rather than one. `hasWon` is twelve five-element set lookups.

### Decision: Unreachable targets are surfaced, not silently tolerated

A card built from fewer than 25 entries has `null` slots, which `add-card-progress` established are not markable. So:

- any line containing a blank can never complete;
- `full-card` on a card with any blank can never complete;
- `line` is reachable if at least one of the twelve lines is blank-free; `two-lines` needs two.

The frontend computes this from each trip card's snapshot and warns in two places: on `TripFormPage` when the administrator picks a target no current card can reach, and on `TripDetailPage` beside any card that cannot reach the trip's target. Both are warnings, not refusals — the administrator may be about to add more cards, and refusing would be the tool second-guessing a person who can see their own trip.

**Alternative considered:** auto-marking blanks so every line is completable. Rejected outright — a card with three entries would win instantly, which is worse than a card that cannot win at all.

## Risks / Trade-offs

- **A recorded win can disagree with the live marks.** → Deliberate, and the alternative is worse: a derived win would be retracted by an unmark, contradicting a celebration that has already happened. The interface shows both truthfully — "won on the 4th" is history, the current marks are the present.
- **Loosening a trip's target does not immediately record the wins it enables.** → Recorded lazily on the next mark to each card. The interface still shows the target as met, because it evaluates live. Nothing is announced until someone acts, which is exactly when an announcement is wanted.
- **A cooperative win is attributed to whoever placed the last square.** → Arguably the trip won it collectively. Attributing to the final marker matches what people say out loud and gives notifications a subject; the alternative is an announcement with no actor in it.
- **`two-lines` allowing intersecting lines makes the second line cheaper than the first.** → True, and standard. A crossing row and column is nine squares, not ten. Requiring disjoint lines is a harder, rarer game that nobody asked for.
- **Blank squares can make a trip unwinnable.** → Warned in both places the administrator can act on it, and never silently corrected. The honest failure is visible; the dishonest fix — auto-marking blanks — is not available.
- **Two mirrored `winCondition.ts` files can drift.** → The same exposure `cardPayload.ts` ↔ `savedCard.ts` already carries, mitigated the same way: identical test tables in both packages, including the full twelve-line enumeration, so a divergence fails a test rather than producing a card that celebrates on one side of the wire and not the other.

## Migration Plan

Additive and reversible. No data migration: `winCondition` absent means `"line"`, and `wonAt`/`winnerId` absent means "not yet won" — both correct readings of every item that exists.

1. Backend: `lib/winCondition.ts` (+tests) → `winCondition` in `lib/tripPayload.ts`'s create and update validators (+tests) → `createTrip`/`updateTrip` in `routes/trips.ts` → win evaluation in `markTripCardSlot` → `wonAt`/`winnerId` on the `getTrip` and `getTripProgress` responses (+tests).
2. Infra: none. No new routes; the field rides on existing trip endpoints and the win on the existing mark endpoint.
3. Frontend: `lib/winCondition.ts` mirror (+tests) → `lib/tripTypes.ts` → `pages/TripFormPage.tsx` control and unreachable-target warning → `pages/TripDetailPage.tsx` winner presentation, celebration, and distance-to-target → gallery entries.
4. Deploy to dev by merging to `main`; verify with `scripts/dev-user.sh` identities.

Rollback is removing the control and the evaluation step. `winCondition`, `wonAt`, and `winnerId` left on items are inert.

## Open Questions

- **Whether the celebration should be more than a message.** Confetti, a sound, a shareable image of the winning card. Purely presentational; needs no spec revision.
- **Whether a trip should be able to declare "first to win ends it".** Explicitly rejected for now per the celebrate-and-keep-playing decision, but it is a trip-level flag if a group ever asks.
- **Whether `winnerId` should be a list in cooperative trips.** One name is enough to announce; a contributor list is a bigger feature that wants the event log `add-play-notifications` introduces.
