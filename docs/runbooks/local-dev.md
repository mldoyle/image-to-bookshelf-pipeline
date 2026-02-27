# Local Development Runbook

## Prerequisites

- Python 3.10+
- Node.js + npm

## Backend Setup

```bash
cd apps/backend
python3 -m venv ../../.venv
source ../../.venv/bin/activate
pip install -e .[dev]
./scripts/migrate-up.sh
bookshelf-backend-api --host 0.0.0.0 --port 5001
```

## Client Setup

```bash
cd apps/client
npm install
npm run web
```

## Web Harness Setup

```bash
cd tools/web-harness
npm install
npm run dev
```

## Scanner Core Setup

```bash
cd tools/scanner-core
npm install
npm test -- --run
```

## Smoke Checks

- Backend health: `curl http://127.0.0.1:5001/health`
- Books search (requires API key): `curl 'http://127.0.0.1:5001/books/search?q=dune'`
- Library fallback in dev: `curl http://127.0.0.1:5001/library/me/profile`

## Common Fixes

- Migration state drift: run `./scripts/migrate-down.sh -1` then `./scripts/migrate-up.sh`.
- Identity failures in production-like mode: set `X-Bookshelf-User-Email` header.
