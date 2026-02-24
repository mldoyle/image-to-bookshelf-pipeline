# Bookshelf Scanner

Scan bookshelf images, extract titles/authors, enrich with Google Books metadata, and manage a local library through a Flask API plus mobile/web clients.

## Features

- YOLO-based book spine detection.
- Moondream-based title/author extraction.
- Google Books lookup and compact result shaping.
- Flask API for `/detect/spines`, `/scan/capture`, and `/library/me/*`.
- React Native mobile app and Vite web harness for capture/review workflows.
- SQLite-by-default local persistence (`data/dev.db`), with `DATABASE_URL` override support.

## Setup

```bash
cd /Users/mattdoyle/Projects/image-to-bookshelf
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
```

Optional GPU extras:

```bash
pip install -e ".[gpu,dev]"
```

## Environment

Create `secrets/.env` (optional but recommended):

```bash
GOOGLE_BOOKS_API_KEY=your_google_books_api_key

# Optional DB override
# If omitted, backend defaults to sqlite:///.../data/dev.db
# DATABASE_URL=postgresql://user:password@host:5432/bookshelf
```

## API Startup

Preferred command (uses console script from `pyproject.toml`):

```bash
source .venv/bin/activate
bookshelf-scanner-api --host localhost --port 5001
```

Equivalent module command:

```bash
source .venv/bin/activate
python -m bookshelf_scanner.web_api --host localhost --port 5001
```

For LAN/mobile device access, bind all interfaces:

```bash
bookshelf-scanner-api --host 0.0.0.0 --port 5001
```

## Database Behavior

- Default DB: `data/dev.db` (created automatically).
- Tables are auto-created on startup.
- `DATABASE_URL` overrides SQLite default.
- Current library routes use a dev identity fallback when auth headers are absent.

Dev identity headers:

- `X-Bookshelf-User-Email`
- `X-Bookshelf-Username`

If these headers are not sent, all clients use the same default local dev user.

## Core Endpoints

- `GET /health`
- `GET /`
- `GET /books/search`
- `POST /detect/spines`
- `POST /scan/capture`
- `GET /library/me/books`
- `POST /library/me/books`
- `POST /library/me/books/batch`
- `PATCH /library/me/books/:id`
- `DELETE /library/me/books/:id`

## CLI Usage

Extractor:

```bash
python -m bookshelf_scanner.extractor INPUT [OPTIONS]
```

Lookup:

```bash
python -m bookshelf_scanner.lookup outputs/extractions/test.csv --output lookup_outputs.csv
```

Notes:

- `bookshelf-scanner scan ...` is still a placeholder command.
- Use module commands above for active extractor/lookup flows.

## Web Harness Workflow

1. Start backend API on `5000` or `5001`.
2. Run harness:
   - `cd web-harness`
   - `npm install`
   - `npm run dev`
3. In harness:
   - Set detector mode to `endpoint`.
   - Set detector URL to `/detect/spines`.
   - Set capture URL to `/scan/capture`.

## Mobile Workflow

1. Start backend API with LAN-safe host:
   - `bookshelf-scanner-api --host 0.0.0.0 --port 5001`
2. Start Expo app:
   - `cd mobile`
   - `npm install`
   - `npm run start`
3. Use base URLs:
   - Android emulator: `http://10.0.2.2:5001`
   - iOS simulator: `http://127.0.0.1:5001`
   - Physical device: `http://<your-mac-lan-ip>:5001`

## Importing to Goodreads

1. Run extraction:
   - `python -m bookshelf_scanner.extractor outputs/detections/my_shelf_crops --output outputs/extractions/my_shelf.csv`
2. Open [Goodreads Import](https://www.goodreads.com/review/import).
3. Upload CSV and confirm.

## License

MIT
