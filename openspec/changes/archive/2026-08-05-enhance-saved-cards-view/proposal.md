## Why

The saved-cards page is a flat list of titles and timestamps. With cards now the primary unit of sharing (and, per the in-flight `remove-card-url-sharing` change, soon the *only* sharing path), the library needs to be browsable at a glance and sharable without round-tripping through the editor. Today a user must open a card into the editor just to mint a share link, and they cannot tell two untitled cards apart from the list.

## What Changes

- The saved-cards library switches from a flat `List` to a responsive **grid of card previews**. Each cell shows a small rendered thumbnail of the card, its title, and its last-updated time.
- Each grid cell gains a **per-card menu** supporting the full set of share-link actions — create, list active links, copy, and revoke — without opening the editor. The existing `ShareLinkDialog` is reused, scoped to the cell's card.
- Saved cards gain an optional **thumbnail** — a small PNG generated client-side at save time (reusing the existing `html-to-image` render path) and stored in a **new, dedicated private S3 bucket**. The card's record carries a thumbnail key, not the bytes.
- Thumbnail reads are served via **short-TTL presigned GET URLs** minted by the backend at list time. Thumbnails are owner-private: the bucket is not publicly readable, and a presigned URL is only ever issued after `requireCardRole` authorizes the caller for that card.
- Thumbnail writes are **Lambda-mediated**: the thumbnail bytes ride on the save-card request and the backend writes them to S3. No client-to-S3 direct upload, no `connect-src` CSP change for uploads.
- Deleting a card also deletes its thumbnail object.
- Existing saved cards have no thumbnail; they render a placeholder until the user next saves them (no backfill — the backend cannot render).

## Capabilities

### New Capabilities
<!-- none — covered as modifications to existing capabilities -->

### Modified Capabilities
- `card-library`: The list-and-open requirement is amended so each card is shown with a visual preview, and so the per-card actions include full share-link management. A new requirement covers thumbnail generation at save time, and another covers thumbnail privacy. The rename/delete requirement is amended so deleting a card also removes its thumbnail.
- `card-share-links`: The owner-mint requirement gains a scenario confirming that minting, listing, copying, and revoking share links is available directly from the library view, not only from the editor.
- `backend-api`: A new requirement covers thumbnail storage — a dedicated private S3 bucket, the card record carrying a key reference (not bytes), presigned GET access authorized through the shared membership check, size-bounded thumbnail payloads validated like any other untrusted input, and cleanup of the thumbnail object on card deletion.

## Impact

- **Frontend page** (`src/pages/SavedCardsPage.tsx`): rewritten from `List` to a responsive `Grid`/`ImageList`; each cell renders a thumbnail `<img>` (with placeholder), title, timestamp, and a per-card menu.
- **Frontend component** (`src/components/ShareLinkDialog.tsx`): reused from the new page. Its `onSaveFirst` prop (the editor's "save first if unsaved" path) is bypassed from the library since cards are already saved; its signed-out message currently references a "Copy card link" alternative that is being removed by `remove-card-url-sharing` and must be updated (see Sequencing).
- **Frontend editor** (`src/App.tsx`, `src/components/CardView.tsx`): the save flow generates a thumbnail (via the existing `html-to-image` `toPng` path already used for PNG export) and sends it with the save-card request.
- **Frontend API client** (`src/lib/cardsApi.ts`): save-card accepts an optional thumbnail; list-cards returns a presigned GET URL per card that has a thumbnail.
- **Frontend CSP** (`infra/main.tf`, the response-headers policy): `img-src` must widen to include the thumbnail bucket's S3 regional domain. The bucket name is environment-specific, so the CSP value is environment-aware (scoped wildcard or per-env literal).
- **Backend routes** (`backend/src/routes/`): save-card accepts and validates the thumbnail payload and writes it to S3; list-cards mints presigned GET URLs; delete-card removes the thumbnail object. All three still authorize through the existing `requireCardRole`.
- **Backend payload + contract tests** (`backend/src/lib/cardPayload.ts`, `frontend/src/lib/savedCard.ts`): add optional `thumbnailKey`. The two contract tests (`backend/src/lib/cardPayload.contract.test.ts`, `frontend/src/lib/savedCard.contract.test.ts`) are updated together, per the AGENTS.md definition of done.
- **Infra** (`infra/main.tf`, `infra/bootstrap/lambda-roles.tf`, `infra/bootstrap/tfc-roles.tf`): a new private S3 bucket (public access block, no OAC, no public policy); the Lambda execution role gets `s3:PutObject`/`s3:GetObject`/`s3:DeleteObject` scoped to that bucket, per environment; an optional S3 lifecycle rule as belt-and-suspenders against orphans.

## Sequencing

This change is independent of `remove-card-url-sharing` at the spec level, but interacts with it in one place: `ShareLinkDialog`'s signed-out message references the "Copy card link" feature that `remove-card-url-sharing` deletes. Recommended order is **`remove-card-url-sharing` first, then this change**, so the dialog's message can be rewritten cleanly here without a stale reference in the interim. If this change lands first, the dialog text must be left alone (it is still accurate until the other change ships).
