## 1. Infrastructure: dedicated private thumbnail bucket

- [x] 1.1 Add a `thumbnail_bucket_name` field per environment to the `envs` local in `infra/bootstrap/tfc-roles.tf` (e.g. `${var.dev_bucket_name}-thumbnails`, `${var.prod_bucket_name}-thumbnails`)
- [x] 1.2 Create the thumbnail S3 bucket resource in `infra/main.tf`: full public-access block, no OAC, no public bucket policy, tagged consistently with the existing bucket
- [x] 1.3 Add an S3 statement to the Lambda execution role policy in `infra/bootstrap/lambda-roles.tf`: `s3:PutObject`/`s3:GetObject`/`s3:DeleteObject` scoped to `arn:aws:s3:::<thumbnail-bucket>/*` per environment
- [x] 1.4 Add an optional S3 lifecycle rule on the thumbnail bucket (noncurrent-version expiration / abort incomplete multipart) as belt-and-suspenders against orphans
- [x] 1.5 Wire the bucket name and region into the Lambda's runtime config (env var or SSM) so it knows where to PUT/GET/DELETE

## 2. Backend: thumbnail storage and payload contract

- [x] 2.1 Add an optional `thumbnailKey` field to the saved-card record in `backend/src/lib/cardPayload.ts`; accept and validate an optional base64 thumbnail on save (size cap + image content-type check), rejecting only the thumbnail (not the whole save) when invalid
- [x] 2.2 Update `backend/src/lib/cardPayload.contract.test.ts` and `frontend/src/lib/savedCard.contract.test.ts` together for the new `thumbnailKey` field (per the AGENTS.md definition of done)
- [x] 2.3 Save-card route: when a thumbnail is supplied, PUT it to `s3://<thumbnail-bucket>/{cardId}.png`, store the key on the card record, and overwrite on re-save
- [x] 2.4 List-cards route: for each card with a `thumbnailKey`, mint a short-TTL presigned GET URL after `requireCardRole` authorizes the caller; return it alongside the card
- [x] 2.5 Delete-card route: after the existing cleanup, DELETE the card's thumbnail object (tolerate already-missing)
- [x] 2.6 Confirm no thumbnail bytes are logged (respect the "logs exclude sensitive values" requirement)

## 3. Frontend: API client

- [x] 3.1 Extend `saveCard` in `frontend/src/lib/cardsApi.ts` to accept an optional thumbnail (base64 PNG) on the save request
- [x] 3.2 Extend the list-cards response shape to include the presigned GET URL per card (when present)
- [x] 3.3 Update `frontend/src/lib/savedCard.ts` with the optional `thumbnailKey` field and the presigned-URL field on the listed-card shape

## 4. Frontend: thumbnail generation on save

- [x] 4.1 In the editor save flow (`App.tsx` / `CardView.tsx`), reuse the existing `html-to-image` `toPng` path to render a downscaled thumbnail (reduced `pixelRatio` / target size) before sending the save request
- [x] 4.2 Handle generation failure by proceeding with the save without a thumbnail (do not block the save)

## 5. Frontend: library grid

- [x] 5.1 Replace the `List` in `frontend/src/pages/SavedCardsPage.tsx` with a responsive `Grid`/`ImageList`; each cell shows the thumbnail `<img>` (or placeholder when none), title, and timestamp
- [x] 5.2 Add a per-cell `IconButton` menu with rename, delete, and "Manage share links" actions
- [x] 5.3 Render existing rename and delete flows from the menu; keep the inline rename UX

## 6. Frontend: share management from the library

- [x] 6.1 Open `ShareLinkDialog` from `SavedCardsPage` scoped to the selected card's id; bypass the `onSaveFirst` path (cards are already saved)
- [x] 6.2 If `remove-card-url-sharing` has shipped first, rewrite `ShareLinkDialog`'s signed-out message (currently references a "Copy card link" alternative that no longer exists); otherwise leave it untouched

## 7. CSP and headers

- [x] 7.1 Widen `img-src` in the response-headers policy (`infra/main.tf`) to include the thumbnail bucket's S3 regional domain; use a per-environment literal (preferred) or a scoped wildcard, and document why it is environment-aware

## 8. Tests and verification

- [x] 8.1 Run `npm run lint`, `npm test`, and `npm run build` from both `frontend/` and `backend/`; confirm all pass
- [x] 8.2 Manually verify: saving a card produces a thumbnail visible in the grid; re-saving updates it; an existing card without a thumbnail shows a placeholder; the per-card menu creates/lists/copies/revokes share links without opening the editor; deleting a card removes its thumbnail; a thumbnail fetch by a non-owner is refused
