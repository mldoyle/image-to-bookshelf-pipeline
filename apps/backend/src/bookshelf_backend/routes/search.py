"""Book search routes backed by Google Books."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from ..app.runtime import get_runtime_state
from ..services.google_books_service import (
    compact_lookup_item,
    has_books_api_key,
    missing_api_key_message,
)


search_bp = Blueprint("search", __name__)


@search_bp.get("/books/search")
def books_search():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"error": "missing_query"}), 400

    try:
        max_results = int(request.args.get("maxResults", "20"))
    except ValueError:
        return jsonify({"error": "invalid_max_results"}), 400
    max_results = max(1, min(40, max_results))

    books_client = get_runtime_state().books.get_client()
    if not has_books_api_key(books_client):
        return (
            jsonify(
                {
                    "error": "missing_api_key",
                    "message": missing_api_key_message(),
                }
            ),
            503,
        )

    payload = books_client.search(query=query, max_results=max_results)
    raw_items = payload.get("items") or []
    return jsonify(
        {
            "totalItems": int(payload.get("totalItems") or 0),
            "items": [compact_lookup_item(item) for item in raw_items],
        }
    )
