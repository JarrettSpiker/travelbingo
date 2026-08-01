# AGENTS.md

Guidance for AI coding agents (and humans) working in this repo.

## Project overview

Bingo Card Generator: a **client-side-only** webapp that turns a list of words
or phrases into randomized, printable bingo cards. There are **no accounts, no
backend, and no persistence** — everything runs in the browser, and cards are
shared by encoding their state into a URL. Originally built from the OpenSpec
change in `openspec/changes/add-bingo-card-generator/`.

## Repository layout

- `frontend/` — React 19 + TypeScript + Vite app. All card-generation and
  rendering logic lives here.
  - `src/lib/` — pure, framework-agnostic logic (`bingo.ts`, `cardUrl.ts`,
    `colorScheme.ts`, `fontScheme.ts`), each with a co-located `*.test.ts`.
  - `src/components/` — MUI v9 React components.
  - `src/theme.ts` — shared MUI theme.
- `infra/` — Terraform config: S3 + CloudFront (optional ACM/Route53 for a
  custom domain). No compute, no database.
- `openspec/` — spec-driven change proposals, designs, specs, and tasks.
- `.claude/`, `.opencode/`, `.pi/` — agent tooling (OpenSpec skills/commands),
  **not** application code.

## Tech stack

- **Runtime:** Node.js 20+ (developed against Node 22).
- **Frontend:** React 19, Vite, TypeScript, MUI v9 + Emotion.
- **Lint/format:** Oxlint.
- **Tests:** Vitest.
- **Infra:** Terraform ≥ 1.5.0, AWS (S3, CloudFront, optional ACM/Route53).

TypeScript is configured fairly strict (`verbatimModuleSyntax`,
`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`,
`allowImportingTsExtensions`). Respect these settings in new code.

## Commands

> ⚠️ All frontend commands run **from the `frontend/` directory**, not the repo
> root. There is no root-level `package.json`.

```bash
cd frontend
npm install      # one-time
npm run dev      # Vite dev server with HMR (http://localhost:5173)
npm run lint     # Oxlint
npm test         # Vitest, runs once
npm run build    # tsc -b && vite build → dist/
npm run preview  # serve the production build locally
```

Infrastructure (see `infra/README.md` for the full workflow):

```bash
cd infra
terraform init
terraform plan  -var="bucket_name=<globally-unique-bucket>"
terraform apply -var="bucket_name=<globally-unique-bucket>"
```

## Architectural constraints (do not break)

- **Client-side only.** Do not add a server, database, or network calls for
  core features. Generation happens entirely in the browser.
- **Nothing is persisted** except state encoded into the share URL
  (`src/lib/cardUrl.ts`). If you add user-facing app state, make it round-trip
  through `encodeCardToUrl` / `decodeCardFromUrl`.
- Keep card-generation and data logic **pure and in `src/lib/`** so it stays
  unit-testable and free of React/DOM dependencies.

## Code conventions

- New pure logic → `src/lib/`; new UI → `src/components/`.
- Co-locate tests next to source: `foo.ts` ↔ `foo.test.ts`.
- Styling via MUI + Emotion and `src/theme.ts`; follow the patterns in
  `App.tsx` and the existing components.
- Prefer named exports and explicit `type`/`interface` declarations, matching
  the existing style.

## Testing conventions

- Vitest, with test files co-located alongside the code they cover.
- Add tests for any new `src/lib/` logic. A feature isn't done until
  `npm test` passes.

## Definition of done

Before considering work complete, run from `frontend/`:

```bash
npm run lint
npm test
npm run build
```

All three must pass. There is no CI yet, so the local gate is the only gate.

## OpenSpec workflow

Substantive changes should go through OpenSpec: a proposal, design, specs, and
task list under `openspec/changes/`. Agent commands/skills are available for
propose, apply, update, sync, archive, and explore. Treat the specs as the
source of intent for what the app should do.

## Gotchas

- No root `package.json` — don't run `npm` at the repo root.
- `.opencode/node_modules/`, `.claude/`, and `.pi/` are tooling, not app code;
  leave them alone unless intentionally changing the agent setup.
- Single `main` branch; no CI is configured.
