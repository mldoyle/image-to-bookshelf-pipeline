# Bookshelf Backend

Flask backend service for bookshelf scan, lookup, and library APIs.

## Commands

```bash
# from apps/backend
../../.venv/bin/pip install -e .[dev]
./scripts/migrate-up.sh
bookshelf-backend-api --host 0.0.0.0 --port 5001
```

## Test and Lint

```bash
../../.venv/bin/pytest -q
../../.venv/bin/ruff check src tests
../../.venv/bin/black --check src tests
```

## Key Runtime Flags

- `BOOKSHELF_ENV=development|production`
- `BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK=true|false`
- `BOOKSHELF_SCAN_ENABLED=true|false`
- `BOOKSHELF_ALLOWED_ORIGINS=*` (dev default)
- `DATABASE_URL` (required in production)
