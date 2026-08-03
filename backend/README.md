# Backend

The API behind the account features: saved cards and share links. A single Node
22 Lambda (arm64) behind an API Gateway HTTP API, reached same-origin at
`/api/*` through the app's existing CloudFront distribution.

Nothing about card *generation* lives here. That stays in the browser, and the
app is fully usable without ever calling this service.

## Commands

This is an independent npm package — there is no root `package.json`, and
`frontend/` and `backend/` are deliberately **not** npm workspaces (workspaces
hoist `node_modules`, which would break the deploy workflow's
`cache-dependency-path`).

```bash
cd backend
npm install
npm run lint     # Oxlint
npm test         # Vitest
npm run build    # tsc -b (type-check only) && esbuild → dist/index.mjs
```

## Layout

- `src/index.ts` — Lambda entrypoint. Nothing but wiring.
- `src/router.ts` — route table, body parsing and size limit, error mapping.
- `src/auth.ts` — **the** authorization module. See below.
- `src/context.ts` — the dependency-injection seam (`ddb`, `now`, `randomBytes`).
- `src/routes/` — one module per resource.
- `src/lib/keys.ts` — the only module that knows the DynamoDB key format.
- `src/lib/cardPayload.ts` — validation of untrusted card payloads.
- `src/testing/fakeDdb.ts` — in-memory DynamoDB stand-in used by the tests.

## The rules that matter

**Identity comes only from the verified JWT.** `getUserId` reads the `sub` claim
that API Gateway's authorizer has already validated — signature, issuer,
audience, and expiry — before this code runs. A user id in a request body, path,
query string, or header is never trusted.

**There is one authorization check.** Every read and write of a card goes
through `requireCardRole(deps, userId, cardId, allowed)`. Do not write a
per-endpoint permission check. Roles are passed in so that adding an editor or
viewer role later does not touch the call sites.

**A missing membership returns 404, not 403.** Returning 403 for "this card
exists but is not yours" would confirm that another user's card id is real.
403 is only for a caller who *does* hold a membership whose role is
insufficient — which tells them nothing they did not already know.

**Validation rejects; it does not repair.** `cardPayload.ts` mirrors the bounds
and allowlists in `frontend/src/lib/cardUrl.ts`, but with the opposite failure
mode. The frontend substitutes defaults because a half-broken card beats a blank
page. Persisted state gets no such courtesy: storing a silently corrected
payload would keep something the user never authored.

## The duplicated types

`CardUrlData`, the font allowlist, and the color rule exist in both packages
with no compile-time link between them. This is the largest accepted piece of
technical debt in the accounts change (see
`openspec/changes/add-user-accounts/design.md`).

`src/lib/cardPayload.contract.test.ts` and
`frontend/src/lib/savedCard.contract.test.ts` pin the same literal wire shape.
**If you change one, change both** — those two tests are the only thing that
makes divergence fail CI instead of silently corrupting stored cards.

## Data model

One DynamoDB table, keyed `PK`/`SK`, no GSIs. Entities are distinguished by key
prefix, so a new entity type costs no Terraform, IAM, or deploy change.

```
CARD#<cardId>   META            ownerId, title, slots[], ..., payloadVersion
USER#<sub>      CARD#<cardId>   role, title, updatedAt      <- title denormalized
CARD#<cardId>   MEMBER#<sub>    role, createdAt
CARD#<cardId>   SHARE#<token>   createdAt                   <- owner-facing pointer
SHARE#<token>   META            cardId, ownerId, snapshot{}, createdAt
USER#<sub>      PROFILE         email, googleSubject, createdAt, lastSeenAt
```

`title` is denormalized onto the membership item so that listing a user's cards
is a **single** Query with no per-card lookup. Rename and replace therefore
write both items in one `TransactWriteItems`, which makes drift impossible.

Membership is its own item even though `owner` is the only role today, so that
shared card pools are additive rather than a migration.

The access-pattern table in `design.md` is a maintained artifact: any new entity
type or query belongs there, in the same change that introduces it.

## Deployment

Terraform creates the function with a placeholder zip and then ignores its code
attributes. `.github/workflows/_deploy-backend.yml` ships the real code with
`aws lambda update-function-code`. A backend fix therefore never requires an
infrastructure apply, and never waits on the manual prod-apply gate.
