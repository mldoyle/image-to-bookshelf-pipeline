"""Database service helpers for library CRUD and serialization."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import and_, func

from .models import Book, Friend, Loan, User, UserBook


ALLOWED_FRIEND_STATUSES = {"active", "blocked"}
ALLOWED_LOAN_STATUSES = {"active", "returned"}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _normalize_text(value: str | None) -> str:
    return " ".join((value or "").strip().lower().split())


def _to_title_case_username(value: str) -> str:
    local = value.split("@", 1)[0].strip() or "localdev"
    return "".join(ch for ch in local if ch.isalnum() or ch in {"_", "-"})[:80] or "localdev"


def _split_author_line(author_line: str | None) -> list[str]:
    if not author_line:
        return []
    return [chunk.strip() for chunk in author_line.split(",") if chunk.strip()]


def _as_string_or_none(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _as_optional_int(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(round(value))
    text = str(value).strip()
    if not text:
        return None
    try:
        return int(round(float(text)))
    except ValueError:
        return None


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
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not isinstance(value, str):
        return None
    text = value.strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


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


def _status_or_default(value: Any, *, allowed: set[str], default: str) -> str:
    raw = (str(value or "").strip().lower() or default)
    return raw if raw in allowed else default


def _initials(name: str) -> str:
    chunks = [part for part in name.strip().split() if part]
    if not chunks:
        return "?"
    if len(chunks) == 1:
        return chunks[0][:2].upper()
    return (chunks[0][:1] + chunks[-1][:1]).upper()


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
        if not existing.badge:
            existing.badge = "PATRON"
        return existing

    candidate_username = (username or "").strip() or _to_title_case_username(normalized_email)
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
        badge="PATRON",
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

    page_count = _as_optional_int(payload.get("pageCount"))
    if page_count is not None and page_count < 0:
        page_count = None

    synopsis = _as_string_or_none(payload.get("synopsis") or payload.get("descriptionSnippet"))

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
    book.page_count = page_count
    book.synopsis = synopsis
    book.info_link = _as_string_or_none(payload.get("infoLink"))


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
    user_book.liked = _coerce_bool(payload.get("liked"), default=user_book.liked or False)
    user_book.reread = _coerce_bool(payload.get("reread"), default=user_book.reread or False)

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
        "publishedDate": user_book.book.published_date,
        "genres": user_book.book.categories_json or [],
        "rating": user_book.rating,
        "review": user_book.review,
        "coverThumbnail": user_book.book.thumbnail_url,
        "loaned": bool(user_book.loaned),
        "liked": bool(user_book.liked),
        "reread": bool(user_book.reread),
        "addedAt": user_book.created_at.isoformat(),
        "source": user_book.source,
        "googleBooksId": user_book.book.google_books_id,
        "shelf": user_book.shelf,
        "status": user_book.status,
        "pageCount": user_book.book.page_count,
        "synopsis": user_book.book.synopsis,
        "infoLink": user_book.book.info_link,
    }


def list_friends(session: Any, *, user_id: str) -> list[Friend]:
    return (
        session.query(Friend)
        .filter(Friend.user_id == user_id)
        .order_by(Friend.name.asc(), Friend.created_at.desc())
        .all()
    )


def get_friend(session: Any, *, user_id: str, friend_id: str) -> Friend | None:
    return (
        session.query(Friend)
        .filter(and_(Friend.user_id == user_id, Friend.id == friend_id))
        .one_or_none()
    )


def upsert_friend(
    session: Any,
    *,
    user: User,
    payload: dict[str, Any],
    existing: Friend | None = None,
) -> tuple[Friend, bool]:
    friend = existing
    if friend is None and payload.get("id"):
        friend = get_friend(session, user_id=user.id, friend_id=str(payload["id"]))

    if friend is None:
        name = _as_string_or_none(payload.get("name"))
        email = _as_string_or_none(payload.get("email"))
        if not name:
            raise ValueError("missing_friend_name")

        query = session.query(Friend).filter(Friend.user_id == user.id, Friend.name == name)
        if email:
            query = query.filter(Friend.email == email)
        friend = query.one_or_none()

    created = friend is None
    if created:
        friend = Friend(user_id=user.id, name="Pending")
        session.add(friend)

    assert friend is not None

    name = _as_string_or_none(payload.get("name")) or friend.name
    email = _as_string_or_none(payload.get("email"))
    status = _status_or_default(payload.get("status"), allowed=ALLOWED_FRIEND_STATUSES, default=friend.status or "active")

    friend.name = name
    friend.email = email
    friend.avatar_url = _as_string_or_none(payload.get("avatarUrl"))
    friend.status = status

    friend_user_id = _as_string_or_none(payload.get("friendUserId"))
    if friend_user_id:
        friend.friend_user_id = friend_user_id

    session.flush()
    return friend, created


def serialize_friend(friend: Friend) -> dict[str, Any]:
    return {
        "id": friend.id,
        "name": friend.name,
        "initials": _initials(friend.name),
        "email": friend.email,
        "avatarUrl": friend.avatar_url,
        "status": friend.status,
        "friendUserId": friend.friend_user_id,
        "createdAt": friend.created_at.isoformat(),
    }


def _sync_book_loaned_state(session: Any, user_book: UserBook) -> None:
    active_exists = (
        session.query(Loan)
        .filter(and_(Loan.user_book_id == user_book.id, Loan.status == "active"))
        .count()
        > 0
    )
    user_book.loaned = active_exists


def list_loans(session: Any, *, user_id: str, status: str | None = None) -> list[Loan]:
    query = session.query(Loan).filter(Loan.user_id == user_id)
    normalized_status = _status_or_default(status, allowed=ALLOWED_LOAN_STATUSES, default="") if status else ""
    if normalized_status in ALLOWED_LOAN_STATUSES:
        query = query.filter(Loan.status == normalized_status)
    return query.order_by(Loan.created_at.desc()).all()


def get_loan(session: Any, *, user_id: str, loan_id: str) -> Loan | None:
    return (
        session.query(Loan)
        .filter(and_(Loan.user_id == user_id, Loan.id == loan_id))
        .one_or_none()
    )


def create_loan(session: Any, *, user: User, payload: dict[str, Any]) -> Loan:
    user_book_id = _as_string_or_none(payload.get("userBookId"))
    if not user_book_id:
        raise ValueError("missing_user_book_id")

    user_book = get_user_book(session, user_id=user.id, user_book_id=user_book_id)
    if user_book is None:
        raise ValueError("user_book_not_found")

    friend = None
    friend_id = _as_string_or_none(payload.get("friendId"))
    if friend_id:
        friend = get_friend(session, user_id=user.id, friend_id=friend_id)

    borrower_name = _as_string_or_none(payload.get("borrowerName")) or (friend.name if friend else None)
    if not borrower_name:
        raise ValueError("missing_borrower_name")

    due_at = _parse_iso_datetime(payload.get("dueAt") or payload.get("dueDate"))
    lent_at = _parse_iso_datetime(payload.get("lentAt")) or _utcnow()
    returned_at = _parse_iso_datetime(payload.get("returnedAt"))
    status = _status_or_default(payload.get("status"), allowed=ALLOWED_LOAN_STATUSES, default="active")
    if returned_at is not None:
        status = "returned"

    created = Loan(
        user_id=user.id,
        user_book_id=user_book.id,
        friend_id=friend.id if friend else None,
        borrower_name=borrower_name,
        borrower_contact=_as_string_or_none(payload.get("borrowerContact") or payload.get("borrowerEmail")),
        lent_at=lent_at,
        due_at=due_at,
        returned_at=returned_at,
        note=_as_string_or_none(payload.get("note")),
        status=status,
    )
    session.add(created)
    session.flush()

    _sync_book_loaned_state(session, user_book)
    session.flush()
    return created


def update_loan(session: Any, *, loan: Loan, payload: dict[str, Any]) -> Loan:
    friend_id = _as_string_or_none(payload.get("friendId"))
    if friend_id:
        friend = get_friend(session, user_id=loan.user_id, friend_id=friend_id)
        loan.friend_id = friend.id if friend else loan.friend_id

    borrower_name = _as_string_or_none(payload.get("borrowerName"))
    if borrower_name:
        loan.borrower_name = borrower_name

    borrower_contact = _as_string_or_none(payload.get("borrowerContact") or payload.get("borrowerEmail"))
    if borrower_contact is not None:
        loan.borrower_contact = borrower_contact

    lent_at = _parse_iso_datetime(payload.get("lentAt"))
    due_at = _parse_iso_datetime(payload.get("dueAt") or payload.get("dueDate"))
    returned_at = _parse_iso_datetime(payload.get("returnedAt"))
    status = _status_or_default(payload.get("status"), allowed=ALLOWED_LOAN_STATUSES, default=loan.status or "active")

    if lent_at is not None:
        loan.lent_at = lent_at
    if due_at is not None or ("dueAt" in payload or "dueDate" in payload):
        loan.due_at = due_at
    if returned_at is not None:
        loan.returned_at = returned_at
        status = "returned"

    note = payload.get("note")
    if note is not None:
        loan.note = _as_string_or_none(note)

    if status == "returned" and loan.returned_at is None:
        loan.returned_at = _utcnow()
    if status == "active":
        loan.returned_at = None

    loan.status = status
    session.flush()

    _sync_book_loaned_state(session, loan.user_book)
    session.flush()
    return loan


def serialize_loan(loan: Loan) -> dict[str, Any]:
    book_payload = serialize_user_book(loan.user_book)
    return {
        "id": loan.id,
        "userBookId": loan.user_book_id,
        "friendId": loan.friend_id,
        "borrowerName": loan.borrower_name,
        "borrowerContact": loan.borrower_contact,
        "lentAt": loan.lent_at.isoformat() if loan.lent_at else None,
        "dueAt": loan.due_at.isoformat() if loan.due_at else None,
        "returnedAt": loan.returned_at.isoformat() if loan.returned_at else None,
        "status": loan.status,
        "note": loan.note,
        "createdAt": loan.created_at.isoformat(),
        "updatedAt": loan.updated_at.isoformat(),
        "book": book_payload,
        "friend": serialize_friend(loan.friend) if loan.friend is not None else None,
    }


def apply_user_profile_patch(user: User, payload: dict[str, Any]) -> None:
    display_name = payload.get("displayName")
    if display_name is not None:
        user.display_name = _as_string_or_none(display_name)

    bio = payload.get("bio")
    if bio is not None:
        user.bio = _as_string_or_none(bio)

    location = payload.get("location")
    if location is not None:
        user.location = _as_string_or_none(location)

    website = payload.get("website")
    if website is not None:
        user.website = _as_string_or_none(website)

    badge = payload.get("badge")
    if badge is not None:
        user.badge = _as_string_or_none(badge) or "PATRON"

    avatar_url = payload.get("avatarUrl")
    if avatar_url is not None:
        user.avatar_url = _as_string_or_none(avatar_url)


def serialize_user_profile(session: Any, *, user: User) -> dict[str, Any]:
    books_query = session.query(UserBook).filter(UserBook.user_id == user.id)
    books_total = books_query.count()

    now = _utcnow()
    start_of_year = datetime(now.year, 1, 1, tzinfo=timezone.utc)
    books_read_this_year = books_query.filter(UserBook.created_at >= start_of_year).count()
    active_loans = session.query(Loan).filter(and_(Loan.user_id == user.id, Loan.status == "active")).count()
    shelves_count = session.query(func.count(func.distinct(UserBook.shelf))).filter(UserBook.user_id == user.id).scalar() or 0
    friends_count = session.query(Friend).filter(and_(Friend.user_id == user.id, Friend.status == "active")).count()
    avg_rating = (
        session.query(func.avg(UserBook.rating))
        .filter(and_(UserBook.user_id == user.id, UserBook.rating.isnot(None)))
        .scalar()
    )

    favorite_books = (
        books_query.filter(UserBook.liked.is_(True)).order_by(UserBook.updated_at.desc()).limit(8).all()
    )

    recent_reviews = (
        books_query.filter(UserBook.review.isnot(None)).order_by(UserBook.updated_at.desc()).limit(5).all()
    )

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "displayName": user.display_name,
        "avatarUrl": user.avatar_url,
        "bio": user.bio,
        "location": user.location,
        "website": user.website,
        "badge": user.badge or "PATRON",
        "metrics": {
            "booksInLibrary": books_total,
            "booksThisYear": books_read_this_year,
            "activeLoans": active_loans,
            "shelves": int(shelves_count),
            "friends": friends_count,
            "averageRating": round(float(avg_rating), 2) if avg_rating is not None else None,
        },
        "favoriteBooks": [serialize_user_book(entry) for entry in favorite_books],
        "recentReviews": [serialize_user_book(entry) for entry in recent_reviews],
    }
