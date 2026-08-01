## Why

There's no lightweight tool for quickly turning a custom list of words or phrases into a set of printable bingo cards (e.g. for parties, classrooms, or office games). This project starts a new webapp that solves that single problem well, with no accounts or persistence required.

## What Changes

- New React + TypeScript frontend where a user types in a pool of text entries (words/phrases).
- A single bingo card is generated client-side and updates live as the user adds, edits, or removes entries — no minimum entry count is required to see or print a card; unfilled cells simply render blank.
- The user can explicitly randomize the card's arrangement (which entries appear and where, and which cells are blank) as many times as they like via a dedicated control.
- Users can mark individual entries as mandatory; when the pool exceeds 24 entries, mandatory entries are always included on the card, and only the remaining slots are filled from the rest of the pool.
- Users can name the card; the name appears as a title on the printable version.
- Users can specify custom content for the center "free" space (defaulting to a standard label if left blank).
- Users can customize the card's color scheme (background color, cell color, text color) or randomize it with one action; a sensible default applies if untouched.
- Printable output: the card renders in a print-friendly layout (browser print / export), sized for standard paper.
- Users can export the current card (entries and their exact arrangement, title, free-space text, and color scheme) as a URL, and reopening that URL reproduces the identical card — a way to "save"/share a card with no backend or account.
- No user accounts, no database, no backend — each session is stateless; a card's only persistence is the URL the user chooses to export and keep.
- A Go backend is deliberately deferred: it adds no value for pure client-side generation and will be introduced later if/when server-side persistence (e.g. a card library or short links) is added.

## Capabilities

### New Capabilities
- `card-entry-input`: Capturing, editing, and validating the user's pool of text entries (duplicate handling, marking entries mandatory), plus the card title and free-space content.
- `card-generation`: Client-side logic to build a single live-updating bingo card from the current entry pool (blank cells when the pool is short of 24 entries, mandatory entries guaranteed inclusion when the pool exceeds 24), plus on-demand randomization of the card's arrangement.
- `card-print-export`: Rendering the current card in a print-optimized layout suitable for physical printing, including the card title and color scheme.
- `card-color-scheme`: Letting the user set or randomize the card's background, cell, and text colors, applied to the current card (including in print).
- `card-url-sharing`: Encoding the current card's exact state (entry arrangement, title, free-space text, color scheme) into a URL, and restoring that exact state when the URL is opened.

## Impact

- **New repo structure**: `frontend/` (React + TypeScript). No `backend/` for this phase.
- No existing code or specs affected — this is a greenfield project.
- **Future work**: a Go backend + persistence layer is expected in a later change once saving/sharing cards is prioritized.
