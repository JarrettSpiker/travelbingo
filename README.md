# Bingo Card Generator

A webapp for turning a custom list of words or phrases into a set of randomized, printable bingo cards. No accounts, no saved cards — everything runs client-side in the browser.

See `openspec/changes/add-bingo-card-generator/` for the full proposal, design, specs, and task list this app was built from.

## Project structure

- `frontend/` — React + TypeScript app (Vite). All card generation and rendering logic lives here; nothing is persisted.
- `infra/` — Terraform config to provision static hosting (S3 + CloudFront) on AWS.

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

### Available scripts

Run these from the `frontend/` directory:

- `npm run dev` — start the Vite dev server with HMR
- `npm run build` — type-check and produce a production build in `dist/`
- `npm run preview` — serve the production build locally to verify it
- `npm run lint` — lint the source with Oxlint
- `npm test` — run the test suite once with Vitest

### Tests

```bash
cd frontend
npm test
```

## Deploying

See `infra/README.md` for the Terraform workflow to provision hosting and deploy the built frontend.
