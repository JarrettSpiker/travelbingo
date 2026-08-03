## Context

`?card=` URL sharing was the original, account-free sharing mechanism: `encodeCardToUrl` (in `frontend/src/lib/cardUrl.ts`) packed the entire card state into a base64url query param, and `decodeCardFromUrl` reconstructed it on load. The app now has saved cards plus revocable, server-backed share links as the canonical sharing path. This change retires the permanent URL path entirely. See `proposal.md` for motivation.

Two architectural constraints in `AGENTS.md` currently enshrine the URL path as permanent and account-free; both are deliberately reversed by this change and must be amended in lockstep.

The `?card=` URL is used only in `frontend/src/App.tsx`: a module-level `decodeCardFromUrl()` on load (line 26) and `handleExportUrl` (lines 129-131) feeding the `onExportUrl` prop into `CardView`. The encoder/decoder and their tests are otherwise self-contained in `cardUrl.ts` / `cardUrl.test.ts`.

## Goals / Non-Goals

**Goals:**
- Remove the `?card=` encode/decode mechanism, its UI, and its tests with zero leftover dead code.
- Tolerate a leftover `?card=` param on the URL without error (silently ignored).
- Relocate the `CardUrlData` type so the editor keeps a typed representation of the current card.
- Amend `AGENTS.md` so its constraints stop promising a feature that no longer exists.

**Non-Goals:**
- No sunset/landing page for old `?card=` links (decided against — see Decisions).
- No redirect or token-lookup table to honor old links (impossible by construction; the URLs are stateless and carry no server-side state).
- No backend or infra changes.
- No change to PNG/PDF export, share links, or saved cards.

## Decisions

### Decision: Full removal vs. decode-only deprecation
**Choice: Full removal** — delete both `encodeCardToUrl` and `decodeCardFromUrl`.
- *Alternative considered:* keep `decodeCardFromUrl` so old links keep loading forever, only remove the encode/UI. Rejected: it permanently freezes `cardUrl.ts`'s payload schema and keeps a decode path that can never be exercised from the UI, which is exactly the maintenance burden this change exists to shed.
- *Alternative considered:* demote the UI but keep both functions. Rejected: the user explicitly chose full removal.

### Decision: Behavior when an existing `?card=` link is visited
**Choice: Silently ignore** the param and load the normal empty/default editor.
- *Alternative considered:* a sunset banner that decodes the payload one last time so the recipient doesn't lose the card. Rejected by the user — adds a temporary decode path that must later be removed, and there is no way to ship a true "sunset window" without keeping decode alive indefinitely.
- *Alternative considered:* a hard "link no longer supported" error page. Rejected as more disruptive than a silent load for recipients who do not know the format changed.
- Consequence: every `?card=` link ever shared stops doing anything. Accepted.

### Decision: Where the `CardUrlData` type lives after `cardUrl.ts` is deleted
**Choice: New `frontend/src/lib/cardData.ts`.**
- The type is still needed by `App.tsx`'s `currentCardData()` and by `CardView`'s props. It must not disappear with the file that encoded it.
- *Alternative considered:* reuse the saved-card payload shape from `savedCard.ts`. Rejected: the two shapes overlap but are not identical (saved cards carry owner/timestamps/schema-version metadata; the editor's live state does not), and conflating them would couple the editor to the persistence shape.
- The new file is pure types only — no logic to test.

### Decision: Export menu after removal
**Choice: Keep the Export menu with PDF and PNG; remove the "Copy card link" item.**
- The menu's structure (single "Export" button → `Menu`) is preserved; only the URL item is removed, along with the `onExportUrl` prop on `CardView` and the explanatory comment about the two sharing mechanisms.
- If the menu ever drops to a single item, collapsing the menu back to a single button is a later UI decision, not part of this change.

### Decision: AGENTS.md amendments are part of this change
**Choice: Amend AGENTS.md in the same change.**
- Leaving the constraints promising a removed feature would mislead future agents. Two edits: delete the "`?card=` URL sharing is permanent…" bullet, and revise the "fully usable signed out" bullet to remove sharing from the signed-out set (card generation, randomize, print, and PNG remain).

## Risks / Trade-offs

- **[Every existing `?card=` link breaks]** → Accepted by decision. There is no migration possible: the URLs are stateless and carry no server-side record to redirect. Mitigation is purely social (announce the change), not technical.
- **[Signed-out users can no longer share at all]** → Accepted by decision. Signed-out use remains for card creation, randomize, print, and PNG. Sharing becomes an account feature.
- **[Reversal of a documented architectural guarantee]** → The `card-url-sharing` spec's "remains available without an account" requirement and two AGENTS.md constraints are explicitly reversed. Mitigation: the spec deltas and AGENTS.md edits land together so docs and behavior stay consistent.
- **[Leftover `?card=` param causing an error]** → Low likelihood; mitigated by ensuring the app never inspects the param after removal (it is simply not read).

## Migration Plan

- **Deploy:** a single frontend release. No backend, no data migration, no infra.
- **Rollback:** revert the frontend release. The `?card=` mechanism returns as-is (the payload schema is unchanged at removal time, so old encode/decode are mutually compatible).
- **No partial state:** because no backend or persisted data is involved, there is no period during which client and server disagree.

## Open Questions
<!-- none -->
