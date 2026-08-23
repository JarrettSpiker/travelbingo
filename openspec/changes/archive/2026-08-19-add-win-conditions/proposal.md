## Why

`add-card-progress` gives a trip card marked squares, and marking squares is satisfying for about ten minutes. What it does not give anyone is a reason to stop, or a moment to shout about. A bingo card without a declared target is a checklist: you fill it in, and then it is full. The word "bingo" is the sound a person makes when they complete a line, and this application has never had a line to complete.

Different groups want different targets, and the difference is not cosmetic — it decides how long a trip takes. A single line is a short game suited to an afternoon drive; two lines stretches it across a day; a full card is a week-long holiday's worth of spotting. Fixing one target in code would be picking one of those trips and telling the others they are playing wrong, so the target belongs to the trip, chosen by the person who set the trip up and changeable by them when it turns out the group wants a longer game.

There is a second, less obvious reason to build this now. The notifications that follow — "Sam is one square from winning" — are the most compelling thing in the whole feature, and they are impossible to state without a definition of winning. A near-win is a distance measured against a target. So this change deliberately produces not just a yes-or-no answer but the distance itself, and hands it to the change that needs it.

## What Changes

- **A trip declares a win condition.** One of a line, two lines, or a full card, chosen when the trip is created and defaulting to a line when it is not stated. Every trip that already exists reads as a line, since that is the shape of the game the application has always implied.
- **A line means a row, a column, or a diagonal.** All five rows, all five columns, and both diagonals count — twelve possible lines on a five-by-five card. Two lines means any two distinct lines, which may cross and share a square.
- **The administrator can change the trip's win condition.** Unlike the cooperative-or-competitive mode, which is fixed for the trip's lifetime because it changes who may play what, the target is a goalpost and moving it invalidates nothing. Marks already recorded stay exactly as they are, and a card that already met the old target keeps its recorded win.
- **A win is detected and recorded by the system at the moment it happens.** When a mark completes the trip's condition, the system records that the card was won, by whom, and when — as a fact about the past, not a value derived from the current marks. The winner is the member who was entitled to play the card: the assignee in a competitive trip, the member who placed the winning mark in a cooperative one.
- **Winning celebrates and play continues.** Nothing locks. The winning card stays markable, other members keep playing toward their own wins, and unmarking a square afterwards does not undo a recorded win — a trip can have several winners, and a group that wants to keep going for a full card after somebody takes a line can.
- **The distance to a win is computed, not just the win itself.** The same logic reports how many more squares a card needs, which is what makes "one square away" statable at all. Nothing in this change consumes that number; `add-play-notifications` does.
- **Squares that do not exist are stated to be unreachable.** A card built from fewer entries than the grid has cells carries blank positions, which cannot be marked. Any line through a blank can never complete, and a full card on such a card can never complete. This is surfaced to the administrator when they set a target their trip's cards cannot reach, rather than discovered halfway through a holiday.
- **Unchanged:** who may mark and when, which `add-card-progress` settled; the cooperative-or-competitive mode and its fixed-at-creation rule; how cards are added, assigned, or removed; the saved-card shape and both contract tests; the card renderer, which gains nothing — a win is announced around the card, not drawn on it.

## Capabilities

### New Capabilities
- `win-conditions`: The target a trip is played toward — what a line is, which targets a trip may declare, how a win is detected and recorded when a mark completes one, and how far a card is from its target.

### Modified Capabilities
- `trips`: A trip carries a win condition alongside its title, dates, and mode; it is validated against an allowlist like the mode is, and the administrator may change it after creation, unlike the mode.

## Impact

- **Backend** (`backend/src/`): a new pure `lib/winCondition.ts` (the twelve lines, completion, and distance-to-target); `winCondition` added to the trip validators in `lib/tripPayload.ts`; win evaluation and recording folded into the existing mark handler in `routes/trips.ts`. The win is two new attributes on the existing `TRIP#`/`TRIPCARD#` item and one on the trip `META` — no new table, no new GSI, no new key prefix, no migration.
- **Frontend** (`frontend/src/`): a mirrored `lib/winCondition.ts` with its own tests; a win-condition control on `pages/TripFormPage.tsx` beside the existing mode control; winner presentation and a celebration on `pages/TripDetailPage.tsx`; an unreachable-target warning where the administrator sets it.
- **Infra** (`infra/`): none. No new routes — the win rides on the existing mark request and the existing trip reads.
- **CI/CD** (`.github/workflows/`): unchanged.
- **Contract tests**: the saved-card shape is untouched. `TripCardSnapshot` is untouched — the win is a sibling attribute on the trip-card item, not a field inside the snapshot.
- **No dependencies added** in either package.
- **Out of scope**: notifying anyone that a win or a near-win happened (`add-play-notifications`); any form of locking, ending, or freezing a trip when someone wins; leaderboards, scoring, or ranking members; per-trip custom line patterns beyond the three targets; and drawing anything on the card itself — the mark is the only thing inside the frozen renderer.

**Depends on** `add-card-progress`, which introduces the marks this change evaluates.
