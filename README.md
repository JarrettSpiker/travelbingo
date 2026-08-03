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

Sign-in is Google-only by design, so there is no way to create a user directly in Cognito and no reason to want one — the pool has no password flow at all.

> **Gmail plus-aliases do not work.** `you+test1@gmail.com` is the *same* Google account as `you@gmail.com`. It returns the same Google subject, so Cognito maps it to a single user. You would appear to have two accounts and actually have one — and a permissions test run that way passes for the wrong reason.

To let someone sign in while the OAuth consent screen is still in Testing mode, add their Google address under **Google Cloud Console → OAuth consent screen → Test users** (capped at 100). Publishing the consent screen removes that restriction and needs no Google verification review, because `openid`, `email`, and `profile` are all non-sensitive scopes.

**Testing that one user cannot read another's cards requires a second, genuinely separate Google account.** That check — user B requesting user A's card and getting a 404, not a 403 and not the card — is the security property the whole accounts feature rests on, so it is worth the two minutes of creating a real second account rather than approximating it.

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
