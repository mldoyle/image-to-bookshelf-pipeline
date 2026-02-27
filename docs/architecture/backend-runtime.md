# Backend Runtime

## Service Entry Points

- Package: `bookshelf_backend`
- App factory: `bookshelf_backend.app.factory:create_app`
- CLI API command: `bookshelf-backend-api`
- CLI service command: `bookshelf-backend serve`

## Route Modules

- `routes/health.py`: `/`, `/health`
- `routes/search.py`: `/books/search`
- `routes/scan.py`: `/detect/spines`, `/scan/capture`
- `routes/library.py`: `/library/me/*`

All routes are registered by `app/factory.py`.

## Service Layer

- `services/detector_service.py`: lazy detector initialization
- `services/extractor_service.py`: lazy extractor initialization
- `services/google_books_service.py`: lookup client + compact payload mapping

## Configuration

`config/settings.py` loads defaults and env values.

- `BOOKSHELF_ENV=development|production`
- `BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK` (defaults to true in development, false in production)
- `BOOKSHELF_SCAN_ENABLED`
- `BOOKSHELF_ALLOWED_ORIGINS`
- `BOOKSHELF_MODEL_PATH`
- `BOOKSHELF_LOOKUP_TIMEOUT`
- `BOOKSHELF_LOOKUP_MAX_RESULTS`
- `DATABASE_URL`

## Production Guards

- Startup fails when `BOOKSHELF_ENV=production` and dev identity fallback is enabled.
- Startup fails when `BOOKSHELF_ENV=production` and database URL is missing.

## Database Lifecycle

- Runtime no longer performs `db.create_all()` or schema mutation patches.
- Schema changes run through Alembic/Flask-Migrate only.
- Migration scripts live under `apps/backend/migrations`.
