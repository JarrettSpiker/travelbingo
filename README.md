# Bingo Card Generator

A webapp for turning a custom list of words or phrases into a set of randomized, printable bingo cards. No accounts, no saved cards — everything runs client-side in the browser.

See `openspec/changes/add-bingo-card-generator/` for the full proposal, design, specs, and task list this app was built from.

## Project structure

- `frontend/` — React + TypeScript app (Vite). All card generation and rendering logic lives here; nothing is persisted.
- `infra/` — Terraform config to provision static hosting (S3 + CloudFront) on AWS.

## Running locally

```bash
cd frontend
npm install
npm run dev
```

Then open the printed local URL (typically http://localhost:5173).

### Tests

```bash
cd frontend
npm test
```

## Deploying

See `infra/README.md` for the Terraform workflow to provision hosting and deploy the built frontend.
