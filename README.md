# Bingo Card Generator

A webapp for turning a custom list of words or phrases into a set of randomized, printable bingo cards.

Building, randomizing, printing, and sharing a card all run client-side in the browser and need no account. Sign in with Google if you also want to **save cards** and send someone a **revocable link** to a copy — but every card feature works signed out, and the shareable `?card=` URL is not going away.

See `openspec/changes/add-bingo-card-generator/` for the proposal this app was built from, and `openspec/changes/add-user-accounts/` for the accounts layer.

## Project structure

- `frontend/` — React + TypeScript app (Vite). All card generation and rendering logic lives here, and it runs entirely in the browser.
- `backend/` — Node 22 TypeScript Lambda serving `/api/*`: saved cards and share links. Only account features touch it.
- `infra/` — Terraform config for hosting (S3 + CloudFront) and the account backend (DynamoDB, Cognito, Lambda, API Gateway).

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org/) 20 or newer (this repo is developed against Node 22)
- npm (bundled with Node.js)

Verify your setup:

```bash
node --version
npm --version
```

### Start the dev server

All app code lives in `frontend/`. Install dependencies once, then start Vite:

```bash
cd frontend
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173). The dev server supports hot module reloading, so saved changes appear in the browser automatically. Stop it with `Ctrl+C`.

The card editor works fully with no further setup. **Account features are off unless you configure them**, which is deliberate — a missing configuration hides the account UI rather than breaking the app. To enable them locally, create `frontend/.env.local` (already gitignored):

```
VITE_COGNITO_DOMAIN=travelbingo-dev.auth.us-east-1.amazoncognito.com
VITE_COGNITO_CLIENT_ID=<the dev SPA client id>
VITE_APP_ORIGIN=http://localhost:5173
VITE_API_TARGET=https://dev.travelbingo.ca
```

The first three come from the dev Terraform outputs (`cognito_domain`, `cognito_user_pool_client_id`). `VITE_API_TARGET` points the dev server's `/api` proxy at a deployed environment, so the API stays same-origin exactly as it is in production.

Sign-in works from localhost with no OAuth client of its own — and cannot have one. The Google client's redirect URI points at *Cognito's* hosted domain, never at the app, so Google never learns where the app is running. The flow is localhost → Cognito hosted UI → Google → Cognito → back to localhost, which works because `infra/cognito.tf` registers `http://localhost:5173/auth/callback` on the dev pool.

#### What local development is, and isn't

Running locally gives you the **local frontend against the deployed dev backend**. That is a deliberate trade-off, and it has consequences worth knowing before you rely on it:

- **You share dev's data and users — it is not a copy.** Same Cognito pool, same DynamoDB table. Cards you save locally are real dev rows, and deleting one locally deletes it for real.
- **You cannot run the backend locally.** `backend/` has no dev server, only `lint`, `test`, and `build`. A backend change has to be deployed to dev before you can exercise it end to end; until then, its unit tests are the feedback loop.
- **Port 5173 is load-bearing.** The registered redirect URI is exactly that port. If Vite falls back to 5174 because 5173 is busy, sign-in fails at Cognito with a redirect mismatch — free the port rather than accepting the fallback.
- **There is no Content-Security-Policy locally.** It is applied by CloudFront, and Vite serves your local app directly, so a CSP violation stays invisible until it is deployed.
- **Share links copy as `http://localhost:5173/s/<token>` URLs.** The token is real and stored in dev, but the URL is only useful to you.
- **CloudFront behaviour cannot be tested locally at all.** Vite runs its own single-page-app fallback and will happily serve `/s/anything`, whether or not the CloudFront Function is correct. Those checks only mean something against a deployed environment.

### Test accounts

Sign-in is Google-only by design. For **testing** in dev, `scripts/dev-user.sh` creates identities directly, so you don't need a Google account per test user:

```bash
scripts/dev-user.sh create alice     # -> alice@example.com
scripts/dev-user.sh create bob
scripts/dev-user.sh list
scripts/dev-user.sh delete alice
```

