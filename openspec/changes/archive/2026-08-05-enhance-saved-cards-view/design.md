## Context

The saved-cards library (`frontend/src/pages/SavedCardsPage.tsx`) is today a flat MUI `List`: each row shows a title and a timestamp, plus inline rename and delete icons. Sharing a card requires opening it into the editor and invoking the Export menu's share action, which opens `ShareLinkDialog` (`frontend/src/components/ShareLinkDialog.tsx`). That dialog already takes a `cardId` prop and talks to the share-link API directly; it is coupled to the editor only through its `onSaveFirst` callback (the "save first if unsaved" path at lines 49-67).

Card data flows through a mirrored pair of payload modules — `backend/src/lib/cardPayload.ts` and `frontend/src/lib/savedCard.ts` — held in sync by two contract tests (`backend/src/lib/cardPayload.contract.test.ts` and `frontend/src/lib/savedCard.contract.test.ts`). Any stored-shape change must update both halves and both tests together (AGENTS.md, definition of done).

The existing static-asset bucket (`infra/main.tf`) is hard-wired for public-via-CloudFront delivery: full public-access block, a bucket policy granting `s3:GetObject` only to `cloudfront.amazonaws.com` scoped to the distribution, and no writer path. It is unsuitable for owner-private card thumbnails. The Lambda execution role (`infra/bootstrap/lambda-roles.tf`) currently has DynamoDB and logs permissions only — no S3 access. Per-environment wiring flows through the `envs` local in `infra/bootstrap/tfc-roles.tf` (each env carries `role_suffix`, `table_name`, `function_name`).

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Library becomes a visual grid of thumbnails with per-card title/timestamp/menu.
- Full share-link management (create/list/copy/revoke) reachable from each grid cell, reusing `ShareLinkDialog`.
- Thumbnails generated client-side on save, stored in a dedicated private bucket, read via short-TTL presigned GET.
- Thumbnail privacy equivalent to card-data privacy: same `requireCardRole` check, never publicly readable.
- Existing cards without thumbnails degrade gracefully (placeholder), no backfill.

**Non-Goals:**
- No backfill job for existing cards (the backend cannot render; thumbnails populate as users re-save).
- No client-to-S3 direct upload (Lambda-mediated writes only).
- No change to share-link semantics, snapshot behavior, or token format.
- No change to PNG/PDF export from the editor.
- No new CDN/cache behavior for thumbnails — presigned GETs go directly to S3.

## Decisions

### Decision: Dedicated private bucket over reusing the static-asset bucket
**Choice: New dedicated private S3 bucket.**
- The static-asset bucket's CloudFront is unauthenticated; thumbnails of owner-private cards must not be world-readable. Reusing that bucket would force either (a) accepting capability-URL privacy (unguessable key = the only barrier), or (b) bolting a presigned-GET model onto a bucket wired for public CDN delivery, with CSP and lifecycle entanglement.
- A dedicated bucket gives clean isolation: independent lifecycle, independent blast radius, simpler IAM reasoning. Per-bucket cost is negligible (~$0.003/mo + storage, identical either way).
- *Alternatives considered:* (1) existing bucket with unguessable keys as capability URLs — rejected on privacy grounds; (2) existing bucket with presigned GETs — rejected for conflating two access models; (3) new bucket behind a second CloudFront behavior with signed URLs — overkill for thumbnails.

### Decision: Lambda-mediated thumbnail writes
**Choice: Thumbnail bytes ride on the save-card request; the backend writes to S3.**
- One atomic save (card data + thumbnail land together or fail together). No two-step presign dance. No `connect-src` CSP change for uploads — the upload stays same-origin to `/api/`.
- A thumbnail is small (~16-32KB PNG, base64 ~43KB), well under API Gateway HTTP API's 10MB body limit. The existing payload validator (`cardPayload.ts`) bounds it explicitly.
- *Alternative considered:* presigned PUT (client uploads directly to S3). Avoids the API payload size, but adds a two-step flow and forces `connect-src` to widen to the S3 domain. Rejected as more moving parts for a small payload.

