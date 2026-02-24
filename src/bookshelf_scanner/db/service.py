"""Database service helpers for library CRUD and serialization."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import and_

from .models import Book, User, UserBook


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _to_title_case_username(value: str) -> str:
    local = value.split("@", 1)[0].strip() or "localdev"
    return "".join(ch for ch in local if ch.isalnum() or ch in {"_", "-"})[:80] or "localdev"


def _split_author_line(author_line: str | None) -> list[str]:
    if not author_line:
        return []
    return [chunk.strip() for chunk in author_line.split(",") if chunk.strip()]


def _parse_published_year(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value if 0 <= value <= 3000 else None
    if isinstance(value, float):
        parsed = int(round(value))
        return parsed if 0 <= parsed <= 3000 else None
    text = str(value).strip()
    if len(text) < 4:
        return None
    for token in text.replace("/", "-").split("-"):
        if len(token) == 4 and token.isdigit():
            parsed = int(token)
            if 0 <= parsed <= 3000:
                return parsed
    if text[:4].isdigit():
        parsed = int(text[:4])
        if 0 <= parsed <= 3000:
            return parsed
    return None


def _parse_iso_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def get_or_create_dev_user(
    session: Any,
    *,
    email: str,
    username: str | None = None,
) -> User:
    normalized_email = (email or "localdev@bookshelf.local").strip().lower()
    existing = session.query(User).filter(User.email == normalized_email).one_or_none()
    if existing is not None:
        if not existing.is_active:
            existing.is_active = True
        return existing

    candidate_username = (username or "").strip() or _to_title_case_username(normalized_email)
    # Ensure unique username without a separate transaction.
    suffix = 1
    base_username = candidate_username
    while session.query(User).filter(User.username == candidate_username).one_or_none() is not None:
        suffix += 1
        candidate_username = f"{base_username[:70]}-{suffix}"

    created = User(
        email=normalized_email,
        username=candidate_username,
        display_name=base_username,
        library_visibility="private",
        is_active=True,
    )
    session.add(created)
    session.flush()
    return created


def _find_book_for_payload(session: Any, payload: dict[str, Any]) -> Book | None:
    google_books_id = (payload.get("googleBooksId") or "").strip() or None
    if google_books_id:
        found = session.query(Book).filter(Book.google_books_id == google_books_id).one_or_none()
        if found is not None:
            return found

    title = (payload.get("title") or "").strip()
    title_normalized = _normalize_text(title)
    author_line = (payload.get("author") or "").strip()
    primary_author = (_split_author_line(author_line) or [None])[0]
    published_year = _parse_published_year(payload.get("publishedYear"))

    if not title_normalized:
        return None

    query = session.query(Book).filter(Book.title_normalized == title_normalized)
    if published_year is not None:
        query = query.filter(Book.published_year == published_year)

    candidates = query.all()
    if not candidates:
        return None

    normalized_author = _normalize_text(primary_author)
    if not normalized_author:
        return candidates[0]

    for candidate in candidates:
        if _normalize_text(candidate.primary_author) == normalized_author:
            return candidate

    return candidates[0]


def _apply_book_payload(book: Book, payload: dict[str, Any]) -> None:
    title = (payload.get("title") or "").strip() or "Untitled"
    authors = _split_author_line(payload.get("author"))
    categories = payload.get("genres") if isinstance(payload.get("genres"), list) else []

    book.google_books_id = (payload.get("googleBooksId") or "").strip() or None
    book.isbn_10 = (payload.get("isbn10") or "").strip() or None
    book.isbn_13 = (payload.get("isbn13") or "").strip() or None
    book.title = title
    book.title_normalized = _normalize_text(title)
    book.subtitle = (payload.get("subtitle") or "").strip() or None
    book.primary_author = authors[0] if authors else None
    book.authors_json = authors
    book.categories_json = [str(entry).strip() for entry in categories if str(entry).strip()]
    book.publisher = (payload.get("publisher") or "").strip() or None
    book.published_date = (payload.get("publishedDate") or "").strip() or None
    book.published_year = _parse_published_year(payload.get("publishedYear"))
    book.thumbnail_url = (payload.get("coverThumbnail") or "").strip() or None


def _coerce_rating(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if numeric < 0.0:
        return 0.0
    if numeric > 5.0:
        return 5.0
    return round(numeric, 2)


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {"1", "true", "yes", "y", "on"}:
            return True
        if lowered in {"0", "false", "no", "n", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def upsert_user_book(
    session: Any,
    *,
    user: User,
    payload: dict[str, Any],
) -> tuple[UserBook, bool]:
    book = _find_book_for_payload(session, payload)
    created_book = False
    if book is None:
        book = Book()
        session.add(book)
        created_book = True

    _apply_book_payload(book, payload)
    session.flush()

    user_book = (
        session.query(UserBook)
        .filter(and_(UserBook.user_id == user.id, UserBook.book_id == book.id))
        .one_or_none()
    )
    created_user_book = user_book is None
    if user_book is None:
        user_book = UserBook(user_id=user.id, book_id=book.id)
        session.add(user_book)

    user_book.shelf = (payload.get("shelf") or user_book.shelf or "read").strip() or "read"
    user_book.status = (payload.get("status") or user_book.status or "owned").strip() or "owned"
    user_book.source = (payload.get("source") or user_book.source or "scan").strip() or "scan"
    user_book.loaned = _coerce_bool(payload.get("loaned"), default=user_book.loaned or False)

    incoming_rating = _coerce_rating(payload.get("rating"))
    if incoming_rating is not None:
        user_book.rating = incoming_rating
    elif created_user_book and created_book:
        user_book.rating = None

    review = payload.get("review")
    if review is not None:
        review_text = str(review).strip()
        user_book.review = review_text or None

    started_at = _parse_iso_datetime(payload.get("startedAt"))
    finished_at = _parse_iso_datetime(payload.get("finishedAt"))
    if started_at is not None:
        user_book.started_at = started_at
    if finished_at is not None:
        user_book.finished_at = finished_at

    added_at = _parse_iso_datetime(payload.get("addedAt"))
    if added_at is not None and created_user_book:
        user_book.created_at = added_at

    session.flush()
    return user_book, created_user_book


def list_user_books(session: Any, *, user_id: str) -> list[UserBook]:
    return (
        session.query(UserBook)
        .filter(UserBook.user_id == user_id)
        .order_by(UserBook.created_at.desc())
        .all()
    )


def get_user_book(session: Any, *, user_id: str, user_book_id: str) -> UserBook | None:
    return (
        session.query(UserBook)
        .filter(and_(UserBook.user_id == user_id, UserBook.id == user_book_id))
        .one_or_none()
    )


def serialize_user_book(user_book: UserBook) -> dict[str, Any]:
    authors = user_book.book.authors_json or []
    author_line = ", ".join(str(name).strip() for name in authors if str(name).strip())

    return {
        "id": user_book.id,
        "title": user_book.book.title,
        "author": author_line or "Unknown author",
        "publishedYear": user_book.book.published_year,
        "genres": user_book.book.categories_json or [],
        "rating": user_book.rating,
        "review": user_book.review,
        "coverThumbnail": user_book.book.thumbnail_url,
        "loaned": bool(user_book.loaned),
        "addedAt": user_book.created_at.isoformat(),
        "source": user_book.source,
        "googleBooksId": user_book.book.google_books_id,
        "shelf": user_book.shelf,
        "status": user_book.status,
    }
