# Backend User Data Architecture Plan (SQLAlchemy + Relational DB)

## 1) Current codebase baseline (what exists today)

From reviewing the repository, the current backend API is a Flask app focused on scanning and lookup workflows, not account data storage yet.

### Existing API surface
- `GET /health`
- `GET /`
- `GET /books/search`
- `POST /detect/spines`
- `POST /scan/capture`

These are implemented in `src/bookshelf_scanner/web_api.py`, and tests for payload expectations live in `tests/test_web_api.py`.

### Important implication
There is currently no persistence layer for users, social graph, or personal libraries in the backend. The next phase should introduce:
1. DB models + migrations,
2. auth/session strategy,
3. user/library/membership endpoints,
4. separation between scanning services and account/domain services.

---

## 2) Recommended target architecture (incremental, practical)

Use a **modular Flask monolith** (single deployable service) with a relational DB and SQLAlchemy. Keep current scanning endpoints, then add a domain layer for accounts, memberships, and library data.

### High-level components
1. **API layer**
   - Flask blueprints by domain:
     - `auth`
     - `users`
     - `memberships`
     - `library`
     - existing `scan`
2. **Service layer**
   - Business rules (membership lifecycle, dedupe, privacy filters, etc.).
3. **Repository/ORM layer**
   - SQLAlchemy models and query helpers.
4. **DB migration layer**
   - Alembic migrations managed in-repo.
5. **Background jobs (optional phase 2)**
   - for expensive scan/lookup flows or notifications.

### Why this shape
- Lowest operational overhead for MVP.
- Keeps your current Flask investment.
- Easy evolution into separate services later if needed.

---

## 3) Database choice and SQLAlchemy setup

### DB recommendation
- **PostgreSQL** as the primary RDBMS (dev via Docker/local; prod managed DB).
- SQLite only for lightweight local tests if needed.

### SQLAlchemy stack
- SQLAlchemy 2.x declarative models.
- Alembic for migrations.
- Session-per-request pattern in Flask.

### Proposed config additions
- `DATABASE_URL`
- `SQLALCHEMY_ECHO` (dev only)
- `JWT_SECRET` (or equivalent auth secret)
- `CORS_ALLOWED_ORIGINS`

### JWT quick explainer
JWT means **JSON Web Token**. It is a signed token the backend issues after login.
- The client sends it back on later requests (typically in `Authorization: Bearer <token>`).
- The API verifies the signature and reads user/session claims (e.g., user id, expiry).
- Common mobile setup: short-lived access token + longer-lived refresh token.

---

## 4) Domain model (initial schema)

Below is a practical MVP schema for users, library memberships, and personal libraries.

### Core identity tables
1. `users`
   - `id` (UUID PK)
   - `email` (unique, indexed)
   - `username` (unique, indexed)
   - `password_hash`
   - `display_name`
   - `avatar_url` (nullable)
   - `created_at`, `updated_at`
   - `is_active`
   - `library_visibility` (`public`, `private`)

2. `user_profiles` (optional split if you want cleaner identity vs profile)
   - `user_id` (PK/FK to `users`)
   - `bio`, `location`, etc.

### Library membership/social tables
3. `library_memberships`
   - `id` (UUID PK)
   - `follower_user_id` (FK users)
   - `followed_user_id` (FK users)
   - `status` (`active`, `blocked`)
   - `created_at`, `updated_at`
   - unique (`follower_user_id`, `followed_user_id`) for dedupe.
   - check constraint: follower != followed.

4. `membership_activity_events` (phase 2, optional)
   - audit/event feed (book added, status changed, etc.).

5. `library_access_requests` (for private libraries)
   - `id` (UUID PK)
   - `requester_user_id` (FK users)
   - `target_user_id` (FK users)
   - `status` (`pending`, `approved`, `rejected`)
   - `created_at`, `updated_at`, `responded_at` (nullable)
   - unique (`requester_user_id`, `target_user_id`) while pending.

### Library/book tables
6. `books`
   - `id` (UUID PK)
   - `google_books_id` (unique nullable, indexed)
   - `isbn_10`, `isbn_13` (nullable/indexed)
   - canonical metadata (`title`, `subtitle`, `authors_json`, `publisher`, `published_date`, `thumbnail_url`)
   - `created_at`, `updated_at`

7. `user_books`
   - `id` (UUID PK)
   - `user_id` (FK users, indexed)
   - `book_id` (FK books, indexed)
   - `shelf` (`want_to_read`, `reading`, `read`, `custom`)
   - `status` (`owned`, `wishlist`, etc., optional)
   - `rating` (nullable)
   - `review` (nullable)
   - `started_at`, `finished_at` (nullable)
   - `created_at`, `updated_at`
   - unique (`user_id`, `book_id`) for dedupe.

