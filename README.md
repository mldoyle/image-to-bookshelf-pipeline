# Image to Bookshelf Monorepo

Production-oriented monorepo for the Bookshelf stack.

## Repository Layout

- `apps/backend`: Flask backend service (`bookshelf_backend`)
- `apps/client`: Expo application (mobile + web target)
- `tools/web-harness`: Browser harness for detector/scan iteration
- `tools/scanner-core`: Shared TypeScript detection/tracking utilities
- `docs/architecture`: System and repo architecture docs
- `docs/runbooks`: Operational runbooks
- `docs/archive`: Archived plans and baseline artifacts

See [`docs/architecture/repo-structure.md`](docs/architecture/repo-structure.md) for the full tree.

## Quickstart

### 1) Backend

```bash
cd apps/backend
python3 -m venv ../../.venv
source ../../.venv/bin/activate
pip install -e .[dev]
./scripts/migrate-up.sh
bookshelf-backend-api --host 0.0.0.0 --port 5001
```

### 2) Client (Expo)

```bash
cd apps/client
npm install
npm run web
```

### 3) Web Harness

```bash
cd tools/web-harness
npm install
npm run dev
```

### 4) Scanner Core Tests

```bash
cd tools/scanner-core
npm install
npm test -- --run
```

## Deterministic Command Matrix

- Backend tests: `cd apps/backend && ../../.venv/bin/pytest -q`
- Backend lint: `cd apps/backend && ../../.venv/bin/ruff check src tests`
- Backend format check: `cd apps/backend && ../../.venv/bin/black --check src tests`
- Client typecheck: `cd apps/client && npm run typecheck`
- Web harness build: `cd tools/web-harness && npm run build`
- Scanner-core tests: `cd tools/scanner-core && npm test -- --run`

## Key Backend Environment Variables

- `BOOKSHELF_ENV=development|production`
- `BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK=true|false`
- `BOOKSHELF_SCAN_ENABLED=true|false`
- `BOOKSHELF_ALLOWED_ORIGINS=*` (dev default)
- `BOOKSHELF_MODEL_PATH=/path/to/model.pt`
- `DATABASE_URL=...` (required in production)
- `GOOGLE_BOOKS_API_KEY=...`

Production guardrails are enforced:

- Startup fails if `BOOKSHELF_ENV=production` and dev identity fallback is enabled.
- Startup fails if `BOOKSHELF_ENV=production` without a database URL.

## Additional Docs

- Architecture: [`docs/architecture/backend-runtime.md`](docs/architecture/backend-runtime.md)
- Local dev runbook: [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md)
- Deploy prep checklist: [`docs/runbooks/deploy-prep-vercel-neon.md`](docs/runbooks/deploy-prep-vercel-neon.md)
