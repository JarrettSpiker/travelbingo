## Why

Today the only way to keep an entry off a generated card is to delete it, which loses the entry permanently. Users want to temporarily set entries aside — to experiment with pool size, build variants of the same card, or hold an entry in reserve — without retyping it later. A lightweight enable/disable state per entry solves this without adding persistence, accounts, or any backend.

## What Changes

- Each entry gains an **enabled/disabled** state (on by default), toggled via a per-row "Active" switch in the entry list.
- A **disabled entry stays in the pool** but is **excluded from the generated card** — both the live card and the randomized card.
- Disabled entries still **count for duplicate rejection** (you cannot add a duplicate of a disabled entry) and are **not deleted**: re-enabling restores the entry with its text and mandatory flag intact.
- The "cells filled" / "extra" counters and the mandatory-overflow warning now reflect **enabled entries only**.
- Disabling **wins over mandatory**: a disabled entry marked mandatory does not appear, and is excluded from the mandatory guarantee and the overflow count.
- Disabled state is **not persisted in the URL**: exported URLs encode only the displayed card, so disabled (off-card) entries are not carried in a share — consistent with how the URL already drops off-card entries and mandatory flags.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `card-entry-input`: Adds a disable/enable toggle per entry; clarifies that duplicate rejection still considers disabled entries; the mandatory-overflow warning counts enabled mandatory entries only.
- `card-generation`: Disabled entries are excluded from selection (live and randomized) and from capacity/pool-size calculations; the mandatory-inclusion guarantee applies to enabled mandatory entries.

## Impact

- **Frontend logic** (`src/lib/bingo.ts`): add an `enabled` flag to `BingoEntry` (default true), preserve it through dedup, and exclude disabled entries from selection in the live and randomize builders.
- **Frontend UI** (`src/components/EntryInput.tsx`, `src/App.tsx`): add a per-row "Active" switch; visually distinguish disabled rows (strikethrough + dimmed); compute the filled/extra counters and mandatory-overflow warning from enabled entries; add a toggle handler to app state.
- **Tests** (`src/lib/bingo.test.ts`): cover disabled entries being excluded (live and randomize), disabled+mandatory behavior, and duplicate rejection still blocking disabled-entry duplicates.
- No URL schema, backend, persistence, or infrastructure changes — disabled state is a session/pool-level concept only.
