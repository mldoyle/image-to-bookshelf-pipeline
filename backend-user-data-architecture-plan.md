# Backend User Data Architecture Plan (Current State + Roadmap)

## 1) Current baseline (as implemented)

The backend is no longer stateless. It now includes a working relational persistence layer and user-library endpoints.

Implemented now:

- Flask app with scan + lookup + library routes.
- SQLAlchemy models for:
  - `users`
  - `books`
  - `user_books`
  - `library_memberships`
- Automatic DB initialization at API startup (`db.create_all()`).
- SQLite default DB at `data/dev.db`, with `DATABASE_URL` override support.
- Library CRUD endpoints:
  - `GET /library/me/books`
  - `POST /library/me/books`
  - `POST /library/me/books/batch`
  - `PATCH /library/me/books/:id`
  - `DELETE /library/me/books/:id`

Also implemented:

- `POST /detect/spines`
- `POST /scan/capture`
- `GET /books/search`
- `GET /health`

## 2) Current constraints

1. Authentication is still deferred.
- `/library/me/*` resolves to a dev identity fallback unless headers are provided.
- Supported override headers:
  - `X-Bookshelf-User-Email`
  - `X-Bookshelf-Username`

2. Migrations are not yet the primary schema mechanism.
- Current startup path uses `create_all()` for table creation.
- Alembic migration flow is still a follow-up hardening task.

3. Client sync model is cache-first.
- Mobile sync happens on app startup/API URL change.
- No live push/event channel yet for cross-device changes.

## 3) Recommended architecture direction

Keep a modular Flask monolith and harden in place.

Layers:

1. API blueprints by domain:
- `scan`
- `library`
- future: `auth`, `users`, `memberships`

2. Services:
- domain-level rules for dedupe, ownership, merge behavior, privacy filters.

3. ORM + repositories:
- SQLAlchemy models/query helpers.

4. Migration layer:
- Alembic migrations as source of truth after stabilization.

5. Optional background jobs (phase 2+):
- long-running imports, retries, notifications.

## 4) Data model status

Current model already aligns with the intended shape:

- `users`: identity + visibility + activation fields.
- `books`: canonical metadata (shared across users).
- `user_books`: user-specific state (`loaned`, `rating`, `review`, `shelf`, `status`, timestamps).
- `library_memberships`: follower/followed relationship skeleton.

Recommended near-term additions:

- explicit auth/session tables or token revocation store.
- optional `library_access_requests` for private libraries.
- optional scan/import provenance table for traceability and replay.

## 5) API roadmap

### Already shipped

- Scanning and lookup:
  - `POST /detect/spines`
  - `POST /scan/capture`
  - `GET /books/search`
- Library:
  - `GET /library/me/books`
  - `POST /library/me/books`
  - `POST /library/me/books/batch`
  - `PATCH /library/me/books/:id`
  - `DELETE /library/me/books/:id`

### Next endpoints

Auth:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

User profile:

- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:user_id` (privacy filtered)

Memberships:

- `POST /memberships/:user_id/follow`
- `DELETE /memberships/:user_id/follow`
- `GET /memberships/me/following`
- `GET /memberships/me/followers`

Private library access (if required):

- `POST /library/access-requests/:user_id`
- `GET /library/access-requests/incoming`
- `GET /library/access-requests/outgoing`
- `POST /library/access-requests/:id/approve`
- `POST /library/access-requests/:id/reject`

## 6) Implementation phases

### Phase A: Identity hardening

1. Add real auth (JWT or cookie-session).
2. Replace dev identity fallback for production flows.
3. Enforce ownership checks with authenticated `user_id`.

### Phase B: Schema and migration hardening

1. Add Alembic and baseline migration from current schema.
2. Move schema evolution off `create_all()` and onto migrations.
3. Add migration validation in CI.

### Phase C: Sync and collaboration

1. Add manual refresh endpoint usage in mobile UI.
2. Add foreground re-sync and optional polling.
3. Optional server-sent events/websocket channel for live cross-device updates.

### Phase D: Privacy and social graph

1. Complete membership follow/unfollow and visibility checks.
2. Add private-library access request workflow if needed.
3. Add block and abuse controls.

### Phase E: Observability and reliability

1. Add structured request logging and correlation IDs.
2. Add rate limits on auth/search routes.
3. Add retry/idempotency strategy for batch upserts.

## 7) Security baseline

1. Hash passwords with `argon2` or `bcrypt`.
2. Require auth on user/membership/library routes (except local dev mode).
3. Keep PII out of non-essential responses.
4. Add brute-force protection on auth endpoints.
5. Apply strict CORS allow-lists outside local development.

## 8) Testing roadmap

1. Model tests:
- constraints, uniqueness, cascade behavior.

2. API tests:
- auth rules, ownership rules, library CRUD semantics.

3. Migration tests:
- upgrade/downgrade on clean and seeded DBs.

4. Integration tests:
- scan-to-library import path and dedupe behavior.

5. Multi-client sync tests:
- two clients writing/reading same user, stale-cache scenarios.

## 9) Decision log

Confirmed:

1. Keep PostgreSQL as target non-test DB; SQLite remains default local dev fallback.
2. Keep canonical shared `books` + per-user `user_books`.
3. Keep `user_id + book_id` uniqueness for library dedupe.
4. Keep explicit user confirm/select before persistence from capture flow.

Open decisions:

1. Auth transport preference (JWT access/refresh vs cookie-session).
2. Real-time sync mechanism priority (manual refresh only vs polling vs push).
3. Access control model for private libraries (invite vs request-based only).
4. Soft-delete policy for users and library items.