### Decision: Presigned GET for reads
**Choice: The backend mints short-TTL presigned GET URLs at list time; the browser renders `<img src=presigned>`.**
- Routing reads through the API would be N Lambda invocations per library render — unacceptable. Presigned GET pushes the fetch to S3 directly.
- The presign happens only after `requireCardRole` authorizes the caller for that card; a client-supplied key is never trusted (consistent with `backend-api`'s "identity derived only from verified credentials" requirement).
- *Consequence:* **CSP `img-src` must widen** to the thumbnail bucket's S3 regional domain. Bucket names are environment-specific, so the CSP value is environment-aware — either a scoped wildcard (`https://*.s3.<region>.amazonaws.com`) or a per-env literal injected into the response-headers policy in `infra/main.tf`.

### Decision: Reuse `ShareLinkDialog` from the library
**Choice: Render the existing `ShareLinkDialog` from `SavedCardsPage`, scoped to the cell's card.**
- The dialog already takes `cardId` and `onClose` props and talks to the API directly. From the library, the card is always already saved, so the `onSaveFirst` callback (lines 49-67) is never invoked — the dialog effectively runs in already-saved mode without code changes to its internals.
- *Caveat:* the dialog's signed-out message (lines 90-93) references "Copy card link" as an account-free alternative. That feature is removed by `remove-card-url-sharing`. If that change has shipped first, the message must be rewritten here; if not, leave it. See Sequencing.

### Decision: Grid layout
**Choice: Replace `List` with a responsive MUI `Grid`/`ImageList`.**
- Each cell: thumbnail `<img>` (or placeholder), title, timestamp, and an `IconButton`-driven per-card menu (rename / delete / manage share links).
- Rename stays inline (existing flow), triggered from the menu.

### Decision: Thumbnail generation timing
**Choice: Generate on save, client-side, reusing the existing `html-to-image` `toPng` path.**
- `CardView` already uses `toPng` for PNG export (`CardView.tsx` lines 70-88). The save flow calls the same path at a reduced `pixelRatio` / downscaled target size to bound the bytes, then sends the result with the save-card request.
- A generation failure does not block the save — the card is stored without a thumbnail and the library shows a placeholder.

## Risks / Trade-offs

- **[CSP widening for `img-src`]** → Unavoidable for presigned-S3 reads short of a second CloudFront behavior. Mitigation: scope the CSP entry tightly (per-env literal preferred over a broad wildcard) and document why it is environment-aware.
- **[Thumbnail privacy must hold]** → The thumbnail is derived from card contents. Mitigation: private bucket, presigned GET only, `requireCardRole` before any presign, and the `backend-api` "logs exclude sensitive values" requirement extends to thumbnail bytes (codified in the new validation requirement).
- **[`ShareLinkDialog` couples to editor dirty-state]** → Mitigation: from the library the `onSaveFirst` path is unreachable (card is already saved). No internal change to the dialog is needed for the happy path; only the signed-out message text may need updating depending on sequencing.
- **[Save payload grows by ~43KB]** → Acceptable for a small thumbnail. Mitigation: explicit size bound in `cardPayload.ts`; oversized/malformed thumbnails are rejected while the rest of the card still saves.
- **[Existing cards have no thumbnail]** → Mitigation: placeholder render; no error path; no backfill (backend cannot render). Thumbnails populate naturally as users re-save.
- **[Per-environment bucket wiring]** → The `envs` local in `infra/bootstrap/tfc-roles.tf` needs a `thumbnail_bucket_name` per env; the Lambda role policy (`lambda-roles.tf`) gets a new S3 statement scoped to it. Both dev and prod must be wired before the feature is useful.

## Migration Plan

- **Infra first:** create the thumbnail bucket and grant the Lambda role S3 permissions in `infra/bootstrap/`. Apply via the normal Terraform workflow. This is additive and independently safe.
- **Backend second:** ship save-card (accept+store thumbnail), list-cards (mint presigned GET), delete-card (remove thumbnail). The new fields are optional, so the backend is backward-compatible with the current frontend.
- **Frontend last:** grid layout, thumbnail generation on save, presigned-`<img>` rendering, per-card share menu. Once this ships, the feature is live.
- **Rollback:** the backend tolerates a frontend that does not send thumbnails (field optional); the frontend tolerates a backend that does not return presigned URLs (placeholder shown). Each layer can roll back independently without breaking the other.

## Sequencing

Recommended order across the two proposals: **`remove-card-url-sharing` first, then this change.** The only hard interaction is `ShareLinkDialog`'s signed-out message, which references the feature the other change removes. If this change lands first, leave that message untouched; it is still accurate until the other change ships.

## Open Questions
<!-- none -->
