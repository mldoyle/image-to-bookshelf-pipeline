"""Library endpoints backed by SQLAlchemy models."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, jsonify, request
from sqlalchemy import and_

from ..db.extension import db
from ..db.models import Loan
from ..db.service import (
    apply_user_profile_patch,
    create_loan,
    get_friend,
    get_loan,
    get_or_create_dev_user,
    get_user_book,
    list_friends,
    list_loans,
    list_user_books,
    serialize_friend,
    serialize_loan,
    serialize_user_book,
    serialize_user_profile,
    update_loan,
    upsert_friend,
    upsert_user_book,
)


library_bp = Blueprint("library", __name__, url_prefix="/library")


class MissingIdentityError(RuntimeError):
    """Raised when no user identity is available for library endpoints."""


def _effective_dev_identity() -> tuple[str, str]:
    # Auth is deferred; in production an upstream layer must provide user identity headers.
    header_email = (request.headers.get("X-Bookshelf-User-Email") or "").strip()
    header_username = (request.headers.get("X-Bookshelf-Username") or "").strip()
    if header_email:
        username = header_username or str(current_app.config.get("BOOKSHELF_DEV_USER_USERNAME", "localdev"))
        return header_email, username

    fallback_enabled = bool(current_app.config.get("BOOKSHELF_ENABLE_DEV_IDENTITY_FALLBACK", True))
    if not fallback_enabled:
        raise MissingIdentityError(
            "X-Bookshelf-User-Email is required when dev identity fallback is disabled."
        )

    email = str(current_app.config.get("BOOKSHELF_DEV_USER_EMAIL", "localdev@bookshelf.local"))
    username = header_username or str(current_app.config.get("BOOKSHELF_DEV_USER_USERNAME", "localdev"))
    return email, username


def _current_user() -> Any:
    email, username = _effective_dev_identity()
    user = get_or_create_dev_user(db.session, email=email, username=username)
    db.session.flush()
    return user


def _extract_book_payload() -> dict[str, Any]:
    payload = request.get_json(silent=True) or {}
    if isinstance(payload.get("book"), dict):
        payload = payload["book"]
    return payload if isinstance(payload, dict) else {}


@library_bp.errorhandler(MissingIdentityError)
def _handle_missing_identity(exc: MissingIdentityError):
    db.session.rollback()
    return jsonify({"error": "missing_identity", "message": str(exc)}), 401


@library_bp.get("/me/profile")
def get_my_profile():
    user = _current_user()
    payload = serialize_user_profile(db.session, user=user)
    db.session.commit()
    return jsonify({"profile": payload}), 200


@library_bp.patch("/me/profile")
def patch_my_profile():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    try:
        apply_user_profile_patch(user, payload)
        db.session.flush()
        profile = serialize_user_profile(db.session, user=user)
        db.session.commit()
        return jsonify({"profile": profile}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.get("/me/books")
def list_my_books():
    user = _current_user()
    items = [serialize_user_book(row) for row in list_user_books(db.session, user_id=user.id)]
    db.session.commit()
    return jsonify({"count": len(items), "items": items}), 200


@library_bp.post("/me/books")
def add_my_book():
    payload = _extract_book_payload()
    if not payload:
        return jsonify({"error": "missing_payload"}), 400

    if not str(payload.get("title") or "").strip():
        return jsonify({"error": "missing_title"}), 400

    user = _current_user()
    try:
        user_book, created = upsert_user_book(db.session, user=user, payload=payload)
        item = serialize_user_book(user_book)
        db.session.commit()
        return jsonify({"item": item}), 201 if created else 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.post("/me/books/batch")
def upsert_my_books_batch():
    payload = request.get_json(silent=True) or {}
    items_payload = payload.get("items") if isinstance(payload, dict) else None
    if not isinstance(items_payload, list):
        return jsonify({"error": "missing_items"}), 400

    user = _current_user()
    try:
        written_items: list[dict[str, Any]] = []
        for item_payload in items_payload:
            if not isinstance(item_payload, dict):
                continue
            if not str(item_payload.get("title") or "").strip():
                continue
            user_book, _ = upsert_user_book(db.session, user=user, payload=item_payload)
            written_items.append(serialize_user_book(user_book))

        db.session.commit()
        return jsonify({"count": len(written_items), "items": written_items}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.patch("/me/books/<string:user_book_id>")
def patch_my_book(user_book_id: str):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    row = get_user_book(db.session, user_id=user.id, user_book_id=user_book_id)
    if row is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    mutable_fields = {
        "loaned",
        "rating",
        "review",
        "liked",
        "reread",
        "shelf",
        "status",
        "source",
        "startedAt",
        "finishedAt",
        "addedAt",
        "pageCount",
        "synopsis",
        "infoLink",
    }
    write_payload = {key: value for key, value in payload.items() if key in mutable_fields}

    try:
        # Reuse upsert logic so field coercion stays in one place.
        current = serialize_user_book(row)
        current.update(write_payload)
        current["title"] = row.book.title
        current["author"] = ", ".join(row.book.authors_json or [])
        current["publishedYear"] = row.book.published_year
        current["publishedDate"] = row.book.published_date
        current["genres"] = row.book.categories_json or []
        current["coverThumbnail"] = row.book.thumbnail_url
        current["googleBooksId"] = row.book.google_books_id

        updated, _ = upsert_user_book(db.session, user=user, payload=current)
        item = serialize_user_book(updated)
        db.session.commit()
        return jsonify({"item": item}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.delete("/me/books/<string:user_book_id>")
def delete_my_book(user_book_id: str):
    user = _current_user()
    row = get_user_book(db.session, user_id=user.id, user_book_id=user_book_id)
    if row is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    try:
        db.session.delete(row)
        db.session.commit()
        return jsonify({"status": "deleted", "id": user_book_id}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "delete_failed", "message": str(exc)}), 500


@library_bp.get("/me/friends")
def list_my_friends():
    user = _current_user()
    items = [serialize_friend(row) for row in list_friends(db.session, user_id=user.id)]
    db.session.commit()
    return jsonify({"count": len(items), "items": items}), 200


@library_bp.post("/me/friends")
def add_my_friend():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    try:
        friend, created = upsert_friend(db.session, user=user, payload=payload)
        db.session.commit()
        return jsonify({"item": serialize_friend(friend)}), 201 if created else 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.patch("/me/friends/<string:friend_id>")
def patch_my_friend(friend_id: str):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    friend = get_friend(db.session, user_id=user.id, friend_id=friend_id)
    if friend is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    try:
        updated, _ = upsert_friend(db.session, user=user, payload=payload, existing=friend)
        db.session.commit()
        return jsonify({"item": serialize_friend(updated)}), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.delete("/me/friends/<string:friend_id>")
def delete_my_friend(friend_id: str):
    user = _current_user()
    friend = get_friend(db.session, user_id=user.id, friend_id=friend_id)
    if friend is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    try:
        db.session.delete(friend)
        db.session.commit()
        return jsonify({"status": "deleted", "id": friend_id}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "delete_failed", "message": str(exc)}), 500


@library_bp.get("/me/loans")
def list_my_loans():
    status = (request.args.get("status") or "").strip().lower() or None
    user = _current_user()
    items = [serialize_loan(row) for row in list_loans(db.session, user_id=user.id, status=status)]
    db.session.commit()
    return jsonify({"count": len(items), "items": items}), 200


@library_bp.post("/me/loans")
def add_my_loan():
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    try:
        created = create_loan(db.session, user=user, payload=payload)
        db.session.commit()
        return jsonify({"item": serialize_loan(created)}), 201
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.patch("/me/loans/<string:loan_id>")
def patch_my_loan(loan_id: str):
    payload = request.get_json(silent=True) or {}
    if not isinstance(payload, dict):
        return jsonify({"error": "invalid_payload"}), 400

    user = _current_user()
    loan = get_loan(db.session, user_id=user.id, loan_id=loan_id)
    if loan is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    try:
        updated = update_loan(db.session, loan=loan, payload=payload)
        db.session.commit()
        return jsonify({"item": serialize_loan(updated)}), 200
    except ValueError as exc:
        db.session.rollback()
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "write_failed", "message": str(exc)}), 500


@library_bp.delete("/me/loans/<string:loan_id>")
def delete_my_loan(loan_id: str):
    user = _current_user()
    loan = get_loan(db.session, user_id=user.id, loan_id=loan_id)
    if loan is None:
        db.session.commit()
        return jsonify({"error": "not_found"}), 404

    try:
        user_book = loan.user_book
        db.session.delete(loan)

        active_remaining = (
            db.session.query(Loan)
            .filter(and_(Loan.user_book_id == user_book.id, Loan.status == "active"))
            .count()
            > 0
        )
        user_book.loaned = active_remaining

        db.session.commit()
        return jsonify({"status": "deleted", "id": loan_id}), 200
    except Exception as exc:
        db.session.rollback()
        return jsonify({"error": "delete_failed", "message": str(exc)}), 500