8. `scan_jobs` (optional but useful)
   - track asynchronous or historical scan imports per user.

### Notes on normalization
- Keep `books` canonical/shared globally.
- Keep user-specific state in `user_books`.
- Library membership lifecycle in one table simplifies queries.

---

## 5) API contract plan (new endpoints)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Users
- `GET /users/me`
- `PATCH /users/me`
- `GET /users/:user_id` (privacy filtered)

### Library memberships (follower model)
- `POST /memberships/:user_id/follow` (follow a user's library)
- `DELETE /memberships/:user_id/follow` (unfollow)
- `GET /memberships/me/following`
- `GET /memberships/me/followers`
- `POST /memberships/:user_id/block` (optional, phase 2)

### Library
- `GET /library/me/books`
- `POST /library/me/books` (add by googleBooksId/ISBN/manual)
- `PATCH /library/me/books/:user_book_id`
- `DELETE /library/me/books/:user_book_id`
- `GET /library/users/:user_id/books` (subject to privacy)

### Private library access requests
- `POST /library/access-requests/:user_id` (request access to private library)
- `GET /library/access-requests/incoming`
- `GET /library/access-requests/outgoing`
- `POST /library/access-requests/:id/approve`
- `POST /library/access-requests/:id/reject`

### Integration with existing scan pipeline
- Keep current `POST /scan/capture`, but add an authenticated variant:
  - `POST /library/me/import-scan`
  - accept image, run detect/extract/lookup, return candidates.
  - require **explicit user confirm/select** before persistence to `user_books`.

---

## 6) Implementation phases

### Phase 1: Foundation
1. Add DB package setup (`db.py`, session factory, base model).
2. Add Alembic and first migration (`users`, `books`, `user_books`, `library_memberships`).
3. Add auth (JWT/session cookie) and password hashing.
4. Add base error format and request validation approach.

### Phase 2: Core product flows
1. User registration/login + profile.
2. Add/remove/update library entries.
3. Library follow/unfollow + follower/following listing.
4. Privacy checks for viewing another user’s library.
5. Public/private visibility settings + private-library access request workflow.

### Phase 3: Scan persistence
1. Attach scan results to user account.
2. Require explicit confirmation before writing selected candidates to `user_books`.
3. Store import provenance (source image, extraction confidence, selected candidate).
4. Add idempotency guards for repeated imports.

### Phase 4: hardening
1. Pagination and cursor patterns for membership/library lists.
2. Index tuning based on query profile.
3. Rate limiting for auth/search endpoints.
4. audit logging + admin diagnostics.

---

## 7) Security and privacy baseline

1. Store only hashed passwords (`argon2` or `bcrypt`).
2. Enforce auth on all user/membership/library routes.
3. Add row-level ownership checks in service layer.
4. Protect PII fields in serialized responses.
5. Add basic abuse controls (rate limit login, request throttling).

---

## 8) Testing strategy

1. **Model tests**
   - constraints, relationship integrity, cascade behavior.
2. **API tests**
   - auth rules, privacy visibility, library membership workflow states.
3. **Migration tests**
   - upgrade + downgrade on empty and seeded DB.
4. **Integration tests**
   - scan import into `user_books` path.

---

## 9) Proposed directory layout (Python backend)

```text
src/bookshelf_scanner/
  api/
    auth_routes.py
    users_routes.py
    memberships_routes.py
    library_routes.py
    scan_routes.py
  services/
    auth_service.py
    memberships_service.py
    library_service.py
  db/
    base.py
    session.py
    models/
      user.py
      library_membership.py
      book.py
      user_book.py
  repositories/
    user_repo.py
    membership_repo.py
    library_repo.py
  migrations/  # Alembic
```

---

## 10) Confirmed decisions

### Confirmed
1. DB: Standardize on PostgreSQL for non-test environments.
2. Social model: use follower-style **library memberships** (not mutual friend requests).
3. Library dedupe: keep `user_id + book_id` unique for now.
4. Scan flow: require explicit confirm/select before adding detected books to library.

5. Privacy model: users can choose `public` or `private`; private libraries require access requests that owners approve/reject.

### Nice-to-decide-soon (can be deferred)
1. MVP auth transport preference: JWT access/refresh tokens vs cookie session.
2. Ratings/reviews in MVP or post-MVP.
3. Books metadata strategy: internal-first cache vs always-live Google Books with cache.
4. Deletion policy: hard delete vs soft delete with retention.
5. Notifications in MVP.
