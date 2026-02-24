"""Library endpoints backed by SQLAlchemy models."""

from __future__ import annotations

from typing import Any

from flask import Blueprint, current_app, jsonify, request

from ..db.extension import db
from ..db.service import (
    get_or_create_dev_user,
    get_user_book,
    list_user_books,
    serialize_user_book,
    upsert_user_book,
)


library_bp = Blueprint("library", __name__, url_prefix="/library")


def _effective_dev_identity() -> tuple[str, str]:
    # Auth is deferred; this keeps mobile/backend integration deterministic in local dev.
    header_email = (request.headers.get("X-Bookshelf-User-Email") or "").strip()
    header_username = (request.headers.get("X-Bookshelf-Username") or "").strip()

    email = header_email or str(current_app.config.get("BOOKSHELF_DEV_USER_EMAIL", "localdev@bookshelf.local"))
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

    try:
        user = _current_user()
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

    try:
        user = _current_user()
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
        "shelf",
        "status",
        "source",
        "startedAt",
        "finishedAt",
        "addedAt",
    }
    write_payload = {key: value for key, value in payload.items() if key in mutable_fields}

    try:
        # Reuse upsert logic so field coercion stays in one place.
        current = serialize_user_book(row)
        current.update(write_payload)
        current["title"] = row.book.title
        current["author"] = ", ".join(row.book.authors_json or [])
        current["publishedYear"] = row.book.published_year
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
