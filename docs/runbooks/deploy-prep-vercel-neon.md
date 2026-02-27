# Deploy Prep Checklist (Vercel + Neon)

Scope: readiness checks only (no provisioning steps).

## Backend Readiness

- `bookshelf_backend` package path is `apps/backend/src/bookshelf_backend`.
- Migrations exist and apply cleanly from `apps/backend/migrations`.
- Runtime does not auto-create or patch schema at startup.
- Production guards enabled:
  - `BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK=false`
  - `DATABASE_URL` required
- CORS origins explicitly set via `BOOKSHELF_ALLOWED_ORIGINS`.

## Client Readiness

- Deployable client is `apps/client`.
- Expo web target runs locally (`npm run web`).
- Client uses shared parser via `@bookshelf/scanner-core` path alias.

## Tooling Readiness

- `tools/web-harness` and `tools/scanner-core` are non-deployable tools only.
- Scanner-core tests pass.

## Quality Gates

- Backend tests pass.
- Backend lint and format checks pass.
- Client typecheck passes.
- Web harness build passes.
- Scanner-core tests pass.

## Artifact Hygiene

- No tracked runtime outputs (`outputs/`, local DBs, model binaries).
- No tracked build artifacts (`dist/`, `*.tsbuildinfo`, generated vite config files).
- `.gitignore` covers node modules, env files, caches, and local runtime files.