It prints two things: an `export TOKEN=…` line for `curl`, and a one-line `localStorage.setItem(…)` snippet. Paste that snippet into the devtools console on `http://localhost:5173` or `https://dev.travelbingo.ca` and reload — the app refreshes it into a live session on load, so there is no sign-in screen to get past and both origins work against the one pool. It is re-runnable at any time; a user that already exists is fine.

This works because dev's app client carries the `ALLOW_ADMIN_USER_PASSWORD_AUTH` flow, which **prod deliberately does not have**. It is not a public password login: `AdminInitiateAuth` is an IAM-authorized API, so only someone already holding admin credentials for the AWS account can use it, and the dev hosted UI still offers nothing but the Google button.

> **Gmail plus-aliases do not work.** `you+test1@gmail.com` is the *same* Google account as `you@gmail.com`. It returns the same Google subject, so Cognito maps it to a single user. You would appear to have two accounts and actually have one — and a permissions test run that way passes for the wrong reason. Use the script instead, and note that test emails default to `@example.com`, which is reserved and can never be a real Google account.

Two things to know. Test users write **real rows to the dev table**, and deleting the Cognito user does not remove them — the `sub` is a partition key, so their cards are orphaned rather than cleaned up. And the check worth running first is the one below.

#### Verifying that one user cannot read another's cards

This is the security property the whole accounts feature rests on, so it is worth running rather than assuming. `--token` prints just the access token, so this is copy-pasteable:

```bash
ALICE=$(scripts/dev-user.sh token alice --token)
BOB=$(scripts/dev-user.sh token bob --token)
API=https://dev.travelbingo.ca

CARD='{"slots":["Airport","Dog"],"title":"Alice private","hasFreeSpace":true,"freeSpaceText":"FREE",
"colorScheme":{"backgroundColor":"#ffffff","cellColor":"#eeeeee","textColor":"#1a1a1a","titleColor":"#1a1a1a"},
"fontScheme":{"titleFont":"system-ui, sans-serif","cellFont":"system-ui, sans-serif"},
"emojiScheme":{"emojis":[]}}'

# Alice saves a card and keeps its id
ID=$(curl -s -X POST "$API/api/cards" -H "Authorization: Bearer $ALICE" \
  -H 'Content-Type: application/json' -d "$CARD" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["cardId"])')

curl -s -o /dev/null -w 'alice reads her card: %{http_code}\n' \
  "$API/api/cards/$ID" -H "Authorization: Bearer $ALICE"

curl -s -o /dev/null -w 'bob reads alice card:  %{http_code}\n' \
  "$API/api/cards/$ID" -H "Authorization: Bearer $BOB"

curl -s "$API/api/cards" -H "Authorization: Bearer $BOB"   # bob's own list

curl -s -X DELETE "$API/api/cards/$ID" -H "Authorization: Bearer $ALICE"   # cleanup
```

Expected:

```
alice reads her card: 200
bob reads alice card:  404
{"cards":[]}
```

**404 is the correct answer, not 403.** A 403 would confirm that `$ID` is a real card belonging to someone else, which leaks the existence of other users' data. The API answers identically whether a card does not exist or simply is not yours — so if you ever see a 403 here, that is a regression in `backend/src/auth.ts`, not a cosmetic difference.

For a **human** to sign in to dev while the OAuth consent screen is still in Testing mode, add their Google address under **Google Cloud Console → OAuth consent screen → Test users** (capped at 100). Publishing the consent screen removes that restriction and needs no Google verification review, because `openid`, `email`, and `profile` are all non-sensitive scopes.

### Available scripts

Run these from the `frontend/` directory:

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — serve the production build locally to verify it
- `npm run lint` — lint the source with Oxlint
- `npm test` — run the test suite once with Vitest

### Backend scripts

`backend/` is a separate npm package (there is no root `package.json`, and the two are not npm workspaces):

```bash
cd backend
npm install
npm run lint     # Oxlint
npm test         # Vitest
npm run build    # tsc -b && esbuild → dist/index.mjs
```

### Tests

```bash
cd frontend && npm test
cd ../backend && npm test
```

## Deploying

See `infra/README.md` for the Terraform workflow, the one-time manual prerequisites (Google OAuth clients, HCP workspace variables), and how the GitHub Actions deploys are wired.
