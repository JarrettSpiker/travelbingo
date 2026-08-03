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
